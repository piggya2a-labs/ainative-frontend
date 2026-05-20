export const dynamic = 'force-dynamic'
// ⚠️ 防回退注释：
// API Key 现在存在 tenants.api_key 字段（单 key 设计，类似 Composio）。
// 不要引入 tenant_api_keys 表——该表已删除。
// 不要改成多 key 设计，一个用户只有一个 API key。
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
// Admin client for actual DB writes
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

async function getTenant(userId: string, preferredTenantId?: string | null) {
  if (preferredTenantId) {
    const { data } = await adminClient
      .from('tenants')
      .select('id, api_key, api_key_created_at')
      .eq('id', preferredTenantId)
      .eq('user_id', userId)
      .single()
    return data
  }
  const { data } = await adminClient
    .from('tenants')
    .select('id, api_key, api_key_created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  return data
}

// GET /api/keys — 返回当前用户的 API key（单 key 设计）
export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantIdParam = req.nextUrl.searchParams.get('tenant_id')
  const tenant = await getTenant(user.id, tenantIdParam)
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // 返回单个 key（或 null 表示未生成）
  return NextResponse.json({
    key: tenant.api_key
      ? {
          key_prefix: tenant.api_key.slice(0, 12),
          created_at: tenant.api_key_created_at,
          // 不返回完整 key，安全考虑
        }
      : null,
  })
}

// POST /api/keys — 生成（或重新生成）API key，写入 tenants.api_key
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(user.id)
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // Generate key: onit_<48 random hex chars>
  const rawKey = `onit_${randomBytes(24).toString('hex')}`
  const now = new Date().toISOString()

  const { error } = await adminClient
    .from('tenants')
    .update({
      api_key: rawKey,
      api_key_created_at: now,
    })
    .eq('id', tenant.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 返回完整 key 一次——之后只展示 prefix
  return NextResponse.json({
    key: rawKey,
    record: {
      key_prefix: rawKey.slice(0, 12),
      created_at: now,
    },
  })
}

// DELETE /api/keys — 清空 API key（revoke）
export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenant(user.id)
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { error } = await adminClient
    .from('tenants')
    .update({
      api_key: null,
      api_key_created_at: null,
    })
    .eq('id', tenant.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
