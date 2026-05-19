import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@supabase/supabase-js'
import { getSiteConfig } from '@/lib/queries'
import { AgentCardWithPopover } from './agent-card'

export const revalidate = 60

// ── 从 agent_memory 读取最近的平台活动 ──────────────────────────────────
async function getAgentActivity() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data, error } = await supabase
      .from('agent_memory')
      .select('id, agent_id, key, content, tags, created_at')
      .order('created_at', { ascending: false })
      .limit(8)
    if (error || !data) return []
    return data.map((m) => ({
      id: m.id,
      agent_id: m.agent_id,
      key: m.key,
      content: String(m.content || '').slice(0, 100),
      tags: m.tags || [],
      created_at: m.created_at,
    }))
  } catch {
    return []
  }
}

// ── 从 Supabase 读取 Agent 注册表 ─────────────────────────────────────────
async function getAgents() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase
    .from('agent_registry')
    .select('id, name, description, skills, capabilities, connector_type, tags, enabled, updated_at')
    .in('connector_type', ['preset', 'platform'])
    .eq('enabled', true)
    .order('connector_type')
  if (error) return []
  return data ?? []
}

function isCore(agent: { connector_type: string | null }) {
  return agent.connector_type === 'preset'
}

type ActivityItem = {
  id: string
  agent_id: string
  key: string
  content: string
  tags: string[]
  created_at: string
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground font-mono py-4 text-center">
        暂无活动记录
      </p>
    )
  }
  return (
    <div className="space-y-0 divide-y divide-border">
      {items.map((item) => {
        const timeAgo = getTimeAgo(item.created_at)
        const isPlatform = item.agent_id === 'platform'
        return (
          <div key={item.id} className="flex items-start gap-3 py-3">
            <div className="mt-0.5 shrink-0">
              <div
                className={`w-2 h-2 rounded-full mt-1 ${
                  isPlatform
                    ? 'bg-[oklch(0.65_0.15_145)]'
                    : 'bg-muted-foreground/40'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-relaxed text-foreground/80 truncate">
                {item.content}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {item.agent_id}
                </span>
                {item.key && (
                  <>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{item.key}</span>
                  </>
                )}
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
              </div>
            </div>
            {isPlatform && (
              <Badge
                variant="outline"
                className="text-[10px] shrink-0 bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.45_0.15_145)] border-[oklch(0.65_0.15_145)]/20"
              >
                ONIT
              </Badge>
            )}
          </div>
        )
      })}
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default async function AgentsPage() {
  const [agents, siteConfig, activity] = await Promise.all([
    getAgents(),
    getSiteConfig(),
    getAgentActivity(),
  ])

  const coreAgents = agents.filter((a) => isCore(a))
  const externalAgents = agents.filter((a) => !isCore(a))

  const p = siteConfig?.pages?.agents
  const eyebrow = p?.eyebrow || 'Agent Team'
  const headingTemplate = p?.heading || '{count} agents, ready to work'
  const description = p?.description || '每位成员有明确的专长，分工协作，随时待命。'
  const coreLabel = p?.core_label || '核心团队'
  const externalLabel = p?.external_label || '外部成员'
  const emptyState = p?.empty_state || '暂无成员。'
  const heading = headingTemplate.replace('{count}', String(agents.length))

  return (
    <div className="min-h-screen bg-background">
      <Navbar siteConfig={siteConfig} />
      <main className="max-w-5xl mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground mb-4">
            {eyebrow}
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            {heading}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* Agent 活动日志 — 核心"活体演示"区块 */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
              {p?.activity_label || '最近动态'}
            </h2>
            <div className="flex-1 h-px bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.15_145)] animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground">{p?.live_label || '运行中'}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-1">
            <ActivityFeed items={activity} />
          </div>
          <p className="text-[10px] text-muted-foreground font-mono mt-2 text-right">
            {p?.activity_hint || '绿点 = ONIT 平台活动 · 实时更新'}
          </p>
        </section>

        {/* Agent 注册表 */}
        {coreAgents.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                {coreLabel}
              </h2>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{coreAgents.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {coreAgents.map((agent) => (
                <AgentCardWithPopover key={agent.id} agent={agent} />
              ))}
            </div>
          </section>
        )}
        {externalAgents.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                {externalLabel}
              </h2>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{externalAgents.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {externalAgents.map((agent) => (
                <AgentCardWithPopover key={agent.id} agent={agent} />
              ))}
            </div>
          </section>
        )}
        {agents.length === 0 && (
          <p className="text-center text-muted-foreground py-20 text-sm font-mono">
            {emptyState}
          </p>
        )}
      </main>
      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
    </div>
  )
}
