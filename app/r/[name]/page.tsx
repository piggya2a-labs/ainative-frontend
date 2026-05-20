import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Flag, CheckCircle2, Clock, Calendar, AlertTriangle,
  Target, ArrowRight, Shield, ExternalLink, Info
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MilestoneData {
  status: 'done' | 'in_progress' | 'pending'
  name: string
  completed_at?: string
  started_at?: string
  target_date?: string
  tasks_total: number
  tasks_done: number
  owner: string
  tasks?: { name: string; done: boolean; owner: string }[]
}

interface TenantMetadata {
  share_token: string
  current_milestone: string
  milestones: {
    M0: MilestoneData
    M1: MilestoneData
    M2: MilestoneData
    M3: MilestoneData
  }
  mcsp: {
    goal: string
    as_is?: string[]
    to_be?: string[]
    success_criteria?: { metric: string; baseline: string; target: string; method: string; checkpoint: string }[]
    signed_m1: boolean
    signed_m3: boolean
    evidence_count: number
    modules_filled: number
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

function milestoneStatusLabel(status: string) {
  if (status === 'done') return '已完成'
  if (status === 'in_progress') return '进行中'
  return '待开始'
}

function milestoneStatusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'done') return 'default'
  if (status === 'in_progress') return 'secondary'
  return 'outline'
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

  // 查询 tenant
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, slug, name, status, metadata, created_at')
    .eq('name', name)
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

  const { milestones, mcsp, audit, client, update_log, current_milestone } = meta

  // 计算整体进度
  const allMilestones = [milestones.M0, milestones.M1, milestones.M2, milestones.M3]
  const doneMilestones = allMilestones.filter(m => m.status === 'done').length
  const overallProgress = Math.round((doneMilestones / 4) * 100)

  // 计算当前里程碑任务进度
  const currentM = milestones[current_milestone as keyof typeof milestones]
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
                  : 'var(--onit-red)'
              }}
            />
            <span className="text-xs text-muted-foreground">{healthLabel(audit.health)}</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">

        {/* Hero */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight">共同成功计划进度</h1>
          <p className="text-sm text-muted-foreground">
            {client.display_name} × ONIT — 实时里程碑追踪，由 @{meta.client.lumen} 维护
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>合同开始 {client.contract_start}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>已运行 {runDays} 天</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Flag className="w-3.5 h-3.5" />
              <span>当前阶段 {current_milestone}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* 总览数字卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '里程碑完成', value: `${doneMilestones}/4`, sub: 'M0 → M3', icon: Flag },
            { label: '当前阶段进度', value: `${currentProgress}%`, sub: `${current_milestone} · ${currentM?.name ?? '—'}`, icon: CheckCircle2 },
            { label: '运行天数', value: `${runDays}`, sub: `自 ${client.contract_start}`, icon: Clock },
            {
              label: '账号健康度',
              value: healthLabel(audit.health),
              sub: audit.last_audit ? `上次审计 ${audit.last_audit}` : '待首次审计',
              icon: Shield,
              healthColor: audit.health
            },
          ].map(({ label, value, sub, icon: Icon, healthColor }) => (
            <Card key={label}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p
                      className="text-xl font-bold"
                      style={healthColor ? {
                        color: healthColor === 'green'
                          ? 'var(--onit-green)'
                          : healthColor === 'yellow'
                          ? 'var(--onit-amber)'
                          : 'var(--destructive)'
                      } : undefined}
                    >
                      {value}
                    </p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 整体进度条 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">整体里程碑进度</span>
            <span>{overallProgress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${overallProgress}%`,
                backgroundColor: overallProgress === 100
                  ? 'var(--onit-green)'
                  : 'var(--foreground)'
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>M0 找到 Agent</span>
            <span>M3 审计通过</span>
          </div>
        </div>

        <Separator />

        {/* 里程碑详情 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">里程碑详情</h2>
          </div>
          <div className="space-y-3">
            {(['M0', 'M1', 'M2', 'M3'] as const).map((phase) => {
              const m = milestones[phase]
              const progress = Math.round((m.tasks_done / Math.max(m.tasks_total, 1)) * 100)
              const isCurrent = phase === current_milestone
              return (
                <Card key={phase} className={isCurrent ? 'border-foreground/20' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">{phase}</Badge>
                        <CardTitle className="text-sm font-medium">{m.name}</CardTitle>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-xs">当前</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {m.target_date && (
                          <span className="text-xs font-mono text-muted-foreground">{m.target_date}</span>
                        )}
                        {m.completed_at && (
                          <span className="text-xs font-mono text-muted-foreground">{m.completed_at}</span>
                        )}
                        <Badge variant={milestoneStatusVariant(m.status)} className="text-xs">
                          {milestoneStatusLabel(m.status)}
                        </Badge>
                      </div>
                    </div>
                    {/* 进度条 */}
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>任务进度</span>
                        <span>{m.tasks_done}/{m.tasks_total}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: m.status === 'done'
                              ? 'var(--onit-green)'
                              : m.status === 'in_progress'
                              ? 'var(--foreground)'
                              : 'var(--muted-foreground)'
                          }}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  {/* 任务列表（仅展示有 tasks 数组的里程碑） */}
                  {m.tasks && m.tasks.length > 0 && (
                    <CardContent className="pt-0">
                      <div className="space-y-1.5">
                        {m.tasks.map((task, i) => (
                          <div key={i} className="flex items-center gap-2.5 py-1">
                            <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                              task.done ? 'bg-foreground border-foreground' : 'border-border'
                            }`}>
                              {task.done && (
                                <svg className="w-2.5 h-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-sm flex-1 ${task.done ? 'line-through text-muted-foreground' : ''}`}>
                              {task.name}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">{task.owner}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* 目标摘要 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">合作目标</h2>
          </div>
          <div className="rounded-lg bg-muted/50 border border-border/50 px-4 py-3">
            <p className="text-sm text-muted-foreground leading-relaxed">{mcsp.goal}</p>
          </div>
          {mcsp.success_criteria && mcsp.success_criteria.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">成功标准</p>
              <div className="divide-y divide-border/50 rounded-lg border border-border/50 overflow-hidden">
                {mcsp.success_criteria.map((sc, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-background">
                    <span className="text-sm flex-1">{sc.metric}</span>
                    <span className="text-xs text-muted-foreground">{sc.baseline} → {sc.target}</span>
                    <Badge variant="outline" className="text-xs font-mono shrink-0">{sc.checkpoint}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* 审计状态 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">@Eva 审计状态</h2>
          </div>
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: audit.health === 'green'
                      ? 'var(--onit-green)'
                      : audit.health === 'yellow'
                      ? 'var(--onit-amber)'
                      : 'var(--destructive)'
                  }}
                />
                <span className="text-sm font-medium">{healthLabel(audit.health)}</span>
                {audit.last_audit && (
                  <span className="text-xs text-muted-foreground ml-auto">上次审计 {audit.last_audit}</span>
                )}
              </div>
              {audit.conclusion && (
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">{audit.conclusion}</p>
                </div>
              )}
              {audit.next_action && (
                <div className="flex items-start gap-2">
                  <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">{audit.next_action}</p>
                </div>
              )}
              {!audit.conclusion && !audit.last_audit && (
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">审计将在 M3 阶段由 @Eva 执行，结论会实时更新到此处。</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* 更新日志 */}
        {update_log && update_log.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">更新日志</h2>
            </div>
            <div className="space-y-2">
              {update_log.slice().reverse().map((log, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                  <span className="text-xs font-mono text-muted-foreground shrink-0 pt-0.5">{log.date}</span>
                  <div className="flex-1">
                    <span className="text-sm">{log.note}</span>
                    <span className="text-xs text-muted-foreground ml-2">— {log.author}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer CTA */}
        <div className="rounded-lg bg-muted/50 border border-border/50 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">有问题或想推进下一步？</p>
            <p className="text-xs text-muted-foreground mt-0.5">在 Telegram 找 @Lumen，或直接联系你的客户成功经理</p>
          </div>
          <a
            href="https://t.me/lumen_onit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium hover:underline shrink-0"
          >
            和 @Lumen 对话
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pb-4">
          <span>由 ONIT 提供 · </span>
          <span>此页面实时同步，无需刷新</span>
        </div>
      </div>
    </main>
  )
}

// 禁止缓存，保证实时性
export const revalidate = 0
export const dynamic = 'force-dynamic'
