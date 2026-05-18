import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { DashboardClient } from './dashboard-client'

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

  if (!user || user.is_anonymous) {
    redirect('/login')
  }

  // Tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, status, created_at')
    .eq('user_id', user.id)
    .single()

  // API Keys
  const { data: apiKeys } = tenant
    ? await supabase
        .from('tenant_api_keys')
        .select('id, name, key_prefix, created_at, last_used_at')
        .eq('tenant_id', tenant.id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
    : { data: [] }

  // Agents（只取 type=agent 的内部团队成员，供 Dashboard 团队表格展示）
  const { data: agents } = await supabase
    .from('agent_registry')
    .select('id, name, description, tags, enabled, skills, capabilities, updated_at')
    .eq('type', 'agent')
    .eq('enabled', true)
    .order('created_at', { ascending: true })

  // MCP Tools（enabled 的 cap_ 工具 = 已接入的 MCP 能力）
  const { data: mcpTools } = await supabase
    .from('tool_registry')
    .select('id, tool_name, category, annotations')
    .eq('enabled', true)
    .like('tool_name', 'cap_%')
    .order('created_at', { ascending: true })

  // GitHub 集成状态（从 github_installation_bindings 读）
  const { data: githubBindings } = tenant
    ? await supabase
        .from('github_installation_bindings')
        .select('id, repository_full_name, status, created_at')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
    : { data: [] }

  // Channel connectors（渠道连接状态）
  const { data: connectors } = tenant
    ? await supabase
        .from('tenant_connectors')
        .select('id, agent_id, status, metadata, created_at')
        .eq('tenant_id', tenant.id)
    : { data: [] }

  // Recent audit logs（最近 10 条系统活动）
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('id, action, resource_type, status, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <DashboardClient
      user={user}
      tenant={tenant}
      initialApiKeys={apiKeys ?? []}
      agents={agents ?? []}
      mcpTools={mcpTools ?? []}
      githubBindings={githubBindings ?? []}
      connectors={connectors ?? []}
      auditLogs={auditLogs ?? []}
    />
  )
}
