import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MCP_BASE = 'https://connect.composio.dev/mcp'
const REGISTER_ENDPOINT = `${MCP_BASE}/register`
const AUTHORIZE_ENDPOINT = `${MCP_BASE}/authorize`

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

function generateState(): string {
  return crypto.randomBytes(16).toString('hex')
}

// POST /api/composio/mcp-oauth — 发起 MCP OAuth 授权，返回授权 URL
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const origin = req.headers.get('origin') ?? 'https://ainative-frontend.vercel.app'
  const redirectUri = `${origin}/api/composio/mcp-callback`

  try {
    // Step 1: Dynamic Client Registration
    const regRes = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'ONIT',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
    })

    let clientId: string
    if (!regRes.ok) {
      // 如果注册失败（可能 Composio 还不支持），返回错误
      const text = await regRes.text()
      return NextResponse.json({ error: `Registration failed (${regRes.status}): ${text.slice(0, 200)}` }, { status: 502 })
    }

    const regData = await regRes.json()
    clientId = regData.client_id as string

    // Step 2: Generate PKCE
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateState()

    // Step 3: Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    const authUrl = `${AUTHORIZE_ENDPOINT}?${params.toString()}`

    // Step 4: Return authUrl + pkce data (client stores in sessionStorage)
    return NextResponse.json({
      authUrl,
      state,
      codeVerifier,
      clientId,
      redirectUri,
    })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/composio/mcp-oauth — 检查当前用户是否已连接 Composio MCP
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = user.user_metadata as Record<string, unknown>
  const composioMcp = meta?.composio_mcp as Record<string, unknown> | undefined

  if (!composioMcp?.access_token) return NextResponse.json({ connected: false })
  return NextResponse.json({
    connected: true,
    connectedAt: composioMcp.connected_at,
  })
}

// DELETE /api/composio/mcp-oauth — 断开 Composio MCP 连接
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { composio_mcp: null },
  })
  return NextResponse.json({ success: true })
}
