import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PIPEDREAM_CLIENT_ID = process.env.PIPEDREAM_CLIENT_ID ?? ''
const PIPEDREAM_CLIENT_SECRET = process.env.PIPEDREAM_CLIENT_SECRET ?? ''
const PIPEDREAM_PROJECT_ID = process.env.PIPEDREAM_PROJECT_ID ?? ''
const PIPEDREAM_ENVIRONMENT = process.env.PIPEDREAM_ENVIRONMENT ?? 'production'

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

// POST /api/pipedream/callback
// 前端在用户完成 Pipedream 授权后调用此接口
// body: { userId: string } — 用户 ID（从 Supabase auth 取）
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  const userToken = authHeader?.replace('Bearer ', '')
  if (!userToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: userErr } = await supabase.auth.getUser(userToken)
  if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // 拉取用户已连接的应用列表
    const accessToken = await getPipedreamAccessToken()
    let connectedApps: string[] = []

    if (accessToken && PIPEDREAM_PROJECT_ID) {
      const res = await fetch(
        `https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/accounts?external_user_id=${encodeURIComponent(user.id)}&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-pd-environment': PIPEDREAM_ENVIRONMENT,
          },
        }
      )
      if (res.ok) {
        const data = await res.json() as { data?: Array<{ app?: { name_slug?: string } }> }
        connectedApps = (data.data ?? [])
          .map(a => (a.app?.name_slug ?? '').toLowerCase())
          .filter(Boolean)
      }
    }

    // 写入 tenants 表
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (tenant) {
      await supabase
        .from('tenants')
        .update({ pipedream_connected_at: new Date().toISOString() })
        .eq('id', (tenant as Record<string, unknown>).id as string)
    }

    return NextResponse.json({ success: true, connectedApps })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
