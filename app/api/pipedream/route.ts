import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Pipedream Connect 凭证（注册后填入）
const PIPEDREAM_CLIENT_ID = process.env.PIPEDREAM_CLIENT_ID ?? ''
const PIPEDREAM_CLIENT_SECRET = process.env.PIPEDREAM_CLIENT_SECRET ?? ''
const PIPEDREAM_PROJECT_ID = process.env.PIPEDREAM_PROJECT_ID ?? ''
const PIPEDREAM_ENVIRONMENT = process.env.PIPEDREAM_ENVIRONMENT ?? 'production'

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

async function getPipedreamAccessToken(): Promise<string | null> {
  if (!PIPEDREAM_CLIENT_ID || !PIPEDREAM_CLIENT_SECRET) return null
  try {
    const res = await fetch('https://api.pipedream.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: PIPEDREAM_CLIENT_ID,
        client_secret: PIPEDREAM_CLIENT_SECRET,
      }).toString(),
    })
    if (!res.ok) return null
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

// POST /api/pipedream
// body: { action: 'connect-token' } — 生成用户专属 connect token（前端用来打开授权弹窗）
// body: { action: 'accounts' } — 列出当前用户已连接的应用
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { action } = body as { action: string }

  const accessToken = await getPipedreamAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Pipedream not configured' }, { status: 503 })
  }

  if (action === 'connect-token') {
    // 生成用户专属 connect session token
    try {
      const res = await fetch(
        `https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/tokens`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-pd-environment': PIPEDREAM_ENVIRONMENT,
          },
          body: JSON.stringify({
            external_user_id: user.id,
            // 允许用户连接任意应用（不限制）
          }),
        }
      )
      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({ error: `Failed to create token: ${text.slice(0, 200)}` }, { status: 502 })
      }
      const data = await res.json() as { token?: string; connect_link_url?: string; expires_at?: string }
      return NextResponse.json({
        token: data.token,
        connect_link_url: data.connect_link_url,
        expires_at: data.expires_at,
      })
    } catch (e) {
      const err = e as Error
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  if (action === 'accounts') {
    // 列出当前用户已连接的应用
    try {
      const res = await fetch(
        `https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/accounts?external_user_id=${encodeURIComponent(user.id)}&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-pd-environment': PIPEDREAM_ENVIRONMENT,
          },
          next: { revalidate: 60 },
        }
      )
      if (!res.ok) {
        return NextResponse.json({ accounts: [] })
      }
      const data = await res.json() as { data?: Array<{ id: string; app?: { name?: string; name_slug?: string; img_src?: string }; healthy?: boolean; dead?: boolean }> }
      return NextResponse.json({ accounts: data.data ?? [] })
    } catch (e) {
      const err = e as Error
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// GET /api/pipedream — 检查当前用户是否已连接 Pipedream（从 tenants 表读）
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('pipedream_connected_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const connected = !!(tenant as Record<string, unknown> | null)?.pipedream_connected_at
  return NextResponse.json({ connected, connectedAt: (tenant as Record<string, unknown> | null)?.pipedream_connected_at ?? null })
}

// DELETE /api/pipedream — 断开 Pipedream 连接
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('tenants')
    .update({ pipedream_connected_at: null })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
