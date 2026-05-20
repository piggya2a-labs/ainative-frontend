import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TOKEN_ENDPOINT = 'https://connect.composio.dev/api/v3/auth/dash/oauth2/token'

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

// POST /api/composio/mcp-callback — 前端调用，完成 token 交换 + 写入 tenants 表
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

    // 2. 用 Composio admin key 查用户已连接的工具（entityId = user.id）
    const composioApiKey = process.env.COMPOSIO_API_KEY!
    let connectedApps: string[] = []
    try {
      const res = await fetch(
        `https://backend.composio.dev/api/v1/connectedAccounts?entityId=${user.id}&limit=100`,
        { headers: { 'x-api-key': composioApiKey } }
      )
      if (res.ok) {
        const data = await res.json() as { items?: Array<{ appName?: string; status?: string }> }
        connectedApps = (data.items ?? []).map(c => (c.appName ?? '').toLowerCase()).filter(Boolean)
      }
    } catch {
      // 查询失败不影响主流程
    }

    // 3. 写入 tenants 表（composio_token + composio_connected_at + connected_agents）
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, connected_agents')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (tenant) {
      // 合并已有的 connected_agents（去重）
      const existing = (tenant.connected_agents as string[] | null) ?? []
      const merged = Array.from(new Set([...existing, ...connectedApps]))

      await supabase
        .from('tenants')
        .update({
          composio_token: accessToken,
          composio_connected_at: new Date().toISOString(),
          connected_agents: merged,
        })
        .eq('id', tenant.id)
    }

    return NextResponse.json({
      success: true,
      consumerKey,
      connectedApps,
    })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
