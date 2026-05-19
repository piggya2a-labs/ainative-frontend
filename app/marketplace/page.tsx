'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePostHog } from 'posthog-js/react'
import { createClient } from '@supabase/supabase-js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { relativeTime, formatDate } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { SubmitMcpDialog } from '@/components/submit-mcp-dialog'
import { Plus, Plug, CheckCircle2, Loader2 } from 'lucide-react'
import type { MarketplaceAgentItem, AgentSkill } from '@/lib/database.types'

// provider → 显示名
const PROVIDER_LABELS: Record<string, string> = {
  'trigger.dev': 'Trigger.dev',
  n8n: 'n8n',
  slack: 'Slack',
  telegram: 'Telegram',
  feishu: '飞书',
  wechat: '微信',
  github: 'GitHub',
  anthropic: 'Anthropic',
  langsmith: 'LangSmith',
  langgraph: 'LangGraph',
  composio: 'Composio',
  supabase: 'Supabase',
  steel: 'Steel',
  sprite: 'Sprite',
  gentic: 'Gentic',
}

function providerLabel(p?: string | null) {
  if (!p) return 'Community'
  return PROVIDER_LABELS[p.toLowerCase()] ?? p
}

function firstSentence(text: string): string {
  const line = text.split('\n')[0].trim()
  const match = line.match(/^[^。！？.!?]+[。！？.!?]?/)
  return match ? match[0].trim() : line.slice(0, 80)
}

export default function MarketplacePage() {
  const posthog = usePostHog()
  const [agents, setAgents] = useState<MarketplaceAgentItem[]>([])
  const [siteConfig, setSiteConfig] = useState<import('@/lib/sanity-schema').SiteConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connected, setConnected] = useState<Set<string>>(new Set())

  const fetchAgents = useCallback(async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase
      .from('agent_registry')
      .select('id, name, description, provider, skills, mcp_url, tags, updated_at')
      .eq('type', 'external')
      .eq('enabled', true)
      .order('provider')
    setAgents((data ?? []) as MarketplaceAgentItem[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAgents()
    posthog?.capture('page_view', { page: 'marketplace' })
    // Fetch site config from Sanity via API
    fetch('/api/site-config').then(r => r.json()).then(setSiteConfig).catch(() => {})
  }, [fetchAgents, posthog])

  const totalSkills = agents.reduce((sum, a) => sum + (Array.isArray(a.skills) ? a.skills.length : 0), 0)

  async function handleConnect(agent: MarketplaceAgentItem) {
    posthog?.capture('marketplace_agent_connect_click', {
      agent_id: agent.id,
      agent_name: agent.name,
      mcp_url: agent.mcp_url,
    })
    setConnecting(agent.id)
    try {
      const res = await fetch('/api/connector/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connector_id: agent.id,
          connector_type: 'custom',
          mcp_url: agent.mcp_url,
        }),
      })
      const data = await res.json()
      if (data?.authorization_url) {
        posthog?.capture('marketplace_agent_oauth_redirect', { agent_id: agent.id })
        window.location.href = data.authorization_url
        return
      }
      setConnected((prev) => new Set([...prev, agent.id]))
      posthog?.capture('marketplace_agent_connect_success', {
        agent_id: agent.id,
        agent_name: agent.name,
      })
    } catch {
      posthog?.capture('marketplace_agent_connect_error', { agent_id: agent.id })
    } finally {
      setConnecting(null)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar siteConfig={siteConfig} />

      <main className="max-w-4xl mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <div className="mb-10 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agent Marketplace</h1>
            {!loading && (
              <p className="text-sm text-muted-foreground font-mono mt-1">
                {agents.length} agents · {totalSkills} tools
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => {
              posthog?.capture('marketplace_submit_mcp_open')
              setSubmitOpen(true)
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            添加 MCP
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!loading && agents.length === 0 && (
          <div className="text-center py-20">
            <p className="text-sm text-muted-foreground font-mono mb-4">
              No agents yet. Be the first to add one.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                posthog?.capture('marketplace_submit_mcp_open', { source: 'empty_state' })
                setSubmitOpen(true)
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-2" />
              添加第一个 MCP Agent
            </Button>
          </div>
        )}

        {/* Agent list */}
        {!loading && agents.length > 0 && (
          <div className="space-y-8">
            {agents.map((agent) => {
              const skills: AgentSkill[] = Array.isArray(agent.skills) ? agent.skills : []
              const isConnected = connected.has(agent.id)
              const isConnecting = connecting === agent.id

              return (
                <section key={agent.id}>
                  {/* Provider label */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      {providerLabel(agent.provider)}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {skills.length}
                    </span>
                  </div>

                  {/* Agent card */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    {/* Header row */}
                    <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <span className="text-sm font-medium block truncate">{agent.name}</span>
                        {agent.description && (
                          <span className="text-xs text-muted-foreground block mt-0.5 truncate">
                            {firstSentence(agent.description)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {agent.updated_at && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="text-[10px] text-muted-foreground font-mono cursor-default">
                                {relativeTime(agent.updated_at)}
                              </TooltipTrigger>
                              <TooltipContent>{formatDate(agent.updated_at)}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {agent.mcp_url && (
                          <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">
                            MCP
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant={isConnected ? 'outline' : 'default'}
                          className={`h-7 text-xs gap-1.5 ${isConnected ? 'text-[var(--onit-green)] border-[var(--onit-green)]/30' : ''}`}
                          disabled={isConnecting || isConnected}
                          onClick={() => handleConnect(agent)}
                        >
                          {isConnecting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isConnected ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Plug className="w-3 h-3" />
                          )}
                          {isConnecting ? '连接中…' : isConnected ? '已连接' : 'Connect'}
                        </Button>
                      </div>
                    </div>

                    {/* Skills / tools list */}
                    {skills.length > 0 ? (
                      <div className="divide-y divide-border">
                        {skills.map((skill) => (
                          <div
                            key={skill.id}
                            className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/40 transition-colors cursor-default"
                            onClick={() =>
                              posthog?.capture('marketplace_skill_click', {
                                agent_id: agent.id,
                                skill_id: skill.id,
                              })
                            }
                          >
                            <div className="min-w-0">
                              <span className="text-sm font-mono font-medium block truncate">
                                {skill.id}
                              </span>
                              {skill.description && (
                                <span className="text-xs text-muted-foreground truncate block mt-0.5">
                                  {firstSentence(skill.description)}
                                </span>
                              )}
                            </div>
                            {skill.tags && skill.tags.length > 0 && (
                              <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                                {skill.tags[0]}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        no tools registered
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>

      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />

      <SubmitMcpDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onSuccess={() => {
          setSubmitOpen(false)
          fetchAgents()
        }}
      />
    </div>
  )
}
