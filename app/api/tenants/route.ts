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

// slug 生成：name 转小写 + 去所有非 a-z0-9 字符（含中文）+ 8位随机 hex
// ⚠️ 数据库约束 tenants_slug_format_check 只允许 [a-z0-9-]，中文必须去掉
function buildSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')  // 中文、空格、特殊字符全部转 -
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'project'
  const suffix = Math.random().toString(16).slice(2, 10)
  return `${base}-${suffix}`
}

// GET /api/tenants — 列出当前用户所有 tenant
export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 支持 ?id= 查询单个 tenant（轮询用）
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const { data, error } = await adminClient
      .from('tenants')
      .select('id, name, slug, status, created_at, metadata')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ tenant: data })
  }

  const { data, error } = await adminClient
    .from('tenants')
    .select('id, name, slug, status, created_at, metadata')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tenants: data })
}

// POST /api/tenants — 创建新 tenant（新建看板）
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const slug = buildSlug(name.trim())

  const { data, error } = await adminClient
    .from('tenants')
    .insert({
      user_id: user.id,
      name: name.trim(),
      slug,
      status: 'triage',
    })
    .select('id, name, slug, status, created_at, metadata')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tenant: data })
}

// PATCH /api/tenants?id=xxx — 改名
export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  // 验证归属
  const { data: existing } = await adminClient
    .from('tenants')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await adminClient
    .from('tenants')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('id, name, slug, status, created_at, metadata')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tenant: data })
}

// DELETE /api/tenants?id=xxx — 删除看板
export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 验证归属
  const { data: existing } = await adminClient
    .from('tenants')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await adminClient
    .from('tenants')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
