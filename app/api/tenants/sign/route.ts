import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const adminClient = createClient(supabaseUrl, serviceRoleKey)

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// POST /api/tenants/sign
// Body: { tenant_id: string, milestone: 'M1' | 'M3' }
// 将 metadata.mcsp.signed_m1 或 signed_m3 设为 true，并在 update_log 追加一条记录
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenant_id, milestone } = await req.json()
  if (!tenant_id || !['M1', 'M3'].includes(milestone)) {
    return NextResponse.json({ error: 'tenant_id and milestone (M1|M3) required' }, { status: 400 })
  }

  // 验证归属
  const { data: tenant, error: fetchErr } = await adminClient
    .from('tenants')
    .select('id, metadata')
    .eq('id', tenant_id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !tenant) {
    return NextResponse.json({ error: 'Tenant not found or unauthorized' }, { status: 404 })
  }

  const meta = tenant.metadata || {}
  const mcsp = meta.mcsp || {}
  const updateLog = meta.update_log || []

  // 设置签认标志
  const signedKey = milestone === 'M1' ? 'signed_m1' : 'signed_m3'
  const updatedMcsp = { ...mcsp, [signedKey]: true }

  // 追加 update_log 记录
  const logEntry = {
    ts: new Date().toISOString().slice(0, 10),
    icon: '✅',
    text: `${milestone} 双方签认完成`,
    author: '@客户',
  }
  const updatedLog = [...updateLog, logEntry]

  // 同时更新 milestones 里对应 milestone 的 signed 字段
  const milestones = (meta.milestones || []).map((m: { id: string; [key: string]: unknown }) => {
    if (m.id === milestone) return { ...m, signed: true }
    return m
  })

  const updatedMeta = {
    ...meta,
    mcsp: updatedMcsp,
    update_log: updatedLog,
    milestones,
  }

  const { error: updateErr } = await adminClient
    .from('tenants')
    .update({ metadata: updatedMeta })
    .eq('id', tenant_id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, milestone, signed: true })
}
