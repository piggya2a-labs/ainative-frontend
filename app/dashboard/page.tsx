import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'

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
  // ⚠️ 必须用 adminClient（service_role）查询，tenants 表 RLS 对 anon key 不开放 SELECT
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  console.log('[DEBUG] user.id:', user.id)
  console.log('[DEBUG] SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY, 'length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length)
  const { data: tenantsRaw, error: tenantsError } = await adminClient
    .from('tenants')
    .select('id, name, slug, status, created_at, metadata, composio_token, composio_connected_at, api_key, api_key_created_at, telegram_chat_id, telegram_username, telegram_bound_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  console.log('[DEBUG] tenantsRaw count:', tenantsRaw?.length, 'error:', JSON.stringify(tenantsError))

  // ─── 自动初始化 MCSP metadata（对每个未初始化的 tenant 执行）──────────────
  const tenants = await Promise.all(
    (tenantsRaw ?? []).map(async (t) => {
      if (!(t.metadata as Record<string, unknown> | null)?.share_token) {
        const defaultMeta = buildDefaultMcspMetadata(t.name, t.slug, t.created_at)
        const { data: updated, error: updateError } = await adminClient
          .from('tenants')
          .update({ metadata: defaultMeta })
          .eq('id', t.id)
          .select('id, name, slug, status, created_at, metadata, composio_token, composio_connected_at, api_key, api_key_created_at, telegram_chat_id, telegram_username, telegram_bound_at')
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

  // 连接器从 tenants.metadata.connectors 读（tenant_connectors 表已删）
  type ConnectorEntry = { id: string; agent_id: string; status: 'connected' | 'pending_start' | 'pending_verify' | 'disconnected' | 'error'; metadata: Record<string, unknown> | null; connected_at?: string | null; created_at: string }
  const tenantConnectors: ConnectorEntry[] = ((tenant as Record<string, unknown> | null)?.metadata as Record<string, unknown> | null)?.connectors as ConnectorEntry[] ?? []
  const mcpConnectors = tenantConnectors.filter(c => c.status === 'connected')
  const mcpAgentIds = mcpConnectors.map(c => c.agent_id).filter(Boolean)
  const { data: mcpAgentCards } = mcpAgentIds.length > 0
    ? await supabase
        .from('agent_market')
        .select('id, name, description, skills, icon_url, mcp_url, url')
        .in('id', mcpAgentIds)
    : { data: [] }
  const mcpTools = mcpConnectors.map(c => {
    const card = (mcpAgentCards ?? []).find(a => a.id === c.agent_id)
    return {
      id: c.agent_id,
      agent_id: c.agent_id,
      name: card?.name ?? c.agent_id,
      description: card?.description ?? '',
      skills: (card?.skills ?? []) as Array<{ id: string; name: string; description: string }>,
      connected_at: c.connected_at ?? null,
      icon_url: card?.icon_url ?? null,
      mcp_url: card?.mcp_url ?? null,
      url: card?.url ?? null,
    }
  })

  // GitHub bindings 和 audit_logs 表已删，用空数组占位
  const githubBindings: Array<{ id: string; repository_full_name: string; status: string; created_at: string }> = []
  const connectors = tenantConnectors
  const auditLogs: Array<{ id: string; action: string; resource_type: string; status: string; metadata?: { actor?: string; cost_usd?: number; [key: string]: unknown }; created_at: string }> = []

  // ─── Composio 连接状态（从 tenants 表读，单一来源）──────────────────────────────
  const composioToken = (tenant as Record<string, unknown> | null)?.composio_token as string | null
  const composioConnected = !!composioToken


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

        // connected_agents 字段已删，不再同步写入
      }
    } catch {
      // 查询失败不影响页面加载
    }
  }

  // ─── 合并：Composio 工具 + 用户手动开启的 agent ──────────────────────────────────────────────
  const allAgents: ComposioAgent[] = [...composioAgents]
  const agentCount = allAgents.length

  const siteConfig = await getSiteConfig()

  // DEBUG: 临时显示 tenants 数量
  const debugInfo = `tenants:${tenants.length} raw:${tenantsRaw?.length ?? 'null'} err:${tenantsError?.message ?? 'none'} uid:${user.id.slice(0,8)}`

  return (
    <>
      <Navbar siteConfig={siteConfig} />
      <div style={{background:'red',color:'white',padding:'4px',fontSize:'10px',fontFamily:'monospace'}}>{debugInfo}</div>
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
    </>
  )
}
