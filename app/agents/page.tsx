import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@supabase/supabase-js'
import { getSiteConfig } from '@/lib/queries'

export const revalidate = 60

// ── 从 GitHub 读取 Agent 最近的 commit 活动 ──────────────────────────────
async function getAgentActivity() {
  try {
    const res = await fetch(
      'https://api.github.com/repos/piggya2a-labs/ainative-frontend/commits?per_page=20&sha=main',
      {
        headers: {
          Authorization: `token ${process.env.INNER_LOOP_GITHUB_TOKEN || process.env.GITHUB_TOKEN || ''}`,
          Accept: 'application/vnd.github.v3+json',
        },
        next: { revalidate: 60 },
      }
    )
    if (!res.ok) return []
    const commits = await res.json()
    // 只取 Agent 写的 commit（包含 claude-agent、inner-loop、health-check 关键词）
    return commits
      .filter((c: { commit: { message: string } }) => {
        const msg = c.commit.message.toLowerCase()
        return (
          msg.includes('claude-agent') ||
          msg.includes('inner-loop') ||
          msg.includes('agent') ||
          msg.includes('feat(') ||
          msg.includes('fix:')
        )
      })
      .slice(0, 8)
      .map((c: {
        sha: string
        commit: {
          message: string
          author: { name: string; date: string }
        }
        html_url: string
      }) => ({
        sha: c.sha.slice(0, 7),
        message: c.commit.message.split('\n')[0].slice(0, 80),
        author: c.commit.author.name,
        date: c.commit.author.date,
        url: c.html_url,
      }))
  } catch {
    return []
  }
}

// ── 从 Supabase 读取 Agent 注册表 ────────────────────────────────────────
async function getAgents() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase
    .from('agent_registry')
    .select('id, name, type, description, url, enabled, skills, tags, icon_url')
    .eq('type', 'agent')
    .eq('enabled', true)
    .order('id')
  if (error) return []
  return data ?? []
}

function isExternal(id: string) {
  return id.startsWith('ext-')
}

type AgentTiers = { ext?: string; l1?: string; l2?: string; l3?: string; default?: string }

function getTier(id: string, tiers?: AgentTiers): string {
  if (id.startsWith('ext-')) return tiers?.ext ?? 'External'
  if (id.startsWith('l1-')) return tiers?.l1 ?? 'Operator'
  if (id.startsWith('l2-')) return tiers?.l2 ?? 'Architect'
  if (id.startsWith('l3-')) return tiers?.l3 ?? 'Auditor'
  return tiers?.default ?? 'Agent'
}

type AgentRow = {
  id: string
  name: string
  description: string
  url?: string
  skills?: Array<{ id: string; name: string; tags?: string[]; description?: string }>
  tags?: string[]
  icon_url?: string
}

type ActivityItem = {
  sha: string
  message: string
  author: string
  date: string
  url: string
}

function AgentCard({ agent, tiers }: { agent: AgentRow; tiers?: AgentTiers }) {
  const tier = getTier(agent.id, tiers)
  const isLive = agent.url && agent.url !== 'pending'
  const skills = agent.skills ?? []
  return (
    <div className="p-5 rounded-lg border border-border hover:border-foreground/20 transition-colors flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-snug">{agent.name}</span>
        <Badge
          variant="outline"
          className={`text-xs shrink-0 ${
            isLive
              ? 'bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.55_0.15_145)] border-[oklch(0.65_0.15_145)]/20'
              : 'bg-muted text-muted-foreground border-border'
          }`}
        >
          {isLive ? 'Live' : 'Pending'}
        </Badge>
      </div>
      {agent.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {agent.description}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap mt-auto">
        <Badge variant="secondary" className="text-xs">{tier}</Badge>
        {skills.map((s) => (
          <Badge key={s.id} variant="outline" className="text-xs font-mono">
            {s.name}
          </Badge>
        ))}
      </div>
    </div>
  )
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
        const isAgentCommit =
          item.message.toLowerCase().includes('claude-agent') ||
          item.author.toLowerCase().includes('claude') ||
          item.author.toLowerCase().includes('agent') ||
          item.author.toLowerCase().includes('inner-loop')
        const timeAgo = getTimeAgo(item.date)
        return (
          <div key={item.sha} className="flex items-start gap-3 py-3">
            <div className="mt-0.5 shrink-0">
              <div
                className={`w-2 h-2 rounded-full mt-1 ${
                  isAgentCommit
                    ? 'bg-[oklch(0.65_0.15_145)]'
                    : 'bg-muted-foreground/40'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-relaxed text-foreground/80 truncate">
                {item.message}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {item.sha}
                </span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] text-muted-foreground">{item.author}</span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
              </div>
            </div>
            {isAgentCommit && (
              <Badge
                variant="outline"
                className="text-[10px] shrink-0 bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.45_0.15_145)] border-[oklch(0.65_0.15_145)]/20"
              >
                AI
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

  const coreAgents = agents.filter((a) => !isExternal(a.id))
  const externalAgents = agents.filter((a) => isExternal(a.id))

  const p = siteConfig?.pages?.agents
  const eyebrow = p?.eyebrow || 'Agent Team'
  const description = p?.description || '每个 Agent 有明确的职责、能力集和在线端点。后端新增 Agent 后自动被发现。'
  const coreLabel = p?.core_label || 'Core — 始终加载'
  const externalLabel = p?.external_label || 'External — 按需加载'
  const emptyState = p?.empty_state || '注册表中暂无 Agent。'

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
            {agents.length} agents, always running
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* Agent 活动日志 — 核心"活体演示"区块 */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
              Recent Activity
            </h2>
            <div className="flex-1 h-px bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.15_145)] animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground">live</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-1">
            <ActivityFeed items={activity} />
          </div>
          <p className="text-[10px] text-muted-foreground font-mono mt-2 text-right">
            绿点 = AI Agent 自动提交 · 每天 10:00 UTC+8 自动运行
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
                <AgentCard key={agent.id} agent={agent} tiers={siteConfig?.agent_tiers} />
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
                <AgentCard key={agent.id} agent={agent} tiers={siteConfig?.agent_tiers} />
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
