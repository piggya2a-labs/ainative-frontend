import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/agent-notes?agent_id=xxx
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agent_id')
  if (!agentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

  const { data, error } = await adminClient
    .from('agent_memory')
    .select('id, content, created_at')
    .eq('agent_id', agentId)
    .contains('tags', ['wiki'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notes: data ?? [] })
}

// POST /api/agent-notes  { agent_id, content }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.agent_id || !body?.content) {
    return NextResponse.json({ error: 'agent_id and content required' }, { status: 400 })
  }

  const key = `wiki-${Date.now()}`
  const { data, error } = await adminClient
    .from('agent_memory')
    .insert({
      agent_id: body.agent_id,
      key,
      content: body.content,
      tags: ['wiki', 'user-note'],
    })
    .select('id, content, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data })
}
