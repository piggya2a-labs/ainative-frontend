'use client'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import { createClient } from '@supabase/supabase-js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { SubmitMcpDialog } from '@/components/submit-mcp-dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Plug, CheckCircle2, Loader2, Search, MoreHorizontal, Unplug, ExternalLink, Zap, X } from 'lucide-react'
import { relativeTime, formatDate } from '@/lib/utils'
import type { MarketplaceAgentItem, AgentSkill } from '@/lib/database.types'
import { createClient as createBrowserClient } from '@/lib/supabase-client'

function firstSentence(text: string): string {
  const line = text.split('\n')[0].trim()
  const match = line.match(/^[^。！？.!?]+[。！？.!?]?/)
  return match ? match[0].trim() : line.slice(0, 80)
}
function providerInitial(name: string): string { return name.slice(0, 2).toUpperCase() }

const SKILL_PREVIEW = 3

function CollapsibleSkillList({ skills, agentId, posthog }: { skills: AgentSkill[]; agentId: string; posthog: ReturnType<typeof usePostHog> }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? skills : skills.slice(0, SKILL_PREVIEW)
  const hidden = skills.length - SKILL_PREVIEW
  return (
    <div className="divide-y divide-border">
      {visible.map((skill) => (
        <div key={skill.id} className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/40 transition-colors cursor-default"
          onClick={() => posthog?.capture('marketplace_skill_click', { agent_id: agentId, skill_id: skill.id })}>
          <div className="min-w-0">
            <span className="text-sm font-mono font-medium block truncate">{skill.id}</span>
            {skill.description && <span className="text-xs text-muted-foreground truncate block mt-0.5">{firstSentence(skill.description)}</span>}
          </div>
          {skill.tags && skill.tags.length > 0 && <Badge variant="outline" className="text-[10px] shrink-0 font-mono">{skill.tags[0]}</Badge>}
        </div>
      ))}
      {!expanded && hidden > 0 && (
        <button className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors text-left font-mono"
          onClick={() => { setExpanded(true); posthog?.capture('marketplace_skill_expand', { agent_id: agentId, total: skills.length }) }}>
          + {hidden} 个工具
        </button>
      )}
      {expanded && hidden > 0 && (
        <button className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors text-left font-mono"
          onClick={() => setExpanded(false)}>
          收起
        </button>
      )}
    </div>
  )
}

function AgentDetailSheet({ agent, open, onClose }: { agent: MarketplaceAgentItem | null; open: boolean; onClose: () => void }) {
  if (!agent) return null
  const skills = (Array.isArray(agent.skills) ? agent.skills : []) as AgentSkill[]
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9 rounded-md">
              <AvatarImage src={agent.icon_url ?? undefined} alt={agent.name} />
              <AvatarFallback className="rounded-md text-xs font-bold bg-muted">{providerInitial(agent.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="text-base leading-tight">{agent.name}</SheetTitle>
              {agent.provider && <p className="text-xs text-muted-foreground mt-0.5">{agent.provider}</p>}
            </div>
          </div>
          {agent.description && (
            <SheetDescription className="text-xs leading-relaxed text-foreground/70 mt-2">{agent.description}</SheetDescription>
          )}
        </SheetHeader>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {agent.mcp_url && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">MCP</Badge>}
          {agent.tags?.map((tag) => <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>)}
        </div>
        {agent.mcp_url && (
          <div className="mb-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">MCP Endpoint</p>
            <code className="text-xs font-mono bg-muted px-2 py-1.5 rounded block break-all">{agent.mcp_url}</code>
          </div>
        )}
        {skills.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">工具 · {skills.length}</p>
            </div>
            <div className="space-y-2">
              {skills.map((skill) => (
                <div key={skill.id} className="border border-border rounded-md px-3 py-2">
                  <p className="text-xs font-mono font-medium">{skill.id}</p>
                  {skill.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{skill.description}</p>}
                  {skill.tags && skill.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {skill.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px] font-mono h-4 px-1">{t}</Badge>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {agent.documentation_url && (
          <a href={agent.documentation_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ExternalLink className="w-3 h-3" />查看文档
          </a>
        )}
      </SheetContent>
    </Sheet>
  )
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

      {/* Agent 列表 */}
      {filteredAgents.length > 0 && (
        <div className="space-y-3">
          {filteredAgents.map((agent) => {
            const skills = (Array.isArray(agent.skills) ? agent.skills : []) as AgentSkill[]
            const isConnected = !!connectedMap[agent.id]
            const isConnecting = connecting === agent.id
            const isDisconnecting = disconnecting === agent.id
            return (
              <div key={agent.id} className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-7 h-7 rounded-md shrink-0">
                      <AvatarImage src={agent.icon_url ?? undefined} alt={agent.name} />
                      <AvatarFallback className="rounded-md text-[10px] font-bold bg-muted">{providerInitial(agent.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <button className="text-sm font-medium block truncate hover:underline text-left" onClick={() => openDetail(agent)}>{agent.name}</button>
                      {agent.description && <span className="text-xs text-muted-foreground block mt-0.5 truncate">{firstSentence(agent.description)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {agent.updated_at && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="text-[10px] text-muted-foreground font-mono cursor-default">{relativeTime(agent.updated_at)}</TooltipTrigger>
                          <TooltipContent>{formatDate(agent.updated_at)}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {agent.mcp_url && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">MCP</Badge>}
                    {isConnected ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-[var(--onit-green)] border-[var(--onit-green)]/30" disabled>
                        <CheckCircle2 className="w-3 h-3" />已连接
                      </Button>
                    ) : (
                      <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" disabled={isConnecting} onClick={() => handleConnect(agent)}>
                        {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plug className="w-3 h-3" />}
                        {isConnecting ? '连接中…' : 'Connect'}
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs w-40">
                        <DropdownMenuItem onClick={() => openDetail(agent)}>查看详情</DropdownMenuItem>
                        {agent.documentation_url && (
                          <DropdownMenuItem onClick={() => window.open(agent.documentation_url!, '_blank', 'noopener,noreferrer')}>
                            <ExternalLink className="w-3 h-3" />查看文档
                          </DropdownMenuItem>
                        )}
                        {isConnected && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={isDisconnecting} onClick={() => handleDisconnect(agent)}>
                              {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Unplug className="w-3 h-3 mr-1.5" />}
                              断开连接
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {skills.length > 0 ? (
                  <CollapsibleSkillList skills={skills} agentId={agent.id} posthog={posthog} />
                ) : (
                  <div className="px-4 py-3 text-xs text-muted-foreground font-mono">no tools registered</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AgentDetailSheet agent={detailAgent} open={detailOpen} onClose={() => setDetailOpen(false)} />
      <SubmitMcpDialog open={submitOpen} onOpenChange={setSubmitOpen} onSuccess={() => setSubmitOpen(false)} />
    </>
  )
}
