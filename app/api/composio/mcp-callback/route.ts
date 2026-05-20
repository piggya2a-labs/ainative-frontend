import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Composio } from 'composio-core'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TOKEN_ENDPOINT = 'https://connect.composio.dev/api/v3/auth/dash/oauth2/token'

// Composio app name → agent_registry id 的映射
const COMPOSIO_APP_TO_AGENT: Record<string, string> = {
  github: 'composio-github-mcp',
  gmail: 'composio-gmail-mcp',
  slack: 'composio-slack-mcp',
  notion: 'composio-notion-mcp',
  linear: 'composio-linear-mcp',
  resend: 'composio-resend-mcp',
  vapi: 'composio-vapi-mcp',
  e2b: 'composio-e2b-mcp',
  postman: 'composio-postman-mcp',
}

// GET /api/composio/mcp-callback
// Composio 授权完成后回调到这里，重定向到前端让 JS 完成 token 交换
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const host = req.headers.get('host') ?? 'ainative-frontend.vercel.app'
  const origin = `https://${host}`

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard?composio_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/dashboard?composio_error=missing_params`)
  }

  return NextResponse.redirect(
    `${origin}/dashboard?composio_mcp_code=${encodeURIComponent(code)}&composio_mcp_state=${encodeURIComponent(state)}`
  )
}

// POST /api/composio/mcp-callback — 前端调用，完成 token 交换 + 自动绑定 Agent
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  const userToken = authHeader?.replace('Bearer ', '')
  if (!userToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: userErr } = await supabase.auth.getUser(userToken)
  if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { code, codeVerifier, clientId, redirectUri } = body as {
    code: string
    codeVerifier: string
    clientId: string
    redirectUri: string
  }

  if (!code || !codeVerifier || !clientId || !redirectUri) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // 1. 换取 access token
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      }).toString(),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      return NextResponse.json({ error: `Token exchange failed: ${text.slice(0, 200)}` }, { status: 502 })
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token as string
    const consumerKey = (tokenData['x-consumer-api-key'] ?? tokenData.consumer_key ?? '') as string

    // 2. 存入 user_metadata
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        composio_mcp: {
          access_token: accessToken,
          consumer_key: consumerKey,
          token_type: tokenData.token_type ?? 'Bearer',
          connected_at: new Date().toISOString(),
        },
      },
    })

    // 3. 用 Composio SDK 查询用户已连接的工具（用 user.id 作为 entityId）
    const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! })
    const entityId = `onit-${user.id}`
    let connectedApps: string[] = []

    try {
      const connections = await composio.connectedAccounts.list({ entityId })
      connectedApps = (connections?.items ?? [])
        .filter((c: { status: string }) => c.status === 'ACTIVE')
        .map((c: { appName: string }) => c.appName?.toLowerCase())
    } catch {
      // 如果这个 entityId 没有连接记录，忽略错误
    }

    // 4. 找用户的第一个 tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    const autoConnected: string[] = []

    if (tenant) {
      // 5. 对每个已连接的工具，检查 agent_registry 里有没有对应的 Agent Card
      for (const appName of connectedApps) {
        const agentId = COMPOSIO_APP_TO_AGENT[appName]
        if (!agentId) continue

        // 检查 agent_registry 里有没有这个 Agent
        const { data: agentCard } = await supabase
          .from('agent_registry')
          .select('id, name')
          .eq('id', agentId)
          .single()

        if (!agentCard) continue

        // 检查是否已经连接过
        const { data: existing } = await supabase
          .from('tenant_connectors')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('agent_id', agentId)
          .single()

        if (existing) continue

        // 自动插入 tenant_connectors
        const { error: insertError } = await supabase
          .from('tenant_connectors')
          .insert({
            tenant_id: tenant.id,
            agent_id: agentId,
            status: 'connected',
            metadata: {
              auto_connected: true,
              composio_app: appName,
              connected_via: 'composio_mcp_oauth',
            },
          })

        if (!insertError) {
          autoConnected.push(agentCard.name)
        }
      }
    }

    return NextResponse.json({
      success: true,
      consumerKey,
      autoConnected,
      connectedApps,
    })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
