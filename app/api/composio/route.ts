import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Composio } from 'composio-core'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY ?? 'ak_-aUDQkqioskA4DkOiF0u' })

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

// GET /api/composio — 列出当前用户已连接的服务
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const list = await composio.connectedAccounts.list({ entityId: user.id })
    const connections = (list.items ?? [])
      .filter((item: Record<string, unknown>) => item.status === 'ACTIVE')
      .map((item: Record<string, unknown>) => ({
        id: item.id,
        appName: item.appName,
        status: item.status,
        createdAt: item.createdAt,
      }))
    return NextResponse.json({ connections })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/composio — 发起 Composio Connect Link 授权
// body: { appName: string, redirectUrl?: string }
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const appName = body.appName as string
  if (!appName) return NextResponse.json({ error: 'appName required' }, { status: 400 })

  const origin = req.headers.get('origin') ?? 'https://onit.ai'
  const callbackUrl = body.redirectUrl ?? `${origin}/dashboard?composio_connected=${appName}`

  try {
    const conn = await composio.connectedAccounts.initiate({
      appName,
      entityId: user.id,
      redirectUri: callbackUrl,
    })
    return NextResponse.json({
      redirectUrl: conn.redirectUrl,
      connectedAccountId: conn.connectedAccountId,
      connectionStatus: conn.connectionStatus,
    })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/composio?id=xxx — 断开连接
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    await composio.connectedAccounts.delete({ connectedAccountId: id })
    return NextResponse.json({ success: true })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
