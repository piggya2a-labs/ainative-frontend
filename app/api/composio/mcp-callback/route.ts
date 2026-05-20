import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TOKEN_ENDPOINT = 'https://connect.composio.dev/mcp/token'

// GET /api/composio/mcp-callback
// Composio 授权完成后回调到这里
// 前端在跳转前把 pkce 数据存入 sessionStorage，这里通过 state 参数匹配
// 但由于这是服务端路由，需要前端中转
// 改为：重定向到前端 /dashboard/composio-callback，让前端 JS 完成 token 交换
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

  // 重定向到前端页面，让前端 JS 从 sessionStorage 取 PKCE 数据完成 token 交换
  return NextResponse.redirect(
    `${origin}/dashboard?composio_mcp_code=${encodeURIComponent(code)}&composio_mcp_state=${encodeURIComponent(state)}`
  )
}

// POST /api/composio/mcp-callback — 前端调用，完成 token 交换
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

    // 存入 user_metadata
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

    return NextResponse.json({ success: true, consumerKey })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
