import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 从请求 header 里读 JWT，服务端验证用户身份
async function getAuthorFromRequest(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return 'anonymous'

  const token = authHeader.slice(7)
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await userClient.auth.getUser()
  return user?.email ?? 'anonymous'
}

// GET /api/agent-notes?agent_id=xxx
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agent_id')
  if (!agentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

  const { data, error } = await adminClient
    .from('agent_registry')
    .select('wiki')
    .eq('id', agentId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const notes = (data?.wiki ?? []) as Array<{ content: string; created_at: string; author?: string }>
  notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ notes })
}

// POST /api/agent-notes  { agent_id, content }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.agent_id || !body?.content) {
    return NextResponse.json({ error: 'agent_id and content required' }, { status: 400 })
  }

  // 服务端从 JWT 读取用户邮箱，不信任前端传的 author
  const author = await getAuthorFromRequest(req)

  const { data: current, error: readErr } = await adminClient
    .from('agent_registry')
    .select('wiki')
    .eq('id', body.agent_id)
    .single()

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })

  const newEntry = {
    content: body.content,
    created_at: new Date().toISOString(),
    author,
  }

  const updatedWiki = [...((current?.wiki ?? []) as object[]), newEntry]

  const { error: writeErr } = await adminClient
    .from('agent_registry')
    .update({ wiki: updatedWiki })
    .eq('id', body.agent_id)

  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 })
  return NextResponse.json({ note: newEntry })
}
