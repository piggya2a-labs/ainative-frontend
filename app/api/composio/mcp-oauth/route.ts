import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Composio MCP OAuth 2.1 endpoints (from /.well-known/oauth-authorization-server)
const AUTHORIZE_ENDPOINT = 'https://connect.composio.dev/api/v3/auth/dash/oauth2/authorize'

// Pre-registered ONIT client_id via Dynamic Client Registration
const ONIT_CLIENT_ID = 'RSCmuSbSfZdHxcqlNlkTpbTYWequHtkc'

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
    // Generate PKCE
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateState()

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: ONIT_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'openid profile email offline_access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    const authUrl = `${AUTHORIZE_ENDPOINT}?${params.toString()}`

    // Return authUrl + pkce data (client stores in sessionStorage)
    return NextResponse.json({
      authUrl,
      state,
      codeVerifier,
      clientId: ONIT_CLIENT_ID,
      redirectUri,
    })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/composio/mcp-oauth — 检查当前用户是否已连接 Composio（从 tenants 表读）
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('composio_token, composio_connected_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!tenant?.composio_token) return NextResponse.json({ connected: false })
  return NextResponse.json({
    connected: true,
    connectedAt: tenant.composio_connected_at,
  })
}

// DELETE /api/composio/mcp-oauth — 断开 Composio 连接（清空 tenants 表对应字段）
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('tenants')
    .update({
      composio_token: null,
      composio_connected_at: null,
      connected_agents: [],
    })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
