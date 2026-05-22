'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SubmitMcpDialog } from '@/components/submit-mcp-dialog'
import { AgentCard, type AgentRecord } from '@/components/agent-card'
import { Plus, Search, X } from 'lucide-react'
import { toast } from '@/components/ui/sonner'
import type { MarketplaceAgentItem, AgentSkill } from '@/lib/database.types'
import { createClient as createBrowserClient } from '@/lib/supabase-client'

interface Props {
  initialAgents: MarketplaceAgentItem[]
  groupLabel: string
  emptyState: string
  addButton: string
}

// 分类 tab 定义
const TABS = [
  { value: 'all',     label: '全部' },
  { value: 'mcp',     label: 'MCP' },
  { value: 'openapi', label: 'OpenAPI' },
  { value: 'native',  label: 'Native' },
  { value: 'browser', label: 'Browser' },
] as const

type TabValue = typeof TABS[number]['value']

function getTabForAgent(connector_type: string | null): TabValue {
  switch (connector_type) {
    case 'mcp':     return 'mcp'
    case 'openapi': return 'openapi'
    case 'native':  return 'native'
    case 'browser': return 'browser'
    default:        return 'mcp'   // a2a / webhook / cli → 归入 mcp
  }
}

function toAgentRecord(agent: MarketplaceAgentItem, isConnected: boolean): AgentRecord {
  return {
    id: agent.id,
    name: agent.name,
    type: 'external',
    description: agent.description,
    version: null,
    tags: agent.tags,
    skills: agent.skills as AgentRecord['skills'],
    mcp_url: agent.mcp_url,
    documentation_url: agent.documentation_url,
    icon_url: agent.icon_url,
    provider: agent.provider,
    connector_type: agent.connector_type,
    updated_at: agent.updated_at,
    supported_interfaces: agent.mcp_url
      ? [{ url: agent.mcp_url, protocol: 'MCP', transport: 'HTTP' }]
      : undefined,
    isConnected,
  }
}

export function MarketplaceClient({ initialAgents, groupLabel, emptyState, addButton }: Props) {
  const posthog = usePostHog()
  const supabase = createBrowserClient()
  const [agents] = useState<MarketplaceAgentItem[]>(initialAgents)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [connectedMap, setConnectedMap] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabValue>('all')

  const fetchConnected = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('metadata')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    const connectors = (tenantRow?.metadata as Record<string, unknown> | null)?.connectors as Array<{ agent_id: string; status: string }> ?? []
    const map: Record<string, string> = {}
    connectors.filter(c => c.status === 'connected').forEach(c => { map[c.agent_id] = c.agent_id })
    setConnectedMap(map)
  }, [supabase])

  useEffect(() => {
    fetchConnected()
    posthog?.capture('page_view', { page: 'marketplace' })
  }, [fetchConnected, posthog])

  async function handleConnect(record: AgentRecord) {
    const agent = agents.find((a) => a.id === record.id)
    if (!agent) return
    posthog?.capture('marketplace_agent_connect_click', { agent_id: agent.id, agent_name: agent.name })
    setConnecting(agent.id)
    try {
      let accessToken: string | null = null
      try {
        const cookieName = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]}-auth-token`
        const cookieVal = document.cookie.split('; ').find(r => r.startsWith(cookieName + '='))?.split('=').slice(1).join('=')
        if (cookieVal) {
          let rawVal = decodeURIComponent(cookieVal)
          if (rawVal.startsWith('base64-')) rawVal = rawVal.slice(7)
          try {
            const decoded = JSON.parse(atob(rawVal))
            accessToken = decoded.access_token ?? decoded[0]?.access_token ?? null
          } catch {
            try { const decoded = JSON.parse(rawVal); accessToken = decoded.access_token ?? null } catch {}
          }
        }
      } catch {}
      if (!accessToken) {
        const { data: sessionData } = await supabase.auth.getSession()
        accessToken = sessionData?.session?.access_token ?? null
      }
      if (!accessToken) { setConnecting(null); return }
      const EDGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-connector-register`
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
        body: JSON.stringify({ agent_id: agent.id, connector_type: agent.connector_type ?? 'custom', mcp_url: agent.mcp_url }),
      })
      const data = await res.json()
      if (data?.authorization_url) { window.location.href = data.authorization_url; return }
      if (!res.ok) {
        toast.error(`连接失败：${data?.error ?? '请稍后重试'}`)
      } else {
        await fetchConnected()
        toast.success(`已连接 ${agent.name}`)
        posthog?.capture('marketplace_agent_connect_success', { agent_id: agent.id })
      }
    } catch (e) {
      toast.error('连接失败，请检查网络后重试')
      console.error(e)
    }
    finally { setConnecting(null) }
  }

  async function handleDisconnect(record: AgentRecord) {
    const connectorId = connectedMap[record.id]
    if (!connectorId) return
    setDisconnecting(record.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setConnectedMap((prev) => { const next = { ...prev }; delete next[record.id]; return next })
      posthog?.capture('marketplace_agent_disconnect_success', { agent_id: record.id })
    } catch {}
    finally { setDisconnecting(null) }
  }

  // 先按 tab 过滤，再按搜索词过滤
  const filteredAgents = useMemo(() => {
    let result = agents
    // tab 过滤
    if (activeTab !== 'all') {
      result = result.filter(a => getTabForAgent(a.connector_type) === activeTab)
    }
    // 搜索词过滤
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter((a) => {
        const skills = (Array.isArray(a.skills) ? a.skills : []) as AgentSkill[]
        return a.name.toLowerCase().includes(q) ||
          (a.description ?? '').toLowerCase().includes(q) ||
          (a.provider ?? '').toLowerCase().includes(q) ||
          skills.some((s) => s.id.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q))
      })
    }
    return result
  }, [agents, query, activeTab])

  // 各 tab 的 agent 数量
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: agents.length }
    for (const tab of TABS.slice(1)) {
      counts[tab.value] = agents.filter(a => getTabForAgent(a.connector_type) === tab.value).length
    }
    return counts
  }, [agents])

  const totalSkills = agents.reduce((sum, a) => sum + (Array.isArray(a.skills) ? a.skills.length : 0), 0)

  return (
    <>
      {/* ── 搜索 + 添加 ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="搜索 Agent 名称、工具、描述…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-9 h-9 text-sm"
          />
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setQuery('')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => { posthog?.capture('marketplace_submit_mcp_open'); setSubmitOpen(true) }}
        >
          <Plus className="w-3.5 h-3.5" />{addButton}
        </Button>
      </div>

      {/* ── 分类 Tabs ── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="mb-6">
        <TabsList variant="line" className="h-9 w-full justify-start gap-0 rounded-none border-b border-border px-0">
          {TABS.map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="px-4 h-9 text-sm font-medium gap-2"
            >
              {tab.label}
              {tabCounts[tab.value] > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  {tabCounts[tab.value]}
                </span>
              )}
            </TabsTrigger>
          ))}
          {/* 右侧统计 */}
          <span className="ml-auto flex items-center text-xs text-muted-foreground font-mono pr-1 self-center">
            {agents.length} agents · {totalSkills.toLocaleString()} tools
          </span>
        </TabsList>
      </Tabs>

      {/* ── 空状态 ── */}
      {agents.length === 0 && (
        <div className="text-center py-24">
          <p className="text-sm text-muted-foreground font-mono mb-4">{emptyState}</p>
          <Button variant="outline" onClick={() => { posthog?.capture('marketplace_submit_mcp_open', { source: 'empty_state' }); setSubmitOpen(true) }}>
            <Plus className="w-3.5 h-3.5 mr-2" />{addButton}
          </Button>
        </div>
      )}

      {agents.length > 0 && filteredAgents.length === 0 && (
        <div className="text-center py-24">
          <p className="text-sm text-muted-foreground mb-2">
            {query ? `没有找到匹配 "${query}" 的 Agent` : `该分类暂无 Agent`}
          </p>
          {query && (
            <button className="text-xs text-muted-foreground underline" onClick={() => setQuery('')}>
              清除搜索
            </button>
          )}
        </div>
      )}

      {/* ── Agent 卡片网格 ── */}
      {filteredAgents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={toAgentRecord(agent, !!connectedMap[agent.id])}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              connecting={connecting === agent.id}
              disconnecting={disconnecting === agent.id}
            />
          ))}
        </div>
      )}

      <SubmitMcpDialog open={submitOpen} onOpenChange={setSubmitOpen} onSuccess={() => setSubmitOpen(false)} />
    </>
  )
}
