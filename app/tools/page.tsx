import { createClient } from '@supabase/supabase-js'
import { Badge } from '@/components/ui/badge'
import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { getSiteConfig } from '@/lib/queries'
import { getLocale } from "gt-next/server";

export const revalidate = 60

type Skill = {
  id: string
  name?: string
  description?: string
  tags?: string[]
}

type PlatformAgent = {
  id: string
  name: string
  description?: string
  provider?: string
  skills: Skill[]
  mcp_url?: string
  icon_url?: string
}

async function getPlatformAgents(): Promise<PlatformAgent[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase
    .from('agent_market')
    .select('id, name, description, skills, mcp_url, icon_url, connector_type')
    .in('connector_type', ['platform', 'custom'])
    .eq('enabled', true)
    .order('name')
  if (error) return []
  return (data ?? []).map((d) => ({ ...d, provider: d.connector_type })) as PlatformAgent[]
}

// 只取描述的第一句话
function firstSentence(text: string): string {
  const line = text.split('\n')[0].trim()
  const match = line.match(/^[^。！？.!?]+[。！？.!?]?/)
  return match ? match[0].trim() : line.slice(0, 80)
}

// provider → 显示名
const PROVIDER_LABELS: Record<string, string> = {
  platform: 'Platform',
  custom: 'Custom',
}

function providerLabel(p?: string) {
  if (!p) return 'Other'
  return PROVIDER_LABELS[p] ?? p
}

const MCP_ENDPOINT = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mcp-server?agent=l1-operator-agent`

export default async function ToolsPage() {
  const locale = await getLocale();
  const [agents, siteConfig] = await Promise.all([
    getPlatformAgents(),
    getSiteConfig(locale),
  ])

  const p = siteConfig?.pages?.tools
  const emptyState = p?.empty_state || '注册表中暂无平台 Agent。'
  const mcpLabel = p?.mcp_label || 'MCP Server 端点'
  const mcpMethodsLabel = p?.mcp_methods_label || '支持 JSON-RPC 2.0：'
  const mcpMethods: string[] = p?.mcp_methods ?? ['initialize', 'tools/list', 'tools/call']

  const totalSkills = agents.reduce((sum, a) => sum + (a.skills?.length ?? 0), 0)

  return (
    <div className="min-h-screen bg-background">
      <Navbar siteConfig={siteConfig} />

      <main className="max-w-4xl mx-auto px-4 pt-28 pb-16">

        {/* Header */}
        <div className="mb-10 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Tools
          </h1>
          <span className="text-sm text-muted-foreground font-mono">
            {agents.length} platforms · {totalSkills} skills · MCP
          </span>
        </div>

        {agents.length === 0 && (
          <p className="text-center text-muted-foreground py-20 text-sm font-mono">
            {emptyState}
          </p>
        )}

        {/* Platform Agent list */}
        <div className="space-y-8">
          {agents.map((agent) => {
            const skills: Skill[] = Array.isArray(agent.skills) ? agent.skills : []
            return (
              <section key={agent.id}>
                {/* Agent header */}
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
                    {agent.mcp_url && (
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 bg-blue-500/10 text-blue-600 border-blue-500/20"
                      >
                        MCP
                      </Badge>
                    )}
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

        {/* MCP endpoint */}
        {agents.length > 0 && (
          <div className="mt-10 flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/20">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                {mcpLabel}
              </p>
              <code className="text-xs font-mono text-foreground block truncate">
                {MCP_ENDPOINT}
              </code>
              <p className="text-xs text-muted-foreground mt-1">
                {mcpMethodsLabel}{' '}
                {mcpMethods.map((m, i) => (
                  <span key={m}>
                    <span className="font-mono">{m}</span>
                    {i < mcpMethods.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
            </div>
          </div>
        )}

      </main>

      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
    </div>
  )
}
