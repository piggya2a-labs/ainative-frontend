import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/agent-notes?agent_id=xxx
// 从 agent_registry.wiki 读取经验笔记
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agent_id')
  if (!agentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

  const { data, error } = await adminClient
    .from('agent_registry')
    .select('wiki')
    .eq('id', agentId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // wiki 是 jsonb 数组，每条 { content, created_at, author }
  const notes = (data?.wiki ?? []) as Array<{ content: string; created_at: string; author?: string }>
  // 按时间倒序
  notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ notes })
}

// POST /api/agent-notes  { agent_id, content }
// 追加一条经验笔记到 agent_registry.wiki
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.agent_id || !body?.content) {
    return NextResponse.json({ error: 'agent_id and content required' }, { status: 400 })
  }

  // 先读当前 wiki
  const { data: current, error: readErr } = await adminClient
    .from('agent_registry')
    .select('wiki')
    .eq('id', body.agent_id)
    .single()

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })

  const newEntry = {
    content: body.content,
    created_at: new Date().toISOString(),
    author: body.author ?? 'user',
  }

  const updatedWiki = [...((current?.wiki ?? []) as object[]), newEntry]

  const { error: writeErr } = await adminClient
    .from('agent_registry')
    .update({ wiki: updatedWiki })
    .eq('id', body.agent_id)

  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 })
  return NextResponse.json({ note: newEntry })
}
