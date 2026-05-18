import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const revalidate = 60 // ISR: 60s cache

export async function GET() {
  const { data, error } = await supabase
    .from('agent_registry')
    .select('id, name, type, description, url, enabled, skills, capabilities, tags, icon_url')
    .eq('type', 'agent')
    .eq('enabled', true)
    .order('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ agents: data ?? [] })
}
