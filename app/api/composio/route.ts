import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY ?? 'ak_-aUDQkqioskA4DkOiF0u'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

// GET /api/composio — 列出当前用户已连接的工具
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { Composio } = await import('@composio/core')
    const composio = new Composio({ apiKey: COMPOSIO_API_KEY })
    const session = await composio.create(user.id)
    const toolkits = await session.toolkits()
    const connected = (toolkits.items ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((t: any) => t.connection?.is_active)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((t: any) => ({
        name: t.name,
        connectedAccountId: t.connection?.connected_account?.id,
      }))
    return NextResponse.json({ connections: connected })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/composio
// body: { action: 'authorize', appName: string } | { action: 'session' }
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { action, appName } = body as { action: string; appName?: string }

  try {
    const { Composio } = await import('@composio/core')
    const composio = new Composio({ apiKey: COMPOSIO_API_KEY })
    const session = await composio.create(user.id)

    if (action === 'session') {
      // 返回用户专属 MCP URL
      return NextResponse.json({
        mcpUrl: session.mcp.url,
        mcpHeaders: session.mcp.headers,
      })
    }

    if (action === 'authorize') {
      if (!appName) return NextResponse.json({ error: 'appName required' }, { status: 400 })
      const origin = req.headers.get('origin') ?? 'https://ainative-frontend.vercel.app'
      const callbackUrl = `${origin}/dashboard?composio_connected=${appName}`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connReq = await (session as any).authorize(appName, { callbackUrl })
      return NextResponse.json({ authUrl: connReq.redirectUrl })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
