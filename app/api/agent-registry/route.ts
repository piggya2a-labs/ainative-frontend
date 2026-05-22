import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data, error } = await supabase
      .from('agent_registry')
      .select('id, name, type, langsmith_handle, enabled, tags, url, description')
      .eq('type', 'system')
      .eq('enabled', true)
      .order('name')

    if (error) throw error
    return NextResponse.json({ agents: data ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
