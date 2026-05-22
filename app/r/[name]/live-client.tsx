'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import {
  Target, Users, CheckCircle2, AlertTriangle, GitBranch,
  Calendar, Clock, ArrowRight, Flag, Layers, FileText, Info,
  Lock, Zap, Activity, MessageCircle, Key, Download, Loader2,
  Terminal, Image, RefreshCw, ChevronRight
} from 'lucide-react'

// ─── ONIT LIVE BOARD 设计理念（founder_intent, 2026-05-21）─────────────────────
// ONIT LIVE BOARD 本身，就是一个 Agentic 的持久化工作队列和状态机。
// 它作为 Agent & Human 的 SSOT 唯一真相，以结果和成功为导向，给每个任务明确的状态。
// triage → todo → ready → running → blocked → done。
// 在这个基础上，参考 @Hermes Kanban。
// 我们给 Building 的每个任务，配有一个长期运行的循环，每 60 秒扫一次，
// 根据不同的任务状态，自动检查对应的 ONIT Agent、进入运行队列。
// 看板不只是展示，而是活着的调度引擎。
// ─────────────────────────────────────────────────────────────────────────────

// ─── 完全复用 how-we-work 的 Section wrapper ─────────────────────────────────
function Section({ icon: Icon, title, subtitle, children }: {
  icon: React.ElementType
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── 完全复用 how-we-work 的 Callout ─────────────────────────────────────────
function Callout({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border/50 px-4 py-3">
      <Info className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  )
}

// ─── 待开放标签 ───────────────────────────────────────────────────────────────
function ComingSoon({ source }: { source?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 font-mono">
      <Lock className="w-3 h-3" />
      待开放{source ? `（${source}）` : ''}
    </span>
  )
}

// ─── 待填写标签 ───────────────────────────────────────────────────────────────
function Pending() {
  return <span className="text-sm text-muted-foreground/50 italic">待填写</span>
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface MilestoneTask { name: string; done: boolean; owner: string; status?: 'done' | 'running' | 'in_progress' | 'blocked' | 'todo' | 'triage' | 'pending' }
interface MilestoneData {
  id: string
  order: number
  status: 'done' | 'running' | 'ready' | 'blocked' | 'todo' | 'triage' | 'pending'
  name: string
  completed_at?: string | null
  started_at?: string | null
  target_date?: string | null
  tasks_total: number
  tasks_done: number
  owner: string
  tasks?: MilestoneTask[]
  // 调度字段（dispatcher 写入）
  assignee?: string          // e.g. "@Lumen"
  run_id?: string            // LangGraph run_id
  thread_id?: string         // LangGraph thread_id
  blocked_reason?: string    // 阻塞原因
  failure_count?: number     // 失败次数
  dispatched_at?: string     // 派发时间
}
interface RiskItem {
  risk: string
  level: 'high' | 'mid' | 'low'
  mitigation: string
  owner: string
}
interface CadenceItem {
  type: string
  frequency: string
  duration: string
  owner: string
}
interface CredentialItem {
  name: string
  type: string
  note?: string
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
    risks?: RiskItem[]
    cadence?: CadenceItem[]
    credentials?: CredentialItem[]
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
    contract_start: string
    plan_period: string
    lumen: string
    sega: string
    client_lead: string
    telegram_handle?: string
  }
  update_log: { date: string; author: string; note: string; type?: string }[]
}
// ─── Trace Types ─────────────────────────────────────────────────────────────
interface TraceTimelineItem {
  id: string
  tool: string
  status: string
  start_time: string
  end_time?: string
  root_run_name: string
  has_output: boolean
  error: string | null
}
interface TraceArtifact {
  type: string
  label: string
  content: string
  run_name: string
  time: string
}
interface TraceData {
  total_calls: number
  agents: string[]
  timeline: TraceTimelineItem[]
  artifacts: TraceArtifact[]
  screenshots: string[]
}

export interface LiveClientProps {
  meta: TenantMetadata
  tenantId: string
  tenantName: string
  tenantCreatedAt: string
  tenantSlug: string
  apiKeyCount: number
  runDays: number
}

// ─── helpers ─────────────────────────────────────────────────────────────────
// 状态机：triage→todo→ready→running→blocked→done
// 数据来源：tenants.metadata.milestones[].status（Supabase Realtime 实时推送）
// Human 把里程碑改成 ready，Dispatcher 才会在下一个 60s tick 派发
function milestoneStatusLabel(s: string) {
  if (s === 'done') return '已完成'
  if (s === 'running') return '执行中'
  if (s === 'ready') return '待派发'
  if (s === 'blocked') return '已阻塞'
  if (s === 'todo') return '待整理'
  if (s === 'triage') return '分诊中'
  return '待开始'
}
function milestoneStatusColor(s: string): string {
  if (s === 'done') return 'var(--onit-green)'
  if (s === 'running') return 'var(--onit-blue, #3b82f6)'
  if (s === 'ready') return 'var(--onit-amber)'
  if (s === 'blocked') return 'var(--destructive)'
  return 'var(--muted-foreground)'
}
function healthLabel(h: string) {
  if (h === 'green') return '健康'
  if (h === 'yellow') return '关注'
  return '风险'
}
function healthColor(h: string) {
  if (h === 'green') return 'var(--onit-green)'
  if (h === 'yellow') return 'var(--onit-amber)'
  return 'var(--destructive)'
}
function riskLevelLabel(level: string) {
  if (level === 'high') return '高'
  if (level === 'mid') return '中'
  return '低'
}
function riskLevelVariant(level: string): 'destructive' | 'secondary' | 'outline' {
  if (level === 'high') return 'destructive'
  if (level === 'mid') return 'secondary'
  return 'outline'
}
// as_is / to_be 可能是字符串或数组，统一转数组
function toLines(val: string | string[] | undefined): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  return val.split('\n').filter(Boolean)
}

// ─── Trace Tab ───────────────────────────────────────────────────────────────
function TraceTab({ tenantSlug }: { tenantSlug: string }) {
  const [data, setData] = useState<TraceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTrace = () => {
    setLoading(true)
    // 通过 Next.js API route 查 LangGraph（服务端安全读取 API key）
    const lg = (path: string, body?: unknown) => fetch('/api/langgraph-trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, body })
    }).then(r => r.json())
    // 先查 thread，再查 thread 里的 runs
    lg('/threads/search', { metadata: { tenant_slug: tenantSlug }, limit: 20 })
      .then(async (threads: Array<{ thread_id: string; metadata?: Record<string, unknown> }>) => {
        if (!Array.isArray(threads) || !threads.length) {
          setData({ total_calls: 0, agents: [], timeline: [], artifacts: [], screenshots: [] })
          setLoading(false)
          return
        }
        // 查每个 thread 的 runs（最多取前 5 个 thread）
        const allRuns: Array<{ run_id: string; assistant_id: string; status: string; created_at: string; updated_at?: string }> = []
        await Promise.all(threads.slice(0, 5).map(async t => {
          const runs = await lg(`/threads/${t.thread_id}/runs`) as Array<{ run_id: string; assistant_id: string; status: string; created_at: string; updated_at?: string }>
          if (Array.isArray(runs)) allRuns.push(...runs)
        }))
        // 按时间倒序
        allRuns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const agentNames: Record<string, string> = {
          '73a8b433-7a94-4ff0-a4d2-5d71bb998fc8': '@Lumen',
          'de8335f7-7798-4cb7-ac1a-52abfb27e513': '@Polly',
          '6a5945d4-6a68-4b82-8331-8574a804396c': '@Sega',
          '6c8f13b8-680d-4421-8100-5fc39cad0697': '@Dev',
          'f4790864-b52f-4ee4-9d79-a927b6967425': '@Eva',
        }
        const parsed: TraceData = {
          total_calls: allRuns.length,
          agents: [...new Set(allRuns.map(r => agentNames[r.assistant_id] ?? r.assistant_id.slice(0, 8)))],
          timeline: allRuns.slice(0, 50).map(r => ({
            id: r.run_id,
            tool: agentNames[r.assistant_id] ?? r.assistant_id.slice(0, 8),
            status: r.status,
            start_time: r.created_at,
            end_time: r.updated_at,
            root_run_name: agentNames[r.assistant_id] ?? 'Agent',
            has_output: r.status === 'success',
            error: r.status === 'error' ? '执行失败' : null
          })),
          artifacts: [],
          screenshots: []
        }
        setData(parsed)
        setLoading(false)
      })
      .catch(e => { setError(String(e)); setLoading(false) })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTrace() }, [tenantSlug])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">Trace</Badge>
            <Badge variant="secondary" className="text-xs">LangSmith</Badge>
            {data && <Badge variant="outline" className="text-xs">{data.total_calls} 次工具调用</Badge>}
          </div>
          <button
            onClick={fetchTrace}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">执行轨迹</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          从 LangSmith 实时拉取 Agent 执行过程——工具调用时间线、产出物、截图。
          锚点：<code className="text-xs font-mono bg-muted px-1 rounded">{tenantSlug}</code>
        </p>
      </div>

      <Separator />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在从 LangSmith 拉取执行轨迹…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          拉取失败：{error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* 总览数字 */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">累计工具调用</p>
                <p className="text-2xl font-bold mt-1">{data.total_calls}</p>
                <p className="text-xs text-muted-foreground mt-1">本项目全部 Agent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">参与 Agent</p>
                <p className="text-2xl font-bold mt-1">{data.agents.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{data.agents.join(' · ')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">产出物</p>
                <p className="text-2xl font-bold mt-1">{data.artifacts.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{data.screenshots.length > 0 ? `含 ${data.screenshots.length} 张截图` : '无截图'}</p>
              </CardContent>
            </Card>
          </div>

          {/* 工具调用时间线 */}
          <Section icon={Activity} title="工具调用时间线" subtitle="按时间顺序展示 Agent 调用的所有工具">
            <Card>
              <CardContent className="pt-4">
                {data.timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground/50 italic py-2">暂无工具调用记录</p>
                ) : (
                  <div className="space-y-1">
                    {data.timeline.map((item, i) => (
                      <div key={item.id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                        <span className="text-xs font-mono text-muted-foreground/50 shrink-0 pt-0.5 w-5 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{item.tool}</code>
                            <Badge
                              variant={item.status === 'success' ? 'default' : item.error ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {item.status === 'success' ? '成功' : item.error ? '失败' : item.status}
                            </Badge>
                            {item.has_output && (
                              <span className="text-xs text-muted-foreground">有输出</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground/60 font-mono">
                              {new Date(item.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
                            <span className="text-xs text-muted-foreground/50">{item.root_run_name}</span>
                          </div>
                          {item.error && (
                            <p className="text-xs text-destructive mt-0.5 truncate">{item.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Section>

          {/* 产出物 */}
          <Section icon={Terminal} title="产出物" subtitle="E2B 执行结果、写入文件等">
            {data.artifacts.length === 0 ? (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground/50 italic py-2">本次执行无可提取的产出物</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {data.artifacts.map((a, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">{a.type}</Badge>
                        <code className="text-xs text-muted-foreground">{a.label}</code>
                        <span className="text-xs text-muted-foreground/50 ml-auto">{a.run_name}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <pre className="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-48">{a.content}</pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </Section>

          {/* 截图 */}
          <Section icon={Image} title="截图" subtitle="Agent 执行 steel_screenshot 时的截图">
            {data.screenshots.length === 0 ? (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground/50 italic py-2">本次执行无截图（Agent 未调用截图工具）</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {data.screenshots.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`截图 ${i + 1}`} className="rounded-lg border border-border w-full object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                  </a>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

// ─── MCSP Tab（复用 how-we-work MutualSuccessPlan 结构）─────────────────────
function McspTab({ meta, runDays }: { meta: TenantMetadata; runDays: number }) {
  const { milestones, mcsp, audit, client } = meta
  const doneMilestones = milestones.filter(m => m.status === 'done').length
  const asIsLines = toLines(mcsp.as_is)
  const toBeLines = toLines(mcsp.to_be)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">MCSP</Badge>
          <Badge variant="secondary" className="text-xs">实时</Badge>
          <Badge
            variant="outline"
            className="text-xs"
            style={{ color: healthColor(audit.health), borderColor: healthColor(audit.health) }}
          >
            {healthLabel(audit.health)}
          </Badge>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Mutual Customer Success Plan</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          这是我们双方共同签认的完整操作系统——不是 ONIT 单方面的服务承诺，而是我们一起追同一个目标的行动地图。
          按 cadence 动态更新，此页面实时同步。
        </p>
        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { label: '合同开始', desc: client.contract_start },
            { label: '计划周期', desc: client.plan_period },
            { label: '已运行', desc: `${runDays} 天` },
          ].map(({ label, desc }) => (
            <div key={label} className="rounded-lg border border-border/50 p-3 space-y-1">
              <span className="text-xs font-medium">{label}</span>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Block 1: 目标与背景 */}
      <Section icon={Target} title="1. 目标与背景" subtitle="我们双方对「这次合作是什么」的共同认知">
        <Card>
          <CardContent className="pt-4 space-y-0">
            <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground pt-0.5 font-medium">客户名称</span>
              <span className="text-sm">{client.name}</span>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground pt-0.5 font-medium">客户成功经理</span>
              <span className="text-sm">@{client.lumen}</span>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground pt-0.5 font-medium">执行工程师</span>
              <span className="text-sm">@{client.sega}</span>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground pt-0.5 font-medium">客户负责人</span>
              <span className="text-sm">{client.client_lead || <Pending />}</span>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground pt-0.5 font-medium">合同开始日期</span>
              <span className="text-sm font-mono">{client.contract_start}</span>
            </div>
            {mcsp.context && (
              <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2 border-b border-border/50">
                <span className="text-xs text-muted-foreground pt-0.5 font-medium">背景说明</span>
                <span className="text-sm leading-relaxed">{mcsp.context}</span>
              </div>
            )}
            <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2">
              <span className="text-xs text-muted-foreground pt-0.5 font-medium">合作目标</span>
              <span className="text-sm leading-relaxed">{mcsp.goal || <Pending />}</span>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Block 2: 现状 vs 理想状态 */}
      <Section icon={ArrowRight} title="2. 现状 → 理想状态" subtitle="起点和终点的对比，成功标准从这里推导">
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">现状（As-Is）</CardTitle>
              <CardDescription className="text-xs">我们现在的处境</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {asIsLines.length > 0 ? asIsLines.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs font-mono text-muted-foreground mt-0.5">{i + 1}.</span>
                  <span className="text-sm">{item}</span>
                </div>
              )) : <Pending />}
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">理想状态（To-Be）</CardTitle>
              <CardDescription className="text-xs">3 个月后我们希望庆祝什么</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {toBeLines.length > 0 ? toBeLines.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs font-mono text-muted-foreground mt-0.5">{i + 1}.</span>
                  <span className="text-sm">{item}</span>
                </div>
              )) : <Pending />}
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Block 3: 成功标准 */}
      <Section icon={CheckCircle2} title="3. 成功标准（Success Criteria）" subtitle="可量化、可验证的指标——这是我们验收和续约的唯一依据">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout text="基线值从现状来，目标值从理想状态来。衡量方式必须是系统可自动读取的。验收时间绑定里程碑节点。" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] text-xs">指标</TableHead>
                  <TableHead className="text-xs">基线值</TableHead>
                  <TableHead className="text-xs">目标值</TableHead>
                  <TableHead className="text-xs">衡量方式</TableHead>
                  <TableHead className="text-xs">验收时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mcsp.success_criteria && mcsp.success_criteria.length > 0 ? (
                  mcsp.success_criteria.map((sc, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{sc.metric}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sc.baseline}</TableCell>
                      <TableCell className="text-sm" style={{ color: 'var(--onit-green)' }}>{sc.target}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sc.method}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs font-mono">{sc.checkpoint}</Badge></TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="opacity-40">
                    <TableCell className="text-sm italic text-muted-foreground" colSpan={5}>待填写</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Block 4: 角色与职责 */}
      <Section icon={Users} title="4. 角色与职责（RACI）" subtitle="明确我们每个人对这个项目负什么责">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">角色</TableHead>
                  <TableHead className="text-xs">姓名</TableHead>
                  <TableHead className="text-xs">在这个项目里负责什么</TableHead>
                  <TableHead className="text-xs">联系方式</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['客户成功经理 @Lumen', `@${client.lumen}`, '整体进度跟踪、周会主持、风险上报——单一责任人', client.telegram_handle ? `@${client.telegram_handle}` : '—'],
                  ['执行工程师 @Sega', `@${client.sega}`, 'Agent 配置、集成调试——技术问题的唯一出口', '—'],
                  ['客户负责人', client.client_lead || '待填写', '推动项目、协调资源、最终验收签字', '—'],
                ].map(([role, name, scope, contact], i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{role}</TableCell>
                    <TableCell className="text-sm">{name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{scope}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{contact}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Block 5: 里程碑 */}
      <Section icon={Flag} title="5. 里程碑（Milestones）" subtitle="ONIT WhileLoop 的四个节点——找到、设计、试运行、验证通过">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px] text-xs">阶段</TableHead>
                  <TableHead className="text-xs">名称</TableHead>
                  <TableHead className="text-xs">目标日期</TableHead>
                  <TableHead className="text-xs">执行 Agent</TableHead>
                  <TableHead className="text-xs">状态</TableHead>
                  <TableHead className="text-xs">Run ID</TableHead>
                  <TableHead className="text-xs">双方签认</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((m) => {
                    const isCurrent = m.id === meta.current_milestone
                    const signed = m.id === 'M1' ? mcsp.signed_m1 : m.id === 'M3' ? mcsp.signed_m3 : m.status === 'done'
                    return (
                      <TableRow key={m.id} className={isCurrent ? 'bg-muted/30' : ''}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">{m.id}</Badge>
                          {isCurrent && <Badge variant="secondary" className="text-xs ml-1">当前</Badge>}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{m.name}</TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">
                          {m.completed_at ?? m.target_date ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.assignee
                            ? <Badge variant="secondary" className="text-xs font-mono">{m.assignee}</Badge>
                            : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ color: milestoneStatusColor(m.status), borderColor: milestoneStatusColor(m.status) }}
                          >
                            {milestoneStatusLabel(m.status)}
                          </Badge>
                          {m.blocked_reason && (
                            <p className="text-xs text-red-500 mt-1 max-w-[160px] truncate" title={m.blocked_reason}>⚠ {m.blocked_reason}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {m.run_id
                            ? <a href={`https://smith.langchain.com/o/piggya2a/projects/p/onit?run_id=${m.run_id}`} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">{m.run_id.slice(0, 8)}…</a>
                            : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell>
                          {signed
                            ? <span className="text-xs" style={{ color: 'var(--onit-green)' }}>✓ 已签认</span>
                            : <span className="text-xs text-muted-foreground">待签认</span>
                          }
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Block 6: 风险登记 */}
      <Section icon={AlertTriangle} title="6. 风险登记（Risk Register）" subtitle="提前写下可能让我们卡住的事">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout text={`证据链完整度：${mcsp.evidence_count} 条。成功标准待验收：${mcsp.success_criteria?.length ?? 0} 项。`} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">风险描述</TableHead>
                  <TableHead className="text-xs">等级</TableHead>
                  <TableHead className="text-xs">缓解措施</TableHead>
                  <TableHead className="text-xs">Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mcsp.risks && mcsp.risks.length > 0 ? (
                  mcsp.risks.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{r.risk}</TableCell>
                      <TableCell>
                        <Badge variant={riskLevelVariant(r.level)} className="text-xs">
                          {riskLevelLabel(r.level)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.mitigation || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.owner || '—'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="opacity-40">
                    <TableCell className="text-sm italic text-muted-foreground" colSpan={4}>待填写</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* Block 7: 交接与 Cadence */}
      <Section icon={GitBranch} title="7. 交接 & 节奏（Handoff & Cadence）" subtitle="这份文档怎么活着">
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">同步节奏</CardTitle>
              <CardDescription className="text-xs">定期见面是我们保持对齐的方式</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {mcsp.cadence && mcsp.cadence.length > 0 ? (
                mcsp.cadence.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{c.type}</div>
                      <div className="text-xs text-muted-foreground">{c.frequency} · {c.owner}</div>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{c.duration}</Badge>
                  </div>
                ))
              ) : (
                <div className="py-2 text-sm text-muted-foreground/50 italic">待填写</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">什么时候我们视为完成</CardTitle>
              <CardDescription className="text-xs">续约谈判的起点，也是这份计划的终点</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                `M0-M3 里程碑全部完成（当前 ${doneMilestones}/4）`,
                '成功标准中所有指标达到目标值',
                `${client.client_lead || '客户负责人'} 签字确认验收报告`,
                '续约/扩容/结束决策已明确并记录',
                'Agent 运行数据已归档，链接写入本文档',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Block 8: 凭证清单 */}
      <Section icon={Key} title="8. 凭证清单（Credentials）" subtitle="集成所需的账号、API Key 和权限清单">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <Callout text="凭证由 @Lumen 在 Telegram 对话中更新，不在此处直接填写明文。仅记录名称和状态。" />
            {mcsp.credentials && mcsp.credentials.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">名称</TableHead>
                    <TableHead className="text-xs">类型</TableHead>
                    <TableHead className="text-xs">备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mcsp.credentials.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.note || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-2 text-sm text-muted-foreground/50 italic">待填写</div>
            )}
          </CardContent>
        </Card>
      </Section>

      {/* @Eva 审计结论 */}
      <Section icon={AlertTriangle} title="@Eva 审计结论" subtitle="M3 阶段由 @Eva 执行，结论实时更新">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: healthColor(audit.health) }} />
              <span className="text-sm font-medium" style={{ color: healthColor(audit.health) }}>
                {healthLabel(audit.health)}
              </span>
              {audit.last_audit && (
                <span className="text-xs text-muted-foreground ml-auto">上次审计 {audit.last_audit}</span>
              )}
            </div>
            {audit.conclusion ? (
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground leading-relaxed">{audit.conclusion}</p>
              </div>
            ) : (
              <Callout text="审计将在 M3 阶段由 @Eva 执行，结论会实时更新到此处。" />
            )}
            {audit.next_action && (
              <div className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">{audit.next_action}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </Section>
    </div>
  )
}

// ─── OMT Tab（复用 how-we-work MilestoneTracker 结构）────────────────────────
function OmtTab({ meta, runDays, tenantSlug }: {
  meta: TenantMetadata
  runDays: number
  tenantSlug: string
}) {
  const { milestones, mcsp, audit, client } = meta
  const doneMilestones = milestones.filter(m => m.status === 'done').length
  // 进度从 meta.milestones 实时计算，随 Supabase Realtime 推送自动更新
  const overallProgress = Math.round((doneMilestones / Math.max(milestones.length, 1)) * 100)
  const inProgressMilestone = meta.current_milestone
  const currentM = milestones.find(m => m.id === inProgressMilestone)

  // Agent 注册表
  const [agentRegistry, setAgentRegistry] = useState<Array<{ id: string; name: string; langsmith_handle: string | null; enabled: boolean; url?: string; description?: string }> | null>(null)
  useEffect(() => {
    fetch('/api/agent-registry').then(r => r.json()).then(d => setAgentRegistry(d.agents ?? [])).catch(() => {})
  }, [])

  // 调度日志
  const [dispatcherLog, setDispatcherLog] = useState<Array<{ runid: number; status: string; start_time: string; end_time: string; return_message: string }> | null>(null)
  useEffect(() => {
    fetch('/api/dispatcher-log').then(r => r.json()).then(d => setDispatcherLog(d.logs ?? [])).catch(() => {})
  }, [])

  // 拉取 LangGraph trace 数据，用于填充总览数字
  const [traceStats, setTraceStats] = useState<{ total_calls: number; agents: string[] } | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const lg = (path: string, body?: unknown) => fetch('/api/langgraph-trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, body })
    }).then(r => r.json())
    const agentNames: Record<string, string> = {
      '73a8b433-7a94-4ff0-a4d2-5d71bb998fc8': '@Lumen',
      'de8335f7-7798-4cb7-ac1a-52abfb27e513': '@Polly',
      '6a5945d4-6a68-4b82-8331-8574a804396c': '@Sega',
      '6c8f13b8-680d-4421-8100-5fc39cad0697': '@Dev',
      'f4790864-b52f-4ee4-9d79-a927b6967425': '@Eva',
    }
    lg('/threads/search', { metadata: { tenant_slug: tenantSlug }, limit: 20 })
      .then(async (threads: Array<{ thread_id: string }>) => {
        if (!Array.isArray(threads) || !threads.length) { setTraceStats({ total_calls: 0, agents: [] }); return }
        const allRuns: Array<{ assistant_id: string }> = []
        await Promise.all(threads.slice(0, 5).map(async t => {
          const runs = await lg(`/threads/${t.thread_id}/runs`) as Array<{ assistant_id: string }>
          if (Array.isArray(runs)) allRuns.push(...runs)
        }))
        setTraceStats({
          total_calls: allRuns.length,
          agents: [...new Set(allRuns.map(r => agentNames[r.assistant_id] ?? r.assistant_id.slice(0, 8)))]
        })
      })
      .catch(() => {})
  }, [tenantSlug])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">OMT</Badge>
          <Badge variant="secondary" className="text-xs">实时</Badge>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Onboarding Milestone Tracker</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          这是我们每天看的施工进度牌——共同成功计划的「每日视图」。
          聚焦四个问题：现在到哪了、还有多久、卡在哪里、下一步你或 Agent 做什么。
        </p>
        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { label: '数据来源', desc: 'tenants.metadata.milestones — Supabase Realtime 毫秒级推送，无轮询' },
            { label: '调度机制', desc: 'pg_cron 每 60 秒扫一次，只处理 Human 显式标为 ready 的里程碑，不会自动触发 LLM' },
            { label: '执行轨迹', desc: 'LangSmith runs（按 tenant_slug 过滤）— Agent 执行完成后 Automation Rule 自动回调' },
          ].map(({ label, desc }) => (
            <div key={label} className="rounded-lg border border-border/50 p-3 space-y-1">
              <span className="text-xs font-medium">{label}</span>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* 总览卡片（#1-8 数字卡片）*/}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* #1 账号存活天数 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">账号存活天数</p>
                <p className="text-2xl font-bold mt-1">{runDays}</p>
                <p className="text-xs text-muted-foreground mt-1">自 {client.contract_start}</p>
              </div>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        {/* #2 累计 Agent 调用次数 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">累计工具调用</p>
                {traceStats ? (
                  <p className="text-2xl font-bold mt-1">{traceStats.total_calls}</p>
                ) : (
                  <div className="mt-1"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                )}
                <p className="text-xs text-muted-foreground mt-1">LangSmith 实时</p>
              </div>
              <Zap className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        {/* #3 已连接 Agent 数 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">参与 Agent 数</p>
                {traceStats ? (
                  <p className="text-2xl font-bold mt-1">{traceStats.agents.length}</p>
                ) : (
                  <div className="mt-1"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{traceStats ? traceStats.agents.join(' · ') : 'LangSmith 实时'}</p>
              </div>
              <GitBranch className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        {/* #4 Agent 节省时间估算 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Agent 节省时间估算</p>
                <div className="mt-1"><ComingSoon source="LangSmith" /></div>
                <p className="text-xs text-muted-foreground mt-1">打标后开放</p>
              </div>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        {/* #5 与客户沟通次数 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">与客户沟通次数</p>
                <div className="mt-1"><ComingSoon /></div>
                <p className="text-xs text-muted-foreground mt-1">数据来源待定</p>
              </div>
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        {/* #6 试运行通过率 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">试运行通过率</p>
                <div className="mt-1"><ComingSoon source="LangSmith" /></div>
                <p className="text-xs text-muted-foreground mt-1">打标后开放</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        {/* #7 里程碑完成数 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">里程碑完成</p>
                <p className="text-2xl font-bold mt-1">{doneMilestones}<span className="text-sm text-muted-foreground font-normal">/{milestones.length}</span></p>
                <p className="text-xs text-muted-foreground mt-1">M0 → M3</p>
              </div>
              <Flag className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        {/* #8 整体进度 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">整体进度</p>
                <p className="text-2xl font-bold mt-1">{overallProgress}%</p>
                <p className="text-xs text-muted-foreground mt-1">当前阶段 {inProgressMilestone}</p>
              </div>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 进度条区（#9-13）*/}
      <Section icon={Layers} title="任务完成进度" subtitle="OMT 任务完成率 + MCSP 填写率 + Agent 占比">
        <Card>
          <CardContent className="pt-4 space-y-4">
            {/* OMT 任务完成率（按 milestones 数组，排除 M3）*/}
            {milestones
              .slice()
              .sort((a, b) => a.order - b.order)
              .filter(m => m.id !== 'M3')
              .map((m) => {
                const pct = Math.round((m.tasks_done / Math.max(m.tasks_total, 1)) * 100)
                return (
                  <div key={m.id} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>OMT 任务完成率 {m.id}</span>
                      <span>{m.tasks_done}/{m.tasks_total}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: m.status === 'done' ? 'var(--onit-green)' : 'var(--foreground)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            {/* MCSP 七模块填写率 */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>MCSP 七模块填写率</span>
                <span>{mcsp.modules_filled}/7</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.round((mcsp.modules_filled / 7) * 100)}%`, backgroundColor: 'var(--onit-blue, #3b82f6)' }}
                />
              </div>
            </div>
            {/* Agent 占比 */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Agent 占比（Agent vs 人工）</span>
                <span>{mcsp.agent_ratio ?? 0}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${mcsp.agent_ratio ?? 0}%`, backgroundColor: 'var(--onit-green)' }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* 实施阶段进度（#14-17 状态 + 任务列表）*/}
      <Section icon={Layers} title="实施阶段进度" subtitle="每个阶段下面列出具体可执行的任务——完成后勾选，进度条自动更新">
        <div className="space-y-3">
          {milestones
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((m) => {
              const isCurrent = m.id === meta.current_milestone
              const progress = Math.round((m.tasks_done / Math.max(m.tasks_total, 1)) * 100)
              return (
                <Card key={m.id} className={isCurrent ? 'ring-1 ring-border' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">{m.id}</Badge>
                        <CardTitle className="text-sm font-semibold">{m.name}</CardTitle>
                        {isCurrent && <Badge variant="secondary" className="text-xs">当前</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">
                          {m.completed_at ?? m.target_date ?? '—'}
                        </span>
                        <Badge
                          variant={m.status === 'done' ? 'default' : m.status === 'running' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {milestoneStatusLabel(m.status)}
                        </Badge>
                      </div>
                    </div>
                    {/* 执行 Agent + run_id + 派发时间 */}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {m.assignee && (
                        <Badge variant="secondary" className="text-xs font-mono">{m.assignee}</Badge>
                      )}
                      {m.run_id && (
                        <a
                          href={`https://smith.langchain.com/o/piggya2a/projects/p/onit?run_id=${m.run_id}`}
                          target="_blank" rel="noreferrer"
                          className="text-xs font-mono text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                        >
                          run:{m.run_id.slice(0, 8)}…
                        </a>
                      )}
                      {m.dispatched_at && (
                        <span className="text-xs text-muted-foreground/60">派发 {m.dispatched_at.slice(0, 16).replace('T', ' ')}</span>
                      )}
                      {(m.failure_count ?? 0) > 0 && (
                        <Badge variant="destructive" className="text-xs">失败 {m.failure_count} 次</Badge>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>进度</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: m.status === 'done'
                              ? 'var(--onit-green)'
                              : m.status === 'running'
                              ? 'var(--foreground)'
                              : 'var(--muted-foreground)',
                          }}
                        />
                      </div>
                    </div>
                  {m.blocked_reason && (
                    <div className="px-4 pb-2">
                      <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950 rounded px-2 py-1">
                        ⚠️ {m.blocked_reason}
                      </p>
                    </div>
                  )}
                  </CardHeader>
                  {m.tasks && m.tasks.length > 0 && (
                    <CardContent className="pt-0">
                      <div className="space-y-1.5">
                        {m.tasks.map((task, i) => {
                          // support both old done:bool and new status:string
                          const isDone = task.status === 'done' || task.done === true
                          const isRunning = task.status === 'in_progress'
                          const isBlocked = task.status === 'blocked'
                          return (
                          <div key={i} className="flex items-center gap-2.5 py-1">
                            <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                              isDone ? 'bg-foreground border-foreground' : isBlocked ? 'bg-red-500 border-red-500' : isRunning ? 'bg-blue-500 border-blue-500' : 'border-border'
                            }`}>
                              {isDone && (
                                <svg className="w-2.5 h-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-sm flex-1 ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                              {task.name}
                              {isRunning && <span className="ml-1.5 text-xs text-blue-500">进行中</span>}
                              {isBlocked && <span className="ml-1.5 text-xs text-red-500">卡住了</span>}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">{task.owner}</span>
                          </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
        </div>
      </Section>

      {/* 当前卡点 & 下一步行动 */}
      <Section icon={AlertTriangle} title="当前卡点 & 下一步行动" subtitle="现在有什么在拖慢我们？每个卡点必须有下一步行动和 Owner">
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">卡点描述</TableHead>
                  <TableHead className="text-xs">影响阶段</TableHead>
                  <TableHead className="text-xs">下一步行动</TableHead>
                  <TableHead className="text-xs">Owner</TableHead>
                  <TableHead className="text-xs">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.next_action ? (
                  <TableRow>
                    <TableCell className="text-sm">{audit.next_action}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs font-mono">{meta.current_milestone}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{audit.next_action}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">@{client.lumen}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">处理中</Badge></TableCell>
                  </TableRow>
                ) : (
                  <TableRow className="border-dashed">
                    <TableCell className="text-sm text-muted-foreground/40 italic" colSpan={5}>
                      暂无卡点 — 我们现在进展顺利
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* 客户活跃度（PostHog 补充指标）*/}
      <Section icon={Activity} title="客户活跃度" subtitle="PostHog 事件统计，事件已在客户端埋点，服务端查询接入后开放">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '登录 Dashboard 次数', icon: Activity, source: 'PostHog page_view' },
            { label: '连接 Agent 次数', icon: GitBranch, source: 'PostHog marketplace_agent_connect_success' },
            { label: '点击 Telegram 次数', icon: MessageCircle, source: 'PostHog dashboard_telegram_cta_click' },
            { label: '创建 API Key 次数', icon: Lock, source: 'PostHog api_key_create' },
          ].map(({ label, icon: Icon, source }) => (
            <Card key={label}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <div className="mt-1"><ComingSoon /></div>
                    <p className="text-xs text-muted-foreground/50 mt-1 truncate">{source}</p>
                  </div>
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* 更新日志 */}
      <Section icon={FileText} title="更新日志（Update Log）" subtitle="每次有进展，@Lumen 或 Agent 追加一行——只加不改">
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {meta.update_log && meta.update_log.length > 0 ? (
                meta.update_log.slice().reverse().map((log, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                    <span className="text-xs font-mono text-muted-foreground shrink-0 pt-0.5">{log.date}</span>
                    <span className="text-sm shrink-0 pt-0.5">
                      {log.type === 'milestone_done' ? '✅' : log.type === 'audit' ? '📊' : log.type === 'task_update' ? '🔧' : log.type === 'user_message' ? '💬' : '•'}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm">{log.note}</span>
                      <span className="text-xs text-muted-foreground ml-2">— {log.author}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-2 text-sm text-muted-foreground/40 italic">暂无更新日志</div>
              )}
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Agent 注册表 */}
      <Section icon={Users} title="Agent 注册表" subtitle="当前系统注册的核心 Agent，来自 agent_registry 表">
        <Card>
          <CardContent className="pt-4">
            {agentRegistry === null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />加载中…</div>
            ) : agentRegistry.length === 0 ? (
              <div className="text-sm text-muted-foreground/40 italic">暂无已注册的系统 Agent</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Agent</TableHead>
                    <TableHead className="text-xs">描述</TableHead>
                    <TableHead className="text-xs">LangSmith Handle</TableHead>
                    <TableHead className="text-xs">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentRegistry.map(agent => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{agent.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{agent.id}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px]">{agent.description ?? '—'}</TableCell>
                      <TableCell>
                        {agent.langsmith_handle
                          ? <Badge variant="outline" className="text-xs font-mono">{agent.langsmith_handle}</Badge>
                          : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={agent.enabled ? 'default' : 'secondary'} className="text-xs">
                          {agent.enabled ? '已启用' : '已禁用'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Section>

      {/* 调度日志 */}
      <Section icon={Terminal} title="调度日志" subtitle="pg_cron 每 5 分钟跑一次，最近 10 条记录">
        <Card>
          <CardContent className="pt-4">
            {dispatcherLog === null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />加载中…</div>
            ) : dispatcherLog.length === 0 ? (
              <div className="text-sm text-muted-foreground/40 italic">暂无调度记录</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">开始时间</TableHead>
                    <TableHead className="text-xs">耗时</TableHead>
                    <TableHead className="text-xs">状态</TableHead>
                    <TableHead className="text-xs">返回</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispatcherLog.map(log => {
                    const ms = log.end_time && log.start_time
                      ? Math.round((new Date(log.end_time).getTime() - new Date(log.start_time).getTime()))
                      : null
                    return (
                      <TableRow key={log.runid}>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {log.start_time ? new Date(log.start_time).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }).slice(0, 16) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ms !== null ? `${ms}ms` : '—'}</TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'succeeded' ? 'default' : 'destructive'} className="text-xs">
                            {log.status === 'succeeded' ? '成功' : log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.return_message ?? '—'}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Section>
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────
export function LiveClient({ meta: initialMeta, tenantId, tenantName, tenantCreatedAt, tenantSlug, apiKeyCount, runDays }: LiveClientProps) {
  const posthog = usePostHog()
  const [meta, setMeta] = useState<TenantMetadata>(initialMeta)

  // ─── Supabase Realtime: 订阅 tenants postgres_changes，状态变化毫秒级推送 ─────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`tenant:${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tenants', filter: `id=eq.${tenantId}` },
        (payload: { new?: Record<string, unknown> }) => {
          const newMeta = payload.new?.metadata
          if (newMeta && typeof newMeta === 'object') {
            setMeta(newMeta as TenantMetadata)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tenantId])
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    posthog?.capture('live_board_view', {
      page: 'live_report',
      tenant_id: tenantId,
      tenant_name: tenantName,
      milestone: meta.current_milestone,
      health: meta.audit.health,
    })
  }, [posthog, tenantId, tenantName, meta.current_milestone, meta.audit.health])

  return (
    <main className="flex-1 max-w-5xl mx-auto px-4 pt-12 pb-16 w-full">
      {/* Page header */}
      <div className="mb-8 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">ONIT</Badge>
          <Badge variant="secondary" className="text-xs">实时看板</Badge>
          <Badge
            variant="outline"
            className="text-xs"
            style={{ color: healthColor(meta.audit.health), borderColor: healthColor(meta.audit.health) }}
          >
            {healthLabel(meta.audit.health)}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{meta.client.name} 共同成功计划</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          {meta.client.name} × ONIT — 实时里程碑追踪，由 @{meta.client.lumen} 维护。
          MCSP 是完整操作系统，OMT 是每天看的施工进度牌。
        </p>
      </div>

      <Tabs defaultValue="mcsp" onValueChange={(v) => posthog?.capture('live_report_tab_switch', { tab: v, tenant_id: tenantId })}>
        <TabsList className="mb-6">
          <TabsTrigger value="mcsp" className="gap-2">
            <Target className="w-3.5 h-3.5" />
            共同成功计划
          </TabsTrigger>
          <TabsTrigger value="omt" className="gap-2">
            <Layers className="w-3.5 h-3.5" />
            实施进度表
          </TabsTrigger>
          <TabsTrigger value="trace" className="gap-2">
            <Terminal className="w-3.5 h-3.5" />
            执行轨迹
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mcsp">
          <McspTab meta={meta} runDays={runDays} />
        </TabsContent>

        <TabsContent value="omt">
          <OmtTab meta={meta} runDays={runDays} tenantSlug={tenantSlug} />
        </TabsContent>

        <TabsContent value="trace">
          <TraceTab tenantSlug={tenantSlug} />
        </TabsContent>
      </Tabs>

      {/* 验收状态 + SKILL.md 下载
          ⚠️ 防回退：验收状态由 meta.audit.conclusion 驱动，有内容 = 已验收。
          SKILL.md 下载按鈕现为占位（disabled），待 /api/tenants/skill-export 接口就绪后启用。*/}
      <div className="mt-8 rounded-lg border border-border/50 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {meta.audit.conclusion ? (
            <>
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--onit-green)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--onit-green)' }}>已验收</p>
                <p className="text-xs text-muted-foreground mt-0.5">{meta.audit.conclusion}</p>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="w-4 h-4 shrink-0 text-muted-foreground animate-spin" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Building…</p>
                <p className="text-xs text-muted-foreground mt-0.5">项目进行中，验收完成后可下载 SKILL.md</p>
              </div>
            </>
          )}
        </div>
        {/* ⚠️ 占位按鈕：SKILL.md 下载，待接逻辑后启用。
            ONIT WhileLoop 的设计目的是让一个事情、一个想法，甚至是乱七八糟的资料或者只言片语，
            变成一个 AI Native 的 workflow / pipe / ReAct / Close Loop。
            SKILL.md 作为一个完成的标志，意味着就此事、我们做到了、验收了、交付了，
            后续不论你要在未来的 ONIT 里重复运行，还是要在你自己决定的任何地方运行，都可以。
            启用条件：meta.audit.conclusion 有内容 且 /api/tenants/skill-export 接口就绪。*/}
        <button
          disabled
          title="验收完成后可下载 SKILL.md"
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border text-muted-foreground opacity-50 cursor-not-allowed shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          SKILL.md
        </button>
      </div>

      {/* Footer CTA */}
      <div className="mt-4 rounded-lg bg-muted/50 border border-border/50 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">有问题或想推进下一步？</p>
          <p className="text-xs text-muted-foreground mt-0.5">在 Telegram 找 @Lumen，或直接联系你的客户成功经理</p>
        </div>
        <a
          href="https://t.me/lumen_onit"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => posthog?.capture('live_report_telegram_click', { tenant_id: tenantId })}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          和 @Lumen 对话 →
        </a>
      </div>

      <div className="text-center text-xs text-muted-foreground mt-6 pb-4">
        由 ONIT 提供 · 此页面实时同步，无需刷新
      </div>
    </main>
  )
}
