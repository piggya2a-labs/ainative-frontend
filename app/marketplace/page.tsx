import { createClient } from '@supabase/supabase-js'
import { Badge } from '@/components/ui/badge'
import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { getSiteConfig } from '@/lib/queries'
import { relativeTime, formatDate } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { MarketplaceAgentItem, AgentSkill } from '@/lib/database.types'

export const revalidate = 60

export const metadata = {
  title: 'Agent Marketplace — ONIT',
  description: 'Browse Agents available to join your ONIT team.',
}

async function getMarketplaceAgents(): Promise<MarketplaceAgentItem[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase
    .from('agent_registry')
    .select('id, name, description, provider, skills, mcp_url, tags, updated_at')
    .eq('type', 'external')
    .eq('enabled', true)
    .order('provider')
  if (error) return []
  return (data ?? []) as MarketplaceAgentItem[]
}

// 只取描述的第一句话
function firstSentence(text: string): string {
  const line = text.split('\n')[0].trim()
  const match = line.match(/^[^。！？.!?]+[。！？.!?]?/)
  return match ? match[0].trim() : line.slice(0, 80)
}

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
}

function providerLabel(p?: string | null) {
  if (!p) return 'Other'
  return PROVIDER_LABELS[p] ?? p
}

export default async function MarketplacePage() {
  const [agents, siteConfig] = await Promise.all([
    getMarketplaceAgents(),
    getSiteConfig(),
  ])

  const totalSkills = agents.reduce((sum, a) => sum + (a.skills?.length ?? 0), 0)

  return (
    <div className="min-h-screen bg-background">
      <Navbar siteConfig={siteConfig} />

      <main className="max-w-4xl mx-auto px-4 pt-28 pb-16">

        {/* Header */}
        <div className="mb-10 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Agent Marketplace
          </h1>
          <span className="text-sm text-muted-foreground font-mono">
            {agents.length} agents · {totalSkills} skills
          </span>
        </div>

        {agents.length === 0 && (
          <p className="text-center text-muted-foreground py-20 text-sm font-mono">
            No agents in the marketplace yet.
          </p>
        )}

        {/* Agent list */}
        <div className="space-y-8">
          {agents.map((agent) => {
            const skills: AgentSkill[] = Array.isArray(agent.skills) ? agent.skills : []
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
                  {/* Agent name + description */}
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
                            <TooltipContent>
                              {formatDate(agent.updated_at)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {agent.mcp_url && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20"
                        >
                          MCP
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Skills list */}
                  {skills.length > 0 ? (
                    <div className="divide-y divide-border">
                      {skills.map((skill) => (
                        <div
                          key={skill.id}
                          className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/40 transition-colors"
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
                            <Badge
                              variant="outline"
                              className="text-[10px] shrink-0 font-mono"
                            >
                              {skill.tags[0]}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      no skills registered
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>

      </main>

      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
    </div>
  )
}
