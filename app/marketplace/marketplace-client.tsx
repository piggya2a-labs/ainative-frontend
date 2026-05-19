'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SubmitMcpDialog } from '@/components/submit-mcp-dialog'
import { Plus, Plug, CheckCircle2, Loader2, Search, ExternalLink, Zap, X, Unplug } from 'lucide-react'
import { relativeTime, formatDate } from '@/lib/utils'
import type { MarketplaceAgentItem, AgentSkill } from '@/lib/database.types'
import { createClient as createBrowserClient } from '@/lib/supabase-client'

// 将 connector_type / tags 映射为友好的角色标签
const TYPE_LABELS: Record<string, string> = {
  mcp: 'MCP',
  openapi: 'OpenAPI',
  custom: '外部',
  platform: '平台',
  preset: '核心',
}

function getTypeLabel(agent: MarketplaceAgentItem): string {
  if (agent.connector_type && TYPE_LABELS[agent.connector_type]) {
    return TYPE_LABELS[agent.connector_type]
  }
  if (agent.mcp_url) return 'MCP'
  return '外部'
}

interface Props {
  initialAgents: MarketplaceAgentItem[]
  groupLabel: string
  emptyState: string
  addButton: string
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
  const [detailAgent, setDetailAgent] = useState<MarketplaceAgentItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

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

  async function handleConnect(agent: MarketplaceAgentItem) {
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
      await fetchConnected()
      posthog?.capture('marketplace_agent_connect_success', { agent_id: agent.id })
    } catch {}
    finally { setConnecting(null) }
  }

  async function handleDisconnect(agent: MarketplaceAgentItem) {
    const connectorId = connectedMap[agent.id]
    if (!connectorId) return
    setDisconnecting(agent.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await supabase.from('tenant_connectors').delete().eq('id', connectorId)
      setConnectedMap((prev) => { const next = { ...prev }; delete next[agent.id]; return next })
      posthog?.capture('marketplace_agent_disconnect_success', { agent_id: agent.id })
    } catch {}
    finally { setDisconnecting(null) }
  }

  function openDetail(agent: MarketplaceAgentItem) {
    setDetailAgent(agent); setDetailOpen(true)
    posthog?.capture('marketplace_agent_detail_open', { agent_id: agent.id })
  }

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

      {/* Agent 卡片网格 —— 和 /agents 核心团队完全一致的布局 */}
      {filteredAgents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => {
            const skills = (Array.isArray(agent.skills) ? agent.skills : []) as AgentSkill[]
            const isConnected = !!connectedMap[agent.id]
            const isConnecting = connecting === agent.id
            const typeLabel = getTypeLabel(agent)

            return (
              <div
                key={agent.id}
                className="p-5 rounded-lg border border-border hover:border-foreground/20 transition-colors flex flex-col gap-3"
              >
                {/* Header row：名字（可点击）+ 连接状态 Badge */}
                <div className="flex items-start justify-between gap-2">
                  <button
                    className="text-sm font-semibold leading-snug text-left hover:underline cursor-pointer"
                    onClick={() => openDetail(agent)}
                  >
                    {agent.name}
                  </button>
                  <Badge
                    variant="outline"
                    className={`text-xs shrink-0 ${
                      isConnected
                        ? 'bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.55_0.15_145)] border-[oklch(0.65_0.15_145)]/20'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {isConnected ? '已连接' : '未连接'}
                  </Badge>
                </div>

                {/* 描述 */}
                {agent.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {agent.description}
                  </p>
                )}

                {/* 底部胶囊行：类型标签 + 时间 + 技能胶囊 */}
                <div className="flex items-center gap-2 flex-wrap mt-auto">
                  <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
                  {agent.updated_at && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="text-[10px] text-muted-foreground font-mono ml-auto cursor-default">
                          {relativeTime(agent.updated_at)}
                        </TooltipTrigger>
                        <TooltipContent>{formatDate(agent.updated_at)}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {skills.slice(0, 3).map((s) => (
                    <Badge key={s.id} variant="outline" className="text-xs font-mono">
                      {s.name ?? s.id}
                    </Badge>
                  ))}
                  {skills.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{skills.length - 3}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog 详情弹窗 —— 和 /agents 的 Dialog 完全对齐 */}
      <Dialog open={detailOpen} onOpenChange={(v) => !v && setDetailOpen(false)}>
        {detailAgent && (() => {
          const skills = (Array.isArray(detailAgent.skills) ? detailAgent.skills : []) as AgentSkill[]
          const isConnected = !!connectedMap[detailAgent.id]
          const isConnecting = connecting === detailAgent.id
          const isDisconnecting = disconnecting === detailAgent.id
          const typeLabel = getTypeLabel(detailAgent)
          return (
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle>{detailAgent.name}</DialogTitle>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      isConnected
                        ? 'bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.55_0.15_145)] border-[oklch(0.65_0.15_145)]/20'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {isConnected ? '已连接' : '未连接'}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
                </div>
                {detailAgent.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    {detailAgent.description}
                  </p>
                )}
              </DialogHeader>

              <div className="space-y-4 mt-1">
                {/* MCP Endpoint */}
                {detailAgent.mcp_url && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">MCP Endpoint</p>
                    <code className="text-xs font-mono bg-muted px-2 py-1.5 rounded block break-all">{detailAgent.mcp_url}</code>
                  </div>
                )}

                {/* 技能列表 */}
                {skills.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">工具 · {skills.length}</span>
                    </div>
                    <div className="space-y-2">
                      {skills.map((skill) => (
                        <div key={skill.id} className="flex items-start gap-2">
                          <span className="text-xs font-medium text-foreground shrink-0 min-w-[80px] font-mono">
                            {skill.name ?? skill.id}
                          </span>
                          {skill.description && (
                            <span className="text-xs text-muted-foreground leading-relaxed">
                              {skill.description}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 文档链接 */}
                {detailAgent.documentation_url && (
                  <a
                    href={detailAgent.documentation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />查看文档
                  </a>
                )}

                {/* Connect / Disconnect 操作 */}
                <div className="pt-2 border-t border-border">
                  {isConnected ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                      disabled={isDisconnecting}
                      onClick={() => handleDisconnect(detailAgent)}
                    >
                      {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unplug className="w-3 h-3" />}
                      {isDisconnecting ? '断开中…' : '断开连接'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1.5"
                      disabled={isConnecting}
                      onClick={() => handleConnect(detailAgent)}
                    >
                      {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plug className="w-3 h-3" />}
                      {isConnecting ? '连接中…' : '连接 Agent'}
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          )
        })()}
      </Dialog>

      <SubmitMcpDialog open={submitOpen} onOpenChange={setSubmitOpen} onSuccess={() => setSubmitOpen(false)} />
    </>
  )
}
