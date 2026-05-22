import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    // 查最近 10 次 pg_cron 调度记录（job_run_details 是 pg_cron 原生视图）
    const { data, error } = await supabase.rpc('get_dispatcher_log')

    if (error) throw error
    return NextResponse.json({ logs: data ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg, logs: [] }, { status: 200 })
  }
}
