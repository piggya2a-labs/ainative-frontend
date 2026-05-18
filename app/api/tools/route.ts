import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const revalidate = 60 // ISR: 60s cache

export async function GET() {
  // Capability tools: annotations->>'visibility' = 'external'
  // These are the only tools exposed to external MCP clients
  const { data, error } = await supabase
    .from('tool_registry')
    .select('id, tool_name, description, category, annotations, owner_agent, enabled')
    .eq('owner_agent', 'platform')
    .eq('enabled', true)
    .filter('annotations->>visibility', 'eq', 'external')
    .order('category')
    .order('tool_name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tools: data ?? [] })
}
