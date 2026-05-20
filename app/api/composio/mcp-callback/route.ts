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
    // DEBUG: 把 token exchange 完整响应写进 agent_memory，确认字段名（验收后删除）
    console.log('[composio-callback] tokenData keys:', Object.keys(tokenData), 'values:', JSON.stringify(tokenData).slice(0, 300))
    await supabase.from('agent_memory').upsert({ agent_id: 'debug', key: 'composio-token-exchange-response', content: JSON.stringify(tokenData), tags: ['debug'] }, { onConflict: 'agent_id,key' })

    // ─── COMPOSIO KEY 说明（防回退注释，勿删）────────────────────────────────────────
    // Composio MCP OAuth token exchange 会返回两个 key：
    //   - access_token：OAuth 访问令牌，只能用来驱动 MCP 工具调用，不能查 REST API
    //   - x-consumer-api-key（ck_ 开头）：用户级 consumer key，才是查询 connectedAccounts 的正确凭证
    // 正确做法：存 x-consumer-api-key，用 x-consumer-api-key header 查 /connectedAccounts
    // 错误做法：存 access_token，用 Bearer 或 x-api-key 传 access_token → 永远 401
    // 参考：Composio Dashboard → Install → MCP 区块显示的就是 x-consumer-api-key
    // ─────────────────────────────────────────────────────────────────────────────────
    const consumerKey = (
      tokenData['x-consumer-api-key'] ??
      tokenData.consumer_key ??
      tokenData.access_token ?? // fallback：如果 Composio 改了字段名，access_token 作为最后兜底
      ''
    ) as string

    // 2. 用用户自己的 consumer key 查已连接工具（x-consumer-api-key 天然按用户隔离，无需 entityId）
    let connectedApps: string[] = []
    try {
      const res = await fetch(
        'https://backend.composio.dev/api/v1/connectedAccounts?limit=100',
        { headers: { 'x-consumer-api-key': consumerKey } }
      )
      if (res.ok) {
        const data = await res.json() as { items?: Array<{ appName?: string; status?: string }> }
        connectedApps = (data.items ?? []).map(c => (c.appName ?? '').toLowerCase()).filter(Boolean)
      }
    } catch {
      // 查询失败不影响主流程
    }

    // 3. 写入 tenants 表（composio_token 存 consumer key，composio_connected_at，connected_agents）
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
          composio_token: consumerKey, // 存 consumer key（ck_ 开头），不是 access_token
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
