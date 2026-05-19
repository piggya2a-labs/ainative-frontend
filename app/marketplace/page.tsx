'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePostHog } from 'posthog-js/react'
import { createClient } from '@supabase/supabase-js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { relativeTime, formatDate } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { SubmitMcpDialog } from '@/components/submit-mcp-dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Plug, CheckCircle2, Loader2, Search, MoreHorizontal, Unplug, ExternalLink, Zap, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { MarketplaceAgentItem, AgentSkill } from '@/lib/database.types'
import { createClient as createBrowserClient } from '@/lib/supabase-client'

const PROVIDER_LABELS: Record<string, string> = {
  'trigger.dev': 'Trigger.dev', n8n: 'n8n', slack: 'Slack', telegram: 'Telegram',
  feishu: '飞书', wechat: '微信', github: 'GitHub', anthropic: 'Anthropic',
  langsmith: 'LangSmith', langgraph: 'LangGraph', composio: 'Composio',
  supabase: 'Supabase', steel: 'Steel', sprite: 'Sprite', gentic: 'Gentic',
}
function providerLabel(p?: string | null) { return p ? (PROVIDER_LABELS[p.toLowerCase()] ?? p) : 'Community' }
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
              {agent.provider && <p className="text-xs text-muted-foreground mt-0.5">{providerLabel(agent.provider)}</p>}
            </div>
          </div>
          {agent.description && (
            <SheetDescription className="text-xs leading-relaxed text-foreground/70 mt-2">{agent.description}</SheetDescription>
          )}
        </SheetHeader>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {agent.mcp_url && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">MCP</Badge>}
          {agent.connector_type && <Badge variant="outline" className="text-[10px] font-mono">{agent.connector_type}</Badge>}
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

export default function MarketplacePage() {
  const posthog = usePostHog()
  const supabase = createBrowserClient()
  const [agents, setAgents] = useState<MarketplaceAgentItem[]>([])
  const [siteConfig, setSiteConfig] = useState<import('@/lib/sanity-schema').SiteConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [connectedMap, setConnectedMap] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [detailAgent, setDetailAgent] = useState<MarketplaceAgentItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchAgents = useCallback(async () => {
    const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data } = await anonClient
      .from('agent_registry')
      .select('id, name, description, provider, skills, mcp_url, tags, updated_at, icon_url, documentation_url, connector_type, oauth_config')
      .in('connector_type', ['preset', 'custom']).eq('enabled', true).order('provider')
    setAgents((data ?? []) as MarketplaceAgentItem[])
    setLoading(false)
  }, [])

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
    fetchAgents(); fetchConnected()
    posthog?.capture('page_view', { page: 'marketplace' })
    fetch('/api/site-config').then(r => r.json()).then(setSiteConfig).catch(() => {})
  }, [fetchAgents, fetchConnected, posthog])

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

  const grouped = useMemo(() => {
    const map = new Map<string, MarketplaceAgentItem[]>()
    for (const agent of filteredAgents) {
      const key = agent.provider ?? 'community'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(agent)
    }
    return map
  }, [filteredAgents])

  const totalSkills = agents.reduce((sum, a) => sum + (Array.isArray(a.skills) ? a.skills.length : 0), 0)

  async function handleConnect(agent: MarketplaceAgentItem) {
    posthog?.capture('marketplace_agent_connect_click', { agent_id: agent.id, agent_name: agent.name, mcp_url: agent.mcp_url })
    setConnecting(agent.id)
    try {
      const res = await fetch('/api/connector/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // connector_type 透传，让后端判断是否走 OAuth
        body: JSON.stringify({ connector_id: agent.id, connector_type: agent.connector_type ?? 'custom', mcp_url: agent.mcp_url }),
      })
      const data = await res.json()
      if (data?.authorization_url) { posthog?.capture('marketplace_agent_oauth_redirect', { agent_id: agent.id }); window.location.href = data.authorization_url; return }
      await fetchConnected()
      posthog?.capture('marketplace_agent_connect_success', { agent_id: agent.id, agent_name: agent.name })
    } catch { posthog?.capture('marketplace_agent_connect_error', { agent_id: agent.id }) }
    finally { setConnecting(null) }
  }

  async function handleDisconnect(agent: MarketplaceAgentItem) {
    const connectorId = connectedMap[agent.id]
    if (!connectorId) return
    posthog?.capture('marketplace_agent_disconnect_click', { agent_id: agent.id })
    setDisconnecting(agent.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await supabase.from('tenant_connectors').delete().eq('id', connectorId)
      setConnectedMap((prev) => { const next = { ...prev }; delete next[agent.id]; return next })
      posthog?.capture('marketplace_agent_disconnect_success', { agent_id: agent.id })
    } catch { posthog?.capture('marketplace_agent_disconnect_error', { agent_id: agent.id }) }
    finally { setDisconnecting(null) }
  }

  function openDetail(agent: MarketplaceAgentItem) {
    setDetailAgent(agent); setDetailOpen(true)
    posthog?.capture('marketplace_agent_detail_open', { agent_id: agent.id })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar siteConfig={siteConfig} />
      <main className="max-w-4xl mx-auto px-4 pt-28 pb-16">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agent Marketplace</h1>
            {!loading && <p className="text-sm text-muted-foreground font-mono mt-1">{agents.length} agents · {totalSkills} tools</p>}
          </div>
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => { posthog?.capture('marketplace_submit_mcp_open'); setSubmitOpen(true) }}>
            <Plus className="w-3.5 h-3.5" />添加 MCP
          </Button>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="搜索 Agent、工具名、描述…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 pr-9 h-9 text-sm" />
          {query && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setQuery('')}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {loading && (
          <div className="space-y-8">
            {[1, 2, 3].map((g) => (
              <div key={g}>
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-4 w-16 rounded" />
                  <Skeleton className="h-4 w-6 rounded" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2].map((c) => (
                    <div key={c} className="rounded-xl border bg-card p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-32 rounded" />
                          <Skeleton className="h-3 w-full rounded" />
                          <Skeleton className="h-3 w-3/4 rounded" />
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <Skeleton className="h-8 w-full rounded" />
                        <Skeleton className="h-8 w-full rounded" />
                        <Skeleton className="h-8 w-full rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && agents.length === 0 && (
          <div className="text-center py-20">
            <p className="text-sm text-muted-foreground font-mono mb-4">No agents yet. Be the first to add one.</p>
            <Button variant="outline" onClick={() => { posthog?.capture('marketplace_submit_mcp_open', { source: 'empty_state' }); setSubmitOpen(true) }}>
              <Plus className="w-3.5 h-3.5 mr-2" />添加第一个 MCP Agent
            </Button>
          </div>
        )}

        {!loading && agents.length > 0 && filteredAgents.length === 0 && (
          <div className="text-center py-20">
            <p className="text-sm text-muted-foreground">没有找到匹配 &ldquo;{query}&rdquo; 的 Agent 或工具</p>
            <button className="text-xs text-muted-foreground underline mt-2" onClick={() => setQuery('')}>清除搜索</button>
          </div>
        )}

        {!loading && filteredAgents.length > 0 && (
          <div className="space-y-10">
            {Array.from(grouped.entries()).map(([provider, providerAgents]) => (
              <div key={provider}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{providerLabel(provider)}</span>
                  <span className="text-xs text-muted-foreground">{providerAgents.length}</span>
                </div>
                <div className="space-y-3">
                  {providerAgents.map((agent) => {
                    const skills = (Array.isArray(agent.skills) ? agent.skills : []) as AgentSkill[]
                    const isConnected = !!connectedMap[agent.id]
                    const isConnecting = connecting === agent.id
                    const isDisconnecting = disconnecting === agent.id
                    const isCustom = agent.connector_type === 'custom'
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
                                {isCustom && !isConnected && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-muted-foreground" disabled>编辑词条</DropdownMenuItem>
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
              </div>
            ))}
          </div>
        )}
      </main>
      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
      <AgentDetailSheet agent={detailAgent} open={detailOpen} onClose={() => setDetailOpen(false)} />
      <SubmitMcpDialog open={submitOpen} onOpenChange={setSubmitOpen} onSuccess={() => { setSubmitOpen(false); fetchAgents() }} />
    </div>
  )
}
