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

  // 用户在 Marketplace 已连接的外部 MCP（从 tenant_connectors 读取）
  const { data: mcpConnectors } = tenant
    ? await supabase
        .from('tenant_connectors')
        .select('id, agent_id, status, metadata, created_at, discovered_tools')
        .eq('tenant_id', tenant.id)
        .eq('status', 'connected')
        .order('created_at', { ascending: false })
    : { data: [] }

  // 拿到 agent_registry 里对应的名字和描述
  const mcpAgentIds = (mcpConnectors ?? []).map(c => c.agent_id).filter(Boolean)
  const { data: mcpAgentCards } = mcpAgentIds.length > 0
    ? await supabase
        .from('agent_registry')
        .select('id, name, description, skills')
        .in('id', mcpAgentIds)
    : { data: [] }

  // 合并成前端需要的格式
  const mcpTools = (mcpConnectors ?? []).map(c => {
    const card = (mcpAgentCards ?? []).find(a => a.id === c.agent_id)
    return {
      id: c.id,
      agent_id: c.agent_id,
      name: card?.name ?? c.agent_id,
      description: card?.description ?? '',
      skills: (card?.skills ?? []) as Array<{ id: string; name: string; description: string }>,
      connected_at: c.created_at,
    }
  })

  // GitHub 集成状态（从 github_installation_bindings 读）
  const { data: githubBindings } = tenant
    ? await supabase
        .from('github_installation_bindings')
        .select('id, repository_full_name, status, created_at')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
    : { data: [] }

  // Channel connectors（渠道连接状态，用于 Integrations 区块）
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
      agents={[]}
      mcpTools={mcpTools}
      githubBindings={githubBindings ?? []}
      connectors={connectors ?? []}
      auditLogs={auditLogs ?? []}
    />
  )
}
