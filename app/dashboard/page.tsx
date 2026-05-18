import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { DashboardClient } from './dashboard-client'
import type { DashboardConfig } from '@/app/api/generate-dashboard/route'

export default async function DashboardPage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 未登录或匿名用户 → 跳转登录
  if (!user || user.is_anonymous) {
    redirect('/login')
  }

  // 获取用户的 tenant（含 metadata）
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // 没有 dashboard_config → 跳转 onboarding 生成
  const dashboardConfig: DashboardConfig | null =
    tenant?.metadata?.dashboard_config ?? null

  if (!dashboardConfig) {
    redirect('/onboarding')
  }

  // 获取 API Keys
  const { data: apiKeys } = tenant
    ? await supabase
        .from('tenant_api_keys')
        .select('id, name, key_prefix, created_at, revoked_at')
        .eq('tenant_id', tenant.id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
    : { data: [] }

  // 获取 Projects
  const { data: projects } = tenant
    ? await supabase
        .from('projects')
        .select('id, name, slug, status, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <DashboardClient
      user={user}
      tenant={tenant}
      apiKeys={apiKeys ?? []}
      projects={projects ?? []}
      dashboardConfig={dashboardConfig}
    />
  )
}
