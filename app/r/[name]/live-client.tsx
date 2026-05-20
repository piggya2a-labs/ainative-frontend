'use client'

import { usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Flag, CheckCircle2, Clock, Calendar, AlertTriangle,
  Target, ArrowRight, Shield, ExternalLink, Info,
  TrendingUp, BarChart2, Lock, Zap, Users, Activity,
  GitBranch, FileText, MessageCircle
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MilestoneTask {
  name: string
  done: boolean
  owner: string
}

interface MilestoneData {
  status: 'done' | 'in_progress' | 'pending'
  name: string
  completed_at?: string
  started_at?: string
  target_date?: string
  tasks_total: number
  tasks_done: number
  owner: string
  tasks?: MilestoneTask[]
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

interface LiveClientProps {
  meta: TenantMetadata
  tenantId: string
  tenantName: string
  tenantCreatedAt: string
  apiKeyCount: number
  runDays: number
  overallProgress: number
  currentProgress: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function healthLabel(health: string) {
  if (health === 'green') return '健康'
  if (health === 'yellow') return '关注'
  return '风险'
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

// 待开放标签
function ComingSoon() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 font-mono">
      <Lock className="w-3 h-3" />
      待开放
    </span>
  )
}

// 数字卡片
function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  comingSoon,
}: {
  label: string
  value?: string | number
  sub?: string
  icon: React.ElementType
  color?: 'green' | 'yellow' | 'red' | 'blue'
  comingSoon?: boolean
}) {
  const colorMap = {
    green: 'var(--onit-green)',
    yellow: 'var(--onit-amber)',
    red: 'var(--destructive)',
    blue: 'var(--onit-blue)',
  }
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            {comingSoon ? (
              <ComingSoon />
            ) : (
              <p
                className="text-xl font-bold"
                style={color ? { color: colorMap[color] } : undefined}
              >
                {value ?? '—'}
              </p>
            )}
            {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
          </div>
          <Icon className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
        </div>
      </CardContent>
    </Card>
  )
}

// 进度条行
function ProgressRow({
  label,
  done,
  total,
  color,
  comingSoon,
}: {
  label: string
  done?: number
  total?: number
  color?: string
  comingSoon?: boolean
}) {
  const pct = comingSoon ? 0 : Math.round(((done ?? 0) / Math.max(total ?? 1, 1)) * 100)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        {comingSoon ? <ComingSoon /> : <span className="font-mono text-muted-foreground">{done}/{total}</span>}
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        {!comingSoon && (
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: color ?? 'var(--foreground)' }}
          />
        )}
      </div>
    </div>
  )
}

// 状态行
function StatusRow({
  label,
  status,
  comingSoon,
}: {
  label: string
  status?: boolean | string | null
  comingSoon?: boolean
}) {
  let dot = <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
  let text = <span className="text-xs text-muted-foreground">—</span>

  if (comingSoon) {
    dot = <span className="w-2 h-2 rounded-full bg-muted-foreground/20 shrink-0" />
    text = <ComingSoon />
  } else if (status === true || status === 'yes') {
    dot = <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--onit-green)' }} />
    text = <span className="text-xs" style={{ color: 'var(--onit-green)' }}>是</span>
  } else if (status === false || status === 'no') {
    dot = <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
    text = <span className="text-xs text-muted-foreground">否</span>
  } else if (typeof status === 'string') {
    dot = <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
    text = <span className="text-xs text-muted-foreground">{status}</span>
  }

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">{dot}{text}</div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LiveClient({
  meta,
  tenantId,
  tenantName,
  tenantCreatedAt,
  apiKeyCount,
  runDays,
  overallProgress,
  currentProgress,
}: LiveClientProps) {
  const posthog = usePostHog()
  const { milestones, mcsp, audit, client, update_log, current_milestone } = meta

  useEffect(() => {
    posthog?.capture('live_report_view', {
      tenant_id: tenantId,
      tenant_name: tenantName,
      milestone: current_milestone,
      health: audit.health,
    })
  }, [posthog, tenantId, tenantName, current_milestone, audit.health])

  const currentM = milestones[current_milestone as keyof typeof milestones]
  const doneMilestones = [milestones.M0, milestones.M1, milestones.M2, milestones.M3]
    .filter(m => m.status === 'done').length

  // 计算 MCSP 七模块填写率
  const mcspFilled = mcsp.modules_filled ?? 0
  const mcspTotal = 7

  // 计算 Agent 占比（从 metadata 读，没有则 0）
  const agentRatio = mcsp.agent_ratio ?? 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">

      {/* Hero */}
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">共同成功计划进度</h1>
        <p className="text-sm text-muted-foreground">
          {client.display_name} × ONIT — 实时里程碑追踪，由 @{client.lumen} 维护
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

      {/* ── 区块 1：数字卡片（#1-6） ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">核心指标</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* #1 账号存活天数 — Supabase */}
          <MetricCard
            label="账号存活天数"
            value={runDays}
            sub={`自 ${tenantCreatedAt.slice(0, 10)}`}
            icon={Calendar}
          />
          {/* #2 累计 Agent 调用次数 — LangSmith（待开放） */}
          <MetricCard
            label="累计 Agent 调用次数"
            icon={Zap}
            comingSoon
            sub="LangSmith 数据"
          />
          {/* #3 已连接 Agent 数 — LangSmith（待开放） */}
          <MetricCard
            label="已连接 Agent 数"
            icon={GitBranch}
            comingSoon
            sub="LangSmith 数据"
          />
          {/* #4 Agent 节省时间估算 — LangSmith（待开放） */}
          <MetricCard
            label="Agent 节省时间估算"
            icon={Clock}
            comingSoon
            sub="LangSmith 数据"
          />
          {/* #5 与客户沟通次数 — 待定 */}
          <MetricCard
            label="与客户沟通次数"
            icon={MessageCircle}
            comingSoon
            sub="数据来源待定"
          />
          {/* #6 试运行通过率 — LangSmith（待开放） */}
          <MetricCard
            label="试运行通过率"
            icon={CheckCircle2}
            comingSoon
            sub="LangSmith 数据"
          />
        </div>
      </div>

      <Separator />

      {/* ── 区块 2：进度条（#7-11） ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">任务完成进度</h2>
        </div>
        <Card>
          <CardContent className="pt-4 space-y-4">
            {/* #7 OMT 任务完成率 M0 */}
            <ProgressRow
              label="OMT 任务完成率 M0"
              done={milestones.M0.tasks_done}
              total={milestones.M0.tasks_total}
              color={milestones.M0.status === 'done' ? 'var(--onit-green)' : 'var(--foreground)'}
            />
            {/* #8 OMT 任务完成率 M1 */}
            <ProgressRow
              label="OMT 任务完成率 M1"
              done={milestones.M1.tasks_done}
              total={milestones.M1.tasks_total}
              color={milestones.M1.status === 'done' ? 'var(--onit-green)' : 'var(--foreground)'}
            />
            {/* #9 OMT 任务完成率 M2 */}
            <ProgressRow
              label="OMT 任务完成率 M2"
              done={milestones.M2.tasks_done}
              total={milestones.M2.tasks_total}
              color={milestones.M2.status === 'done' ? 'var(--onit-green)' : 'var(--muted-foreground)'}
            />
            {/* #10 MCSP 七模块填写率 */}
            <ProgressRow
              label="MCSP 七模块填写率"
              done={mcspFilled}
              total={mcspTotal}
              color="var(--onit-blue)"
            />
            {/* #11 Agent 占比 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Agent 占比（Agent vs 人工）</span>
                <span className="font-mono text-muted-foreground">{agentRatio}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${agentRatio}%`, backgroundColor: 'var(--onit-green)' }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ── 区块 3：整体里程碑进度条 ── */}
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
              backgroundColor: overallProgress === 100 ? 'var(--onit-green)' : 'var(--foreground)',
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>M0 找到 Agent</span>
          <span>M3 审计通过</span>
        </div>
      </div>

      <Separator />

      {/* ── 区块 4：状态列表（#12-20） ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">状态检查</h2>
        </div>
        <Card>
          <CardContent className="pt-4">
            {/* #12-15 里程碑状态 */}
            {(['M0', 'M1', 'M2', 'M3'] as const).map((phase) => (
              <StatusRow
                key={phase}
                label={`里程碑 ${phase} 状态`}
                status={milestoneStatusLabel(milestones[phase].status)}
              />
            ))}
            {/* #16 双方签认状态 M1 */}
            <StatusRow
              label="双方签认状态 M1"
              status={mcsp.signed_m1}
            />
            {/* #17 MCP 是否接入 — LangSmith 待开放 */}
            <StatusRow
              label="MCP 是否接入"
              comingSoon
            />
            {/* #18 API Key 是否创建 — Supabase */}
            <StatusRow
              label="API Key 是否创建"
              status={apiKeyCount > 0}
            />
            {/* #19 证据链是否完整 */}
            <StatusRow
              label="证据链是否完整"
              status={mcsp.evidence_count > 0 ? `${mcsp.evidence_count} 条` : false}
            />
            {/* #20 未缓解高风险数 */}
            <StatusRow
              label="未缓解高风险数"
              status={
                mcsp.success_criteria && mcsp.success_criteria.length > 0
                  ? `${mcsp.success_criteria.length} 项成功标准`
                  : '暂无'
              }
            />
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ── 区块 5：趋势图（#21-23） ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">趋势</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* #21 最近 30 天 Agent 调用趋势 — LangSmith 待开放 */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-2">最近 30 天 Agent 调用趋势</p>
              <div className="h-16 flex items-center justify-center">
                <ComingSoon />
              </div>
              <p className="text-xs text-muted-foreground/50 mt-1">LangSmith 按天统计</p>
            </CardContent>
          </Card>
          {/* #22 里程碑时间线（计划 vs 实际）— Supabase */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-2">里程碑时间线（计划 vs 实际）</p>
              <div className="space-y-1.5">
                {(['M0', 'M1', 'M2', 'M3'] as const).map((phase) => {
                  const m = milestones[phase]
                  const date = m.completed_at ?? m.target_date ?? '—'
                  const isDone = m.status === 'done'
                  return (
                    <div key={phase} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-mono">{phase}</span>
                      <span
                        className="font-mono"
                        style={{ color: isDone ? 'var(--onit-green)' : undefined }}
                      >
                        {date}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          {/* #23 客户响应延迟趋势 — 待定 */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-2">客户响应延迟趋势</p>
              <div className="h-16 flex items-center justify-center">
                <ComingSoon />
              </div>
              <p className="text-xs text-muted-foreground/50 mt-1">数据来源待定</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* ── 区块 6：对比行（#24-26） ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">对比分析</h2>
        </div>
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">指标</TableHead>
                  <TableHead className="text-xs text-right">当前值</TableHead>
                  <TableHead className="text-xs text-right">目标值</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* #24 Agent 完成任务 vs 人工完成任务 */}
                <TableRow>
                  <TableCell className="text-xs">Agent 完成任务 vs 人工完成任务</TableCell>
                  <TableCell className="text-xs text-right font-mono">{agentRatio}%</TableCell>
                  <TableCell className="text-xs text-right font-mono" style={{ color: 'var(--onit-green)' }}>≥70%</TableCell>
                </TableRow>
                {/* #25 计划 M3 日期 vs 预测完成日期 */}
                <TableRow>
                  <TableCell className="text-xs">计划 M3 日期 vs 预测完成日期</TableCell>
                  <TableCell className="text-xs text-right font-mono">{milestones.M3.target_date ?? '—'}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-muted-foreground">按计划</TableCell>
                </TableRow>
                {/* #26 平均响应时间（ONIT vs 客户）— 待定 */}
                <TableRow>
                  <TableCell className="text-xs">平均响应时间（ONIT vs 客户）</TableCell>
                  <TableCell className="text-xs text-right" colSpan={2}>
                    <ComingSoon />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ── 区块 7：文字结论（#27-29） ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">@Eva 审计结论</h2>
        </div>
        <Card>
          <CardContent className="pt-4 space-y-4">
            {/* #27 本轮审计结论 */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">本轮审计结论</p>
              {audit.conclusion ? (
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-xs leading-relaxed">{audit.conclusion}</p>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">审计将在 M3 阶段由 @Eva 执行，结论会实时更新到此处。</p>
                </div>
              )}
            </div>
            {/* #28 健康度评级 */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">健康度评级</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: audit.health === 'green'
                      ? 'var(--onit-green)'
                      : audit.health === 'yellow'
                      ? 'var(--onit-amber)'
                      : 'var(--destructive)',
                  }}
                />
                <span
                  className="text-sm font-medium"
                  style={{
                    color: audit.health === 'green'
                      ? 'var(--onit-green)'
                      : audit.health === 'yellow'
                      ? 'var(--onit-amber)'
                      : 'var(--destructive)',
                  }}
                >
                  {healthLabel(audit.health)}
                </span>
                {audit.last_audit && (
                  <span className="text-xs text-muted-foreground ml-auto">上次审计 {audit.last_audit}</span>
                )}
              </div>
            </div>
            {/* #29 下一步行动 */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">下一步行动</p>
              {audit.next_action ? (
                <div className="flex items-start gap-2">
                  <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">{audit.next_action}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ── 区块 8：PostHog 补充指标 ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">客户活跃度</h2>
          <Badge variant="outline" className="text-xs font-mono">PostHog</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="登录 Dashboard 次数" icon={Activity} comingSoon sub="PostHog 数据" />
          <MetricCard label="连接 Agent 次数" icon={GitBranch} comingSoon sub="PostHog 数据" />
          <MetricCard label="点击 Telegram 次数" icon={MessageCircle} comingSoon sub="PostHog 数据" />
          <MetricCard label="创建 API Key 次数" icon={Lock} comingSoon sub="PostHog 数据" />
        </div>
        <p className="text-xs text-muted-foreground/60">
          PostHog 数据需服务端查询接入后开放，事件已在客户端埋点。
        </p>
      </div>

      <Separator />

      {/* ── 里程碑详情 ── */}
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
                      {isCurrent && <Badge variant="secondary" className="text-xs">当前</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      {(m.target_date || m.completed_at) && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {m.completed_at ?? m.target_date}
                        </span>
                      )}
                      <Badge variant={milestoneStatusVariant(m.status)} className="text-xs">
                        {milestoneStatusLabel(m.status)}
                      </Badge>
                    </div>
                  </div>
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
                            : 'var(--muted-foreground)',
                        }}
                      />
                    </div>
                  </div>
                </CardHeader>
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

      {/* ── 合作目标 ── */}
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

      {/* ── 更新日志 ── */}
      {update_log && update_log.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
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

      {/* ── Footer CTA ── */}
      <div className="rounded-lg bg-muted/50 border border-border/50 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">有问题或想推进下一步？</p>
          <p className="text-xs text-muted-foreground mt-0.5">在 Telegram 找 @Lumen，或直接联系你的客户成功经理</p>
        </div>
        <a
          href="https://t.me/lumen_onit"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => posthog?.capture('live_report_telegram_click', { tenant_id: tenantId })}
          className="flex items-center gap-1.5 text-xs font-medium hover:underline shrink-0"
        >
          和 @Lumen 对话
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="text-center text-xs text-muted-foreground pb-4">
        <span>由 ONIT 提供 · </span>
        <span>此页面实时同步，无需刷新</span>
      </div>
    </div>
  )
}
