import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { DashboardClient } from './dashboard-client'

// ─── 只生成 share_token（MCSP 内容由 @Lumen 写入，不自动初始化）──────────────
function buildDefaultMcspMetadata(tenantName: string, tenantSlug: string, createdAt: string) {
  const shareToken = `${tenantSlug}-live-${new Date().getFullYear()}q${Math.ceil((new Date().getMonth() + 1) / 3)}`
  void tenantName; void createdAt; // 保留参数签名兼容性

  return {
    share_token: shareToken,
    // MCSP 内容由 @Lumen 写入，新建后保持空白
  }
}

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

  // ─── 取当前用户的所有 tenant ───────────────────────────────────────────────
  const { data: tenantsRaw } = await supabase
    .from('tenants')
    .select('id, name, slug, status, created_at, metadata')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  // ─── 自动初始化 MCSP metadata（对每个未初始化的 tenant 执行）──────────────
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const tenants = await Promise.all(
    (tenantsRaw ?? []).map(async (t) => {
      if (!(t.metadata as Record<string, unknown> | null)?.share_token) {
        const defaultMeta = buildDefaultMcspMetadata(t.name, t.slug, t.created_at)
        const { data: updated, error: updateError } = await adminClient
          .from('tenants')
          .update({ metadata: defaultMeta })
          .eq('id', t.id)
          .select('id, name, slug, status, created_at, metadata')
          .single()
        if (updateError) {
          console.error('[MCSP init] update error:', JSON.stringify(updateError))
        }
        return updated ?? { ...t, metadata: defaultMeta }
      }
      return t
    })
  )

  // 默认选中第一个 tenant（server 端只用于初始数据加载）
  const tenant = tenants[0] ?? null

  // API Keys（基于第一个 tenant，client 端切换时通过 URL 参数重新加载）
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
        .select('id, name, description, skills, icon_url, mcp_url, url')
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
      icon_url: card?.icon_url ?? null,
      mcp_url: card?.mcp_url ?? null,
      url: card?.url ?? null,
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

  // ─── Composio 连接状态（从 user_metadata 读取，刷新后不丢失）────────────────────────────────
  const composioMcp = (user.user_metadata as Record<string, unknown> | null)?.composio_mcp as Record<string, unknown> | null
  const composioConnected = !!(composioMcp?.access_token)

  // ─── Composio 已连接工具数（用用户自己的 token 查，按用户隔离）──────────────────────────
  let composioToolCount = 0
  if (composioConnected && composioMcp?.access_token) {
    try {
      const userToken = composioMcp.access_token as string
      const res = await fetch('https://backend.composio.dev/api/v1/connectedAccounts?status=ACTIVE&limit=100', {
        headers: { 'Authorization': `Bearer ${userToken}` },
        next: { revalidate: 60 },
      })
      if (res.ok) {
        const data = await res.json() as { items?: unknown[] }
        composioToolCount = data.items?.length ?? 0
      }
    } catch {
      // 查询失败不影响页面加载
    }
  }

  // ─── 平台可用 Agent 列表（头像墙用）──────────────────────────────────────────────────────────────
  const { data: allAgents, count: agentCount } = await adminClient
    .from('agent_registry')
    .select('id, name, icon_url, mcp_url, url', { count: 'exact' })
    .eq('enabled', true)
    .order('created_at', { ascending: false })

  return (
    <Suspense>
      <DashboardClient
        user={user}
        tenants={tenants}
        tenant={tenant}
        initialApiKeys={apiKeys ?? []}
        agents={[]}
        mcpTools={mcpTools}
        githubBindings={githubBindings ?? []}
        connectors={connectors ?? []}
        auditLogs={auditLogs ?? []}
        composioConnected={composioConnected}
        composioToolCount={composioToolCount}
        agentCount={agentCount ?? 0}
        allAgents={allAgents ?? []}
      />
    </Suspense>
  )
}
