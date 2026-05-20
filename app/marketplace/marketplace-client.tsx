'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  const fetchConnected = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase.from('tenant_connectors').select('id, agent_id').eq('status', 'connected')
    if (data) {
      const map: Record<string, string> = {}
      data.forEach((row: { id: string; agent_id: string }) => { map[row.agent_id] = row.id })
      setConnectedMap(map)
    }
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
      await supabase.from('tenant_connectors').delete().eq('id', connectorId)
      setConnectedMap((prev) => { const next = { ...prev }; delete next[record.id]; return next })
      posthog?.capture('marketplace_agent_disconnect_success', { agent_id: record.id })
    } catch {}
    finally { setDisconnecting(null) }
  }

  const filteredAgents = useMemo(() => {
    if (!query.trim()) return agents
    const q = query.toLowerCase()
    return agents.filter((a) => {
      const skills = (Array.isArray(a.skills) ? a.skills : []) as AgentSkill[]
      return a.name.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q) ||
        (a.provider ?? '').toLowerCase().includes(q) ||
        skills.some((s) => s.id.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q))
    })
  }, [agents, query])

  const totalSkills = agents.reduce((sum, a) => sum + (Array.isArray(a.skills) ? a.skills.length : 0), 0)

  return (
    <>
      {/* 搜索 + 添加 */}
      <div className="flex items-center gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="搜索 Agent、工具名、描述…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 pr-9 h-9 text-sm" />
          {query && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setQuery('')}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => { posthog?.capture('marketplace_submit_mcp_open'); setSubmitOpen(true) }}>
          <Plus className="w-3.5 h-3.5" />{addButton}
        </Button>
      </div>

      {/* 分组标题 */}
      {filteredAgents.length > 0 && (
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">{groupLabel}</h2>
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-mono">{filteredAgents.length} agents · {totalSkills} tools</span>
        </div>
      )}

      {/* 空状态 */}
      {agents.length === 0 && (
        <div className="text-center py-20">
          <p className="text-sm text-muted-foreground font-mono mb-4">{emptyState}</p>
          <Button variant="outline" onClick={() => { posthog?.capture('marketplace_submit_mcp_open', { source: 'empty_state' }); setSubmitOpen(true) }}>
            <Plus className="w-3.5 h-3.5 mr-2" />{addButton}
          </Button>
        </div>
      )}

      {agents.length > 0 && filteredAgents.length === 0 && (
        <div className="text-center py-20">
          <p className="text-sm text-muted-foreground">没有找到匹配 &ldquo;{query}&rdquo; 的 Agent 或工具</p>
          <button className="text-xs text-muted-foreground underline mt-2" onClick={() => setQuery('')}>清除搜索</button>
        </div>
      )}

      {/* Agent 卡片网格 —— 统一 AgentCard */}
      {filteredAgents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
