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

  // ─── 取当前用户的所有 tenant（含新字段）───────────────────────────────────────────────
  const { data: tenantsRaw } = await supabase
    .from('tenants')
    .select('id, name, slug, status, created_at, metadata, composio_token, composio_connected_at, connected_agents, display_name, avatar_url')
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
          .select('id, name, slug, status, created_at, metadata, composio_token, composio_connected_at, connected_agents, display_name, avatar_url')
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

  // ─── Composio 连接状态（从 tenants 表读，单一来源）──────────────────────────────
  const composioToken = (tenant as Record<string, unknown> | null)?.composio_token as string | null
  const composioConnected = !!composioToken

  // ─── COMPOSIO KEY 说明（防回退注释，勿删）────────────────────────────────────────
  // tenants.composio_token 存的是 x-consumer-api-key（ck_ 开头），不是 OAuth access_token
  // 用用户自己的 consumer key 查询天然按用户隔离，不需要 admin key 也不需要 entityId
  // 错误做法：用 x-api-key 传 access_token，或用 Bearer 传任何 key → 永远 401
  // ─────────────────────────────────────────────────────────────────────────────────
  // ─── Composio 已连接工具列表（用用户自己的 consumer key 查，天然按用户隔离）──────
  type ComposioAgent = { id: string; name: string; icon_url?: string | null; mcp_url?: string | null; url?: string | null; description?: string | null }
  let composioAgents: ComposioAgent[] = []
  let composioToolCount = 0

  if (composioConnected) {
    try {
      const res = await fetch(
        'https://backend.composio.dev/api/v1/connectedAccounts?limit=100',
        {
          headers: { 'x-consumer-api-key': composioToken }, // 用用户自己的 consumer key，天然隔离
          next: { revalidate: 60 },
        }
      )
      if (res.ok) {
        const data = await res.json() as { items?: Array<{ id: string; appName?: string; appUniqueId?: string; logo?: string; status?: string }> }
        const items = data.items ?? []
        composioToolCount = items.length
        composioAgents = items.map((item) => {
          const appName = item.appName ?? item.appUniqueId ?? item.id
          const domain = appName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
          return {
            id: `composio-${item.id}`,
            name: appName.charAt(0).toUpperCase() + appName.slice(1),
            icon_url: item.logo ?? null,
            mcp_url: null,
            url: `https://${domain}`,
            description: item.status === 'EXPIRED' ? '需重新授权' : 'via Composio',
          }
        })

        // 同步更新 tenants.connected_agents（后台静默写入，不阻塞渲染）
        if (tenant) {
          const appNames = items.map(i => (i.appName ?? '').toLowerCase()).filter(Boolean)
          void adminClient
            .from('tenants')
            .update({ connected_agents: appNames })
            .eq('id', tenant.id)
        }
      }
    } catch {
      // 查询失败不影响页面加载
    }
  }

  // ─── 合并：Composio 工具 + 用户手动开启的 agent ──────────────────────────────────────────────
  const allAgents: ComposioAgent[] = [...composioAgents]
  const agentCount = allAgents.length

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
