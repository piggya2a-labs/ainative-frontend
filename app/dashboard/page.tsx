import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { DashboardClient } from './dashboard-client'
import { Navbar } from '@/components/navbar'
import { getSiteConfig } from '@/lib/queries'

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
  // ⚠️ 防回退：api_key 和 api_key_created_at 在 tenants 表，不要用 tenant_api_keys 表（已删）
  // ⚠️ 防回退：telegram_chat_id/telegram_username/telegram_bound_at 在 tenants 表，不要用 telegram_bindings 表（已删）
  // ⚠️ 字段说明：display_name 和 avatar_url 是预留字段，目前没有任何地方读取展示，不需要写入逻辑。
  // ⚠️ 字段说明：connected_agents 由 Composio 查询结果异步写入，不用为渲染来源（渲染用实时 Composio 查询结果）。
  const { data: tenantsRaw } = await supabase
    .from('tenants')
    .select('id, name, slug, status, created_at, metadata, composio_token, composio_connected_at, connected_agents, display_name, avatar_url, api_key, api_key_created_at, telegram_chat_id, telegram_username, telegram_bound_at, zapier_mcp_url, pipedream_connected_at')
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
          .select('id, name, slug, status, created_at, metadata, composio_token, composio_connected_at, connected_agents, display_name, avatar_url, api_key, api_key_created_at, telegram_chat_id, telegram_username, telegram_bound_at, zapier_mcp_url, pipedream_connected_at')
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

  // API Keys（从 tenants 表读取单 key，不再用 tenant_api_keys 表——该表已删）
  // ⚠️ 防回退：不要改回 tenant_api_keys 表，一个用户只有一个 api_key 字段
  const apiKeyRecord = (tenant as Record<string, unknown> | null)?.api_key as string | null
  const apiKeyCreatedAt = (tenant as Record<string, unknown> | null)?.api_key_created_at as string | null
  const apiKeys = apiKeyRecord
    ? [{ key_prefix: apiKeyRecord.slice(0, 12), created_at: apiKeyCreatedAt }]
    : []

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

  // ─── Zapier 连接状态（从 tenants.zapier_mcp_url 读）──────────────────────────────
  const zapierMcpUrl = (tenant as Record<string, unknown> | null)?.zapier_mcp_url as string | null
  const zapierConnected = !!zapierMcpUrl

  // ─── Pipedream Connect 连接状态（从 tenants.pipedream_connected_at 读）──────────
  const pipedreamConnectedAt = (tenant as Record<string, unknown> | null)?.pipedream_connected_at as string | null
  const pipedreamConnected = !!pipedreamConnectedAt

  // ─── COMPOSIO 查询说明（防回退注释，勿删）──────────────────────────────────────
  // 正确做法：用平台 admin key（COMPOSIO_ADMIN_KEY）+ user_ids[]=user.id 查 v3.1 端点
  // Composio MCP OAuth 的 access_token 无法查 REST API，不要用它查 connectedAccounts
  // v3.1 端点返回 status 字段：ACTIVE / EXPIRED / INITIALIZING / INITIATED / FAILED
  // 全部状态都显示，前端根据 status 渲染不同颜色标记，不过滤任何状态
  // ─────────────────────────────────────────────────────────────────────────────────
  // ─── Composio 已连接工具列表（admin key + user_id 查，按 user_ids 隔离）──────────
  type ComposioAgent = { id: string; name: string; icon_url?: string | null; mcp_url?: string | null; url?: string | null; description?: string | null; status?: string | null }
  let composioAgents: ComposioAgent[] = []
  let composioToolCount = 0

  if (composioConnected) {
    try {
      const composioAdminKey = process.env.COMPOSIO_ADMIN_KEY ?? 'ak_n_8uO-2LCmcqCjhkwVQA'
      const res = await fetch(
        `https://backend.composio.dev/api/v3.1/connected_accounts?user_ids[]=${encodeURIComponent(user.id)}&limit=100`,
        {
          headers: { 'x-api-key': composioAdminKey },
          next: { revalidate: 60 },
        }
      )
      if (res.ok) {
        const data = await res.json() as { items?: Array<{ id: string; toolkit?: { slug?: string }; status?: string; created_at?: string }> }
        const items = data.items ?? []
        composioToolCount = items.length
        composioAgents = items.map((item) => {
          const slug = item.toolkit?.slug ?? item.id
          const appName = slug.charAt(0).toUpperCase() + slug.slice(1)
          const domain = slug.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
          const status = item.status ?? 'ACTIVE'
          return {
            id: `composio-${item.id}`,
            name: appName,
            icon_url: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
            mcp_url: null,
            url: `https://${domain}`,
            description: 'via Composio',
            status,
          }
        })

        // 同步更新 tenants.connected_agents（后台静默写入，不阻塞渲染）
        if (tenant) {
          const appNames = items.map(i => (i.toolkit?.slug ?? '').toLowerCase()).filter(Boolean)
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

  // ─── Pipedream 已连接应用列表（server-side 拉取，和 Composio 并排显示）──────────
  let pipedreamAgents: ComposioAgent[] = []
  if (pipedreamConnected) {
    try {
      const pdClientId = process.env.PIPEDREAM_CLIENT_ID ?? ''
      const pdClientSecret = process.env.PIPEDREAM_CLIENT_SECRET ?? ''
      const pdProjectId = process.env.PIPEDREAM_PROJECT_ID ?? ''
      const pdEnv = process.env.PIPEDREAM_ENVIRONMENT ?? 'production'
      if (pdClientId && pdClientSecret && pdProjectId) {
        // 先拿 access token
        const tokenRes = await fetch('https://api.pipedream.com/v1/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: pdClientId,
            client_secret: pdClientSecret,
          }).toString(),
        })
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json() as { access_token?: string }
          const pdAccessToken = tokenData.access_token ?? ''
          if (pdAccessToken) {
            const accountsRes = await fetch(
              `https://api.pipedream.com/v1/connect/${pdProjectId}/accounts?external_user_id=${encodeURIComponent(user.id)}&limit=100`,
              {
                headers: {
                  'Authorization': `Bearer ${pdAccessToken}`,
                  'x-pd-environment': pdEnv,
                },
                next: { revalidate: 60 },
              }
            )
            if (accountsRes.ok) {
              const accountsData = await accountsRes.json() as { data?: Array<{ id: string; app?: { name?: string; name_slug?: string; img_src?: string }; healthy?: boolean }> }
              pipedreamAgents = (accountsData.data ?? []).map((account) => {
                const slug = account.app?.name_slug ?? account.id
                const appName = account.app?.name ?? (slug.charAt(0).toUpperCase() + slug.slice(1))
                const domain = slug.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
                return {
                  id: `pipedream-${account.id}`,
                  name: appName,
                  icon_url: account.app?.img_src ?? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
                  mcp_url: null,
                  url: `https://${domain}`,
                  description: 'via Pipedream',
                  status: account.healthy !== false ? 'ACTIVE' : 'FAILED',
                }
              })
            }
          }
        }
      }
    } catch {
      // 查询失败不影响页面加载
    }
  }

  // ─── 合并：Composio 工具 + Pipedream 工具 + 用户手动开启的 agent ──────────────
  const allAgents: ComposioAgent[] = [...composioAgents, ...pipedreamAgents]
  const agentCount = allAgents.length

  const siteConfig = await getSiteConfig()

  return (
    <>
      <Navbar siteConfig={siteConfig} />
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
        zapierConnected={zapierConnected}
        pipedreamConnected={pipedreamConnected}
        agentCount={agentCount ?? 0}
        allAgents={allAgents ?? []}
        />
      </Suspense>
    </>
  )
}
