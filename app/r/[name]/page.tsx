import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { LiveClient } from './live-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MilestoneData {
  id: string
  order: number
  status: 'done' | 'in_progress' | 'pending'
  name: string
  completed_at?: string | null
  started_at?: string | null
  target_date?: string | null
  tasks_total: number
  tasks_done: number
  owner: string
  tasks?: { name: string; done: boolean; owner: string }[]
}

interface TenantMetadata {
  share_token: string
  current_milestone: string
  milestones: MilestoneData[]
  mcsp: {
    goal: string
    context?: string
    as_is?: string | string[]
    to_be?: string | string[]
    success_criteria?: { metric: string; baseline: string; target: string; method: string; checkpoint: string }[]
    risks?: { risk: string; level: 'high' | 'mid' | 'low'; mitigation: string; owner: string }[]
    cadence?: { type: string; frequency: string; duration: string; owner: string }[]
    credentials?: { name: string; type: string; note?: string }[]
    signed_m1: boolean
    signed_m3: boolean
    evidence_count: number
    modules_filled: number
    agent_ratio?: number
  }
  audit: {
    health: 'green' | 'yellow' | 'red'
    last_audit: string | null
    conclusion: string | null
    next_action: string | null
    eva_note: string | null
  }
  client: {
    name: string
    display_name: string
    contract_start: string
    plan_period: string
    lumen: string
    sega: string
    client_lead: string
    telegram_handle?: string
  }
  update_log: { date: string; author: string; note: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  const start = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function healthLabel(health: string) {
  if (health === 'green') return '健康'
  if (health === 'yellow') return '关注'
  return '风险'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LiveReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { name } = await params
  const { t: token } = await searchParams

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 查询 tenant（用 slug 匹配）
  // ⚠️ 防回退：api_key 在 tenants 表，不要用 tenant_api_keys 表（已删）
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, slug, name, status, metadata, created_at, api_key')
    .eq('slug', name)
    .limit(1)

  if (error || !tenants || tenants.length === 0) {
    notFound()
  }

  const tenant = tenants[0]
  const meta = tenant.metadata as TenantMetadata | null

  // 验证 share_token
  if (!meta || !meta.share_token) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="text-2xl font-bold">链接无效</div>
          <p className="text-sm text-muted-foreground">该客户尚未开通 Live 看板。</p>
        </div>
      </main>
    )
  }

  if (meta.share_token !== token) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="text-2xl font-bold">访问令牌无效</div>
          <p className="text-sm text-muted-foreground">请确认链接是否完整，或联系你的 ONIT 客户成功经理获取正确链接。</p>
        </div>
      </main>
    )
  }

  // ⚠️ 防回退：不要用 tenant_api_keys 表（已删），api_key 在 tenants 表单字段
  // API Key 是否已生成（单 key 设计，0 或 1）
  const apiKeyCount = (tenant as Record<string, unknown>).api_key ? 1 : 0

  // 防御：client / audit 为空说明该 tenant 还未被 Agent 初始化。
  // 新建的 tenant 只有 share_token，其他字段要等 @Lumen 写入后才有。
  // 不要删除这个判断，否则新建看板会直接崩溃。
  if (!meta.client || !meta.audit) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-xs font-mono text-muted-foreground">ONIT / {tenant.name}</div>
          <div className="text-2xl font-bold">等待初始化</div>
          <p className="text-sm text-muted-foreground max-w-xs">
            看板已创建，正在等待 Agent 写入项目信息。请去 Telegram 找 @onitmeowbot，告诉 Agent 这个项目的目标和背景。
          </p>
        </div>
      </main>
    )
  }

  // 计算派生数据（milestones 现在是数组）
  const { milestones, audit, client, current_milestone } = meta
  const allMilestones = Array.isArray(milestones) ? milestones : []
  const doneMilestones = allMilestones.filter(m => m.status === 'done').length
  const overallProgress = Math.round((doneMilestones / Math.max(allMilestones.length, 1)) * 100)
  const currentM = allMilestones.find(m => m.id === current_milestone)
  const currentProgress = currentM
    ? Math.round((currentM.tasks_done / Math.max(currentM.tasks_total, 1)) * 100)
    : 0
  const runDays = daysSince(client.contract_start)

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border/50 bg-muted/20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">ONIT</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs font-medium">{client.display_name}</span>
            <Badge variant="outline" className="text-xs font-mono ml-1">{client.plan_period}</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: audit.health === 'green'
                  ? 'var(--onit-green)'
                  : audit.health === 'yellow'
                  ? 'var(--onit-amber)'
                  : 'var(--onit-red)',
              }}
            />
            <span className="text-xs text-muted-foreground">{healthLabel(audit.health)}</span>
          </div>
        </div>
      </div>

      {/* Client Component — PostHog + 29 数据点 */}
      <LiveClient
        meta={meta}
        tenantId={tenant.id}
        tenantName={tenant.name}
        tenantCreatedAt={tenant.created_at}
        apiKeyCount={apiKeyCount ?? 0}
        runDays={runDays}
        overallProgress={overallProgress}
        currentProgress={currentProgress}
      />
    </main>
  )
}

// 禁止缓存，保证实时性
export const revalidate = 0
export const dynamic = 'force-dynamic'
