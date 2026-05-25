'use client'
import { useStream } from '@langchain/langgraph-sdk/react'
import { Streamdown } from 'streamdown'
import { cjk } from '@streamdown/cjk'
import 'streamdown/styles.css'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { AgentChat } from '@/components/agent-chat'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/sonner'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase-client'
import {
  Target, Users, CheckCircle2, AlertTriangle, GitBranch,
  Calendar, Clock, ArrowRight, Flag, Layers, FileText, Info,
  Lock, Zap, Activity, MessageCircle, Key, Download, Loader2,
  Terminal, Image, RefreshCw, ChevronRight, ChevronDown, StopCircle, History,
  MessageSquare, RotateCcw
} from 'lucide-react'

// ─── ONIT LIVE BOARD 设计理念（founder_intent, 2026-05-21）─────────────────────
// ONIT LIVE BOARD 本身，就是一个 Agentic 的持久化工作队列和状态机。
// 它作为 Agent & Human 的 SSOT 唯一真相，以结果和成功为导向，给每个任务明确的状态。
// triage → todo → ready → running → blocked → done。
// 在这个基础上，参考 @Hermes Kanban。
// @Lumen 在 Thread 内直接 task() 派遣子 Agent，看板通过 SSE 实时镜像 Thread 状态。
// 看板不只是展示，而是 Thread 的实时镜像。
// ─────────────────────────────────────────────────────────────────────────────

// ─── 完全复用 how-we-work 的 Section wrapper ─────────────────────────────────
function Section({ icon: Icon, title, subtitle, children, id }: {
  icon: React.ElementType
  title: string
  subtitle?: string
  children: React.ReactNode
  id?: string
}) {
  return (
    <div id={id} className="space-y-3 scroll-mt-24">
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

// ─── Agent UUID → 名字映射（单一来源，来自 agent_market 表）──────────────────────
// 入口 Agent（@Lumen）的 Assistant ID，所有租户的 Thread 都由它开始
// 来源：process.env.LUMEN_ASSISTANT_ID，客户端组件无法读取 server-only env，所以直接内联
const LUMEN_ASSISTANT_ID = '73a8b433-7a94-4ff0-a4d2-5d71bb998fc8'
const AGENT_NAMES: Record<string, string> = {
  [LUMEN_ASSISTANT_ID]: '@Lumen',
  'de8335f7-7798-4cb7-ac1a-52abfb27e513': '@Polly',
  '6a5945d4-6a68-4b82-8331-8574a804396c': '@Sega',
  '6c8f13b8-680d-4421-8100-5fc39cad0697': '@Dev',
  'f4790864-b52f-4ee4-9d79-a927b6967425': '@Eva',
}
function agentName(id: string): string {
  return AGENT_NAMES[id] ?? id.slice(0, 8)
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

// ─── Markdown 渲染辅助（用于自由文本字段）────────────────────────────────────────
// Streamdown 原生接管样式和动画，不再手写 Tailwind 覆盖
function Md({ children, isAnimating = false }: { children?: string | null; isAnimating?: boolean }) {
  if (!children) return null
  return (
    <Streamdown animated isAnimating={isAnimating} plugins={{ cjk }}>
      {children}
    </Streamdown>
  )
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
  // 执行字段（LangSmith webhook 回调写入）
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
  update_log: { date: string; author: string; note: string; type?: string; evidence?: string[] }[]
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
  // 量化指标（按需加载）
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  llm_rounds?: number
  tool_call_count?: number
  tool_names?: string[]
  duration_ms?: number
  first_token_ms?: number | null
  model?: string | null
  total_cost?: number | null
  cost_estimated?: boolean
  feedback_stats?: Record<string, { n: number; avg: number }> | null
  stats_loaded?: boolean
}
interface TraceArtifact {
  type: string
  label: string
  content: string
  run_name: string
  time: string
}
interface ThreadMessage {
  id: string
  type: 'human' | 'ai' | 'tool' | 'system'
  content: string
  tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }>
  tool_call_id?: string
  name?: string
}
interface TraceData {
  total_calls: number
  agents: string[]
  timeline: TraceTimelineItem[]
  artifacts: TraceArtifact[]
  screenshots: string[]
  messages?: ThreadMessage[]
  thread_id?: string
}

export interface LiveClientProps {
  meta: TenantMetadata
  tenantId: string
  tenantName: string
  tenantCreatedAt: string
  tenantSlug: string
  apiKeyCount: number
  runDays: number
  langgraphThreadId?: string
}

// ─── helpers ─────────────────────────────────────────────────────────────────
// 状态机：triage→todo→ready→running→blocked→done
// 数据来源：tenants.metadata.milestones[].status（Supabase Realtime 实时推送）
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


// ─── MilestoneRunStats：里程碑执行轨迹佐证（轻量，按 run_id 查询）────────────
function MilestoneRunStats({ runId, dispatchedAt, milestoneName }: { runId: string; dispatchedAt?: string; milestoneName: string }) {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const load = async () => {
    if (stats) return
    setLoading(true)
    try {
      const res = await fetch(`/api/run-stats?run_id=${runId}`)
      const data = await res.json()
      if (!data.error) setStats(data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5" />
        执行轨迹
      </h3>
      <Collapsible open={open} onOpenChange={(v) => { setOpen(v); if (v) load() }}>
        <div className="rounded-lg border border-border/50">
          <CollapsibleTrigger className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Terminal className="w-3.5 h-3.5" />
              <span className="font-mono">run:{runId.slice(0, 12)}…</span>
              {dispatchedAt && (
                <span>· {dispatchedAt.slice(0, 16).replace('T', ' ')}</span>
              )}
              {stats && (
                <>
                  {stats.total_tokens != null && (
                    <span className="text-muted-foreground/60">· {(stats.total_tokens as number).toLocaleString()} tokens</span>
                  )}
                  {stats.tool_call_count != null && (
                    <span className="text-muted-foreground/60">· {String(stats.tool_call_count)} 次工具调用</span>
                  )}
                  {stats.total_cost != null && (stats.total_cost as number) > 0 && (
                    <span className="text-emerald-600/70 font-mono">· ${(stats.total_cost as number).toFixed(4)}</span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`https://smith.langchain.com/o/piggya2a/projects/p/onit?run_id=${runId}`}
                target="_blank" rel="noreferrer"
                className="text-xs font-medium hover:underline"
                onClick={e => e.stopPropagation()}
              >
                LangSmith →
              </a>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border/50 px-3 py-3">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  正在从 LangSmith 拉取…
                </div>
              ) : !stats ? (
                <p className="text-xs text-muted-foreground/50 italic py-2">暂无数据</p>
              ) : (() => {
                const s = stats as { total_tokens?: number; tool_call_count?: number; llm_rounds?: number; duration_ms?: number; tool_names?: string[]; model?: string; total_cost?: number }
                const toolNames = Array.isArray(s.tool_names) ? s.tool_names : []
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Tokens', value: s.total_tokens != null ? s.total_tokens.toLocaleString() : '—' },
                        { label: '工具调用', value: s.tool_call_count != null ? String(s.tool_call_count) : '—' },
                        { label: '思考轮次', value: s.llm_rounds != null ? String(s.llm_rounds) : '—' },
                        { label: '耗时', value: s.duration_ms != null ? `${(s.duration_ms / 1000).toFixed(1)}s` : '—' },
                      ].map(item => (
                        <div key={item.label} className="rounded-md bg-muted/50 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-sm font-semibold mt-0.5">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    {toolNames.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">调用的工具</p>
                        <div className="flex flex-wrap gap-1">
                          {toolNames.map(t => (
                            <span key={t} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground/70">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {s.model && (
                      <p className="text-xs text-muted-foreground">
                        模型：<span className="font-mono text-blue-500/70">{s.model.replace('anthropic/', '')}</span>
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  )
}


// ─── Trace Tab ───────────────────────────────────────────────────────────────
function TraceTab({ tenantSlug, meta, isWriting = false, langgraphThreadId }: { tenantSlug: string; meta: TenantMetadata; isWriting?: boolean; langgraphThreadId?: string }) {
  const [data, setData] = useState<TraceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // LangGraph thread_id（从 fetchTrace 设置）
  const [liveThreadId, setLiveThreadId] = useState<string | undefined>(langgraphThreadId)
  // fetchKey 控制 fetchTrace 重运行
  const [fetchKey, setFetchKey] = useState(0)

  // ─── useStream：原生 LangGraph 流式状态，替换旧的 EventSource 轮询 ──────────
  // 只有在有 threadId 时才激活，apiUrl 指向已有的 /api/lg-proxy 安全代理
  // 注意：streamMode/streamSubgraphs 是 submit 级别的参数，不是 hook 初始化选项
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = useStream<Record<string, unknown>>({
    apiUrl: '/api/lg-proxy',
    assistantId: LUMEN_ASSISTANT_ID, // 入口 Agent @Lumen，所有租户的 Thread 都由它开始
    threadId: liveThreadId,
  }) as any // as any 以访问 subagents、toolProgress 等完整属性

  // 从 useStream 派生 threadStatus（替换旧的 SSE 轮询）
  const threadStatus: 'busy' | 'idle' | 'interrupted' | null = stream.isLoading
    ? 'busy'
    : stream.interrupts && stream.interrupts.length > 0
    ? 'interrupted'
    : liveThreadId
    ? 'idle'
    : null

  // resume 中状态
  const [resuming, setResuming] = useState(false)

  // resume interrupt：使用 useStream.submit 发送 command.resume
  const resumeInterrupt = async (value: unknown = true) => {
    if (!liveThreadId) return
    setResuming(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (stream as any).submit(null, { command: { resume: value } })
      toast('已确认，Agent 继续执行', { description: 'interrupt 已 resume，Thread 恢复运行', duration: 3000 })
      setFetchKey(k => k + 1)
    } catch (e) {
      // fallback：直接调 API
      try {
        const res = await fetch('/api/langgraph-trace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: `/threads/${liveThreadId}/runs`,
            method: 'POST',
            body: { assistant_id: LUMEN_ASSISTANT_ID, command: { resume: value } },
          }),
        })
        if (!res.ok) throw new Error(await res.text())
        toast('已确认，Agent 继续执行', { description: 'interrupt 已 resume，Thread 恢复运行', duration: 3000 })
        setFetchKey(k => k + 1)
      } catch (e2) {
        toast('resume 失败', { description: String(e2 ?? e), duration: 3000 })
      }
    } finally {
      setResuming(false)
    }
  }

  // Checkpoint 历史（通过服务端代理查询，不依赖浏览器 SDK）
  const [checkpointsOpen, setCheckpointsOpen] = useState(false)
  const [checkpoints, setCheckpoints] = useState<Array<Record<string, unknown>>>([])
  const [checkpointsLoading, setCheckpointsLoading] = useState(false)
  const fetchCheckpoints = async (threadId: string) => {
    setCheckpointsLoading(true)
    try {
      const res = await fetch('/api/langgraph-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/threads/${threadId}/history` }),
      })
      const history = await res.json()
      if (Array.isArray(history)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filtered = history.filter((cp: any) => {
          const cpMeta = cp.metadata
          const cpNext = cp.next
          return cpMeta?.source === 'loop' && Array.isArray(cpNext) && cpNext.length > 0
        })
        setCheckpoints(filtered)
      }
    } catch { /* ignore */ } finally {
      setCheckpointsLoading(false)
    }
  }

  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null)

  // 取消正在跑的 run（通过服务端代理）
  const cancelRun = useCallback(async (runId: string) => {
    setCancellingRunId(runId)
    try {
      await fetch('/api/langgraph-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/threads/${liveThreadId}/runs/${runId}/cancel`, method: 'POST' }),
      })
      toast('Run 已取消', { description: `run_id: ${runId.slice(0, 8)}…`, duration: 3000 })
      setFetchKey(k => k + 1)
    } catch {
      toast('取消失败', { description: '请稍后重试', duration: 3000 })
    } finally {
      setCancellingRunId(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveThreadId])

  // 时间旅行：从指定 checkpoint 恢复
  const [restoringCheckpointId, setRestoringCheckpointId] = useState<string | null>(null)
  const restoreCheckpoint = async (checkpointId: string) => {
    if (!liveThreadId) return
    setRestoringCheckpointId(checkpointId)
    try {
      // 正确的时间旅行：POST /threads/{id}/runs 带 checkpoint 参数
      // LangGraph 会从该 checkpoint 重新开始执行
      const res = await fetch('/api/langgraph-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/threads/${liveThreadId}/runs`,
          method: 'POST',
          body: {
            assistant_id: LUMEN_ASSISTANT_ID,
            checkpoint: { checkpoint_id: checkpointId },
            input: null,
          },
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText)
      }
      toast('时间旅行成功', { description: `已从 checkpoint ${checkpointId.slice(0, 8)}… 恢复，Agent 重新运行中…`, duration: 3000 })
      setFetchKey(k => k + 1)
    } catch {
      toast('恢复失败', { description: '请稍后重试', duration: 3000 })
    } finally {
      setRestoringCheckpointId(null)
    }
  }

  // Fork Thread（threads.copy）
  const [forking, setForking] = useState(false)
  const forkThread = async () => {
    if (!liveThreadId) return
    setForking(true)
    try {
      const res = await fetch('/api/langgraph-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/threads/${liveThreadId}/copy` }),
      })
      const result = await res.json()
      const newId = result?.thread_id ?? result?.id ?? ''
      toast('Fork 成功', { description: `新 Thread: ${newId.slice(0, 12)}…`, duration: 4000 })
    } catch {
      toast('Fork 失败', { description: '请稍后重试', duration: 3000 })
    } finally {
      setForking(false)
    }
  }

  // LangGraph Store
  const [storeOpen, setStoreOpen] = useState(false)
  const [storeItems, setStoreItems] = useState<Array<{ namespace: string[]; key: string; value: Record<string, unknown>; updated_at?: string }>>([])
  const [storeLoading, setStoreLoading] = useState(false)
  const fetchStore = async () => {
    setStoreLoading(true)
    try {
      const res = await fetch('/api/langgraph-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/store/items/search',
          body: { namespace_prefix: [], limit: 50 },
        }),
      })
      const data = await res.json()
      if (Array.isArray(data?.items)) setStoreItems(data.items)
      else if (Array.isArray(data)) setStoreItems(data)
    } catch { /* ignore */ } finally {
      setStoreLoading(false)
    }
  }

  // LangGraph Crons
  const [cronsOpen, setCronsOpen] = useState(false)
  const [crons, setCrons] = useState<Array<{ cron_id: string; assistant_id: string; schedule: string; enabled: boolean; next_run_date?: string }>>([])
  const [cronsLoading, setCronsLoading] = useState(false)
  const [deletingCronId, setDeletingCronId] = useState<string | null>(null)
  const fetchCrons = async () => {
    setCronsLoading(true)
    try {
      const res = await fetch('/api/langgraph-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/crons' }),
      })
      const data = await res.json()
      if (Array.isArray(data)) setCrons(data)
    } catch { /* ignore */ } finally {
      setCronsLoading(false)
    }
  }
  const deleteCron = async (cronId: string) => {
    setDeletingCronId(cronId)
    try {
      await fetch('/api/langgraph-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/crons/${cronId}`, method: 'DELETE' }),
      })
      toast('Cron 已删除', { duration: 3000 })
      fetchCrons()
    } catch {
      toast('删除失败', { duration: 3000 })
    } finally {
      setDeletingCronId(null)
    }
  }

  const fetchTrace = () => {
    setLoading(true)
    // 通过 Next.js API route 查 LangGraph（服务端安全读取 API key）
    const lg = (path: string, body?: unknown) => fetch('/api/langgraph-trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, body })
    }).then(r => r.json())
    // 如果有 langgraphThreadId，直接用它查；否则 fallback 到 tenant_slug 搜索
    const getThreads = langgraphThreadId
      ? Promise.resolve([{ thread_id: langgraphThreadId, metadata: {} }])
      : lg('/threads/search', { metadata: { tenant_slug: tenantSlug }, limit: 20 })
    getThreads
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
        const timelineBase = allRuns.slice(0, 20).map(r => ({
          id: r.run_id,
          tool: agentName(r.assistant_id),
          status: r.status,
          start_time: r.created_at,
          end_time: r.updated_at,
          root_run_name: agentName(r.assistant_id) || 'Agent',
          has_output: r.status === 'success',
          error: r.status === 'error' ? '执行失败' : null,
          stats_loaded: false,
        }))

        // 并发拉取每个 run 的量化指标
        const statsResults = await Promise.allSettled(
          timelineBase.map(item =>
            fetch(`/api/run-stats?run_id=${item.id}`).then(r => r.json())
          )
        )
        const timeline: TraceTimelineItem[] = timelineBase.map((item, i) => {
          const statsResult = statsResults[i]
          if (statsResult.status === 'fulfilled' && !statsResult.value.error) {
            const s = statsResult.value
            return { ...item, ...s, stats_loaded: true }
          }
          return item
        })

        // 从所有里程碑的 evidence 字段收集截图 URL
        const evidenceUrls: string[] = (meta?.milestones ?? []).flatMap(
          (m: MilestoneData & { evidence?: string[] }) => m.evidence ?? []
        )
        const latestThread = threads[0]
        const threadId = latestThread?.thread_id ?? ''
        setLiveThreadId(threadId)

        const parsed: TraceData = {
          total_calls: allRuns.length,
          agents: [...new Set(allRuns.map(r => agentName(r.assistant_id)))],
          timeline,
          artifacts: [],
          screenshots: evidenceUrls,
          thread_id: threadId,
        }
        setData(parsed)
        setLoading(false)
      })
      .catch(e => { setError(String(e)); setLoading(false) })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTrace() }, [tenantSlug, fetchKey, langgraphThreadId])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">Trace</Badge>
            <Badge variant="secondary" className="text-xs">LangSmith</Badge>
            {data && <Badge variant="outline" className="text-xs">{data.total_calls} 次 Run</Badge>}
            {threadStatus === 'busy' && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Agent 执行中
              </span>
            )}
            {threadStatus === 'interrupted' && (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                等待确认
              </span>
            )}
            {threadStatus === 'idle' && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                空闲
              </span>
            )}
          </div>
          <button
            onClick={() => setFetchKey(k => k + 1)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
        </div>
        {/* interrupt 详情 + resume 按钮 */}
        {/* 多重 Interrupt 展示（遍历 stream.interrupts 数组，支持子图中断） */}
        {stream.interrupts && stream.interrupts.length > 0 && (
          <div className="space-y-2">
            {(stream.interrupts as unknown[]).map((interrupt: unknown, idx: number) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const intAny = interrupt as any
              const intValue = intAny?.value ?? intAny?.interrupt_value ?? null
              const intStr = intValue != null ? String(intValue) : null
              return (
                <div key={idx} className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Agent 等待确认
                        {stream.interrupts.length > 1 && (
                          <span className="ml-1.5 text-xs text-amber-600/60">({idx + 1}/{stream.interrupts.length})</span>
                        )}
                      </p>
                      {intStr && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 break-words">{intStr}</p>
                      )}
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">点击「确认继续」让 Agent 继续执行，或「拒绝」取消此次操作。</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm" variant="outline"
                      disabled={resuming}
                      onClick={() => resumeInterrupt(false)}
                      className="text-xs h-7 px-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                    >
                      {resuming ? <Loader2 className="w-3 h-3 animate-spin" /> : '拒绝'}
                    </Button>
                    <Button
                      size="sm"
                      disabled={resuming}
                      onClick={() => resumeInterrupt(true)}
                      className="text-xs h-7 px-3 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {resuming ? <Loader2 className="w-3 h-3 animate-spin" /> : '确认继续'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <h2 className="text-2xl font-bold tracking-tight">执行轨迹</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Thread 实时镜像——Agent 每跑一步自动更新，不需刷新。如有 interrupt，在此直接确认。
          Thread：<code className="text-xs font-mono bg-muted px-1 rounded">{liveThreadId ? liveThreadId.slice(0, 12) + '…' : tenantSlug}</code>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">累计 Run 次数</p>
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
                <p className="text-xs text-muted-foreground">总 Token 消耗</p>
                <p className="text-2xl font-bold mt-1">
                  {data.timeline.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">全部 run 累计</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">估算成本</p>
                <p className="text-2xl font-bold mt-1">
                  {(() => {
                    const total = data.timeline.reduce((sum, r) => sum + (r.total_cost ?? 0), 0)
                    return total > 0 ? `$${total.toFixed(4)}` : '—'
                  })()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.timeline.some(r => r.cost_estimated) ? '含估算值' : 'LangSmith 原生'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ─── Tool Call 实时状态面板（useStream.toolProgress） ──────────────── */}
          {stream.toolProgress && stream.toolProgress.length > 0 && (
            <Section icon={Activity} title="工具执行实时状态" subtitle="当前正在执行的工具调用，包括子图中的工具">
              <div className="space-y-2">
                {(stream.toolProgress as unknown[]).map((tp: unknown, i: number) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const tpAny = tp as any
                  const toolName: string = tpAny?.name ?? tpAny?.tool_name ?? '未知工具'
                  const toolStatus: string = tpAny?.status ?? 'running'
                  const toolArgs = tpAny?.args ?? tpAny?.input ?? null
                  const toolResult = tpAny?.result ?? tpAny?.output ?? null
                  const isRunning = toolStatus === 'running' || toolStatus === 'pending'
                  const isError = toolStatus === 'error'

                  // 截图工具：steel_screenshot / take_screenshot / screenshot
                  const isScreenshotTool = /screenshot/i.test(toolName)
                  // 截图 URL 可能在 result.url 或 result.screenshot_url 或 result 本身
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const screenshotUrl: string | null = isScreenshotTool
                    ? (typeof toolResult === 'string' && toolResult.startsWith('http') ? toolResult
                      : (toolResult as any)?.url ?? (toolResult as any)?.screenshot_url ?? null)
                    : null

                  // 代码执行工具：execute_code / run_code / python_repl
                  const isCodeTool = /execute_code|run_code|python_repl|code_interpreter/i.test(toolName)
                  const codeInput: string | null = isCodeTool
                    ? (typeof toolArgs === 'string' ? toolArgs
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      : (toolArgs as any)?.code ?? (toolArgs as any)?.source ?? null)
                    : null
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const codeOutput: string | null = isCodeTool
                    ? (typeof toolResult === 'string' ? toolResult
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      : (toolResult as any)?.stdout ?? (toolResult as any)?.output ?? (toolResult as any)?.result ?? null)
                    : null

                  return (
                    <div key={i} className={`rounded-md border px-3 py-2 ${
                      isRunning ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20' :
                      isError ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20' :
                      'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isRunning && <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />}
                        {!isRunning && !isError && <span className="w-3 h-3 text-emerald-500 shrink-0">✓</span>}
                        {isError && <span className="w-3 h-3 text-red-500 shrink-0">✗</span>}
                        {isScreenshotTool && <Image className="w-3 h-3 text-purple-500 shrink-0" />}
                        {isCodeTool && <Terminal className="w-3 h-3 text-orange-500 shrink-0" />}
                        <code className="text-xs font-mono font-medium">{toolName}</code>
                        <Badge
                          variant={isError ? 'destructive' : isRunning ? 'secondary' : 'default'}
                          className="text-xs ml-auto"
                        >
                          {isRunning ? '执行中…' : isError ? '失败' : '完成'}
                        </Badge>
                      </div>

                      {/* B6: 截图工具——实时显示截图 */}
                      {isScreenshotTool && screenshotUrl && (
                        <div className="mt-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={screenshotUrl}
                            alt="截图"
                            className="rounded border border-border max-h-48 object-contain w-full cursor-zoom-in"
                            referrerPolicy="no-referrer"
                            onClick={() => window.open(screenshotUrl, '_blank')}
                          />
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">点击放大</p>
                        </div>
                      )}
                      {isScreenshotTool && isRunning && !screenshotUrl && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          截图中…
                        </div>
                      )}

                      {/* B5: 代码执行工具——代码块 + stdout */}
                      {isCodeTool && codeInput && (
                        <details className="mt-1.5" open>
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">代码</summary>
                          <pre className="text-xs font-mono bg-zinc-900 text-zinc-100 rounded p-2 mt-1 overflow-x-auto max-h-40 whitespace-pre-wrap">
                            {codeInput.slice(0, 800)}
                          </pre>
                        </details>
                      )}
                      {isCodeTool && codeOutput && (
                        <details className="mt-1" open={!isRunning}>
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">stdout / 返回値</summary>
                          <pre className="text-xs font-mono bg-muted/50 rounded p-2 mt-1 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
                            {codeOutput.slice(0, 600)}
                          </pre>
                        </details>
                      )}

                      {/* 其他工具——通用入参/返回値 */}
                      {!isScreenshotTool && !isCodeTool && toolArgs && (
                        <details className="mt-1.5">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">入参</summary>
                          <pre className="text-xs font-mono bg-muted/50 rounded p-2 mt-1 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">
                            {typeof toolArgs === 'string' ? toolArgs : JSON.stringify(toolArgs, null, 2)}
                          </pre>
                        </details>
                      )}
                      {!isScreenshotTool && !isCodeTool && toolResult && (
                        <details className="mt-1">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">返回値</summary>
                          <pre className="text-xs font-mono bg-muted/50 rounded p-2 mt-1 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">
                            {typeof toolResult === 'string' ? toolResult.slice(0, 500) : JSON.stringify(toolResult, null, 2).slice(0, 500)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* ─── Subgraph 子任务展开（useStream.subagents） ───────────────────── */}
          {stream.subagents && stream.subagents.size > 0 && (
            <Section icon={GitBranch} title="子 Agent 活动" subtitle="当前已派遣的子图 Agent，展开可看内部执行轨迹">
              <div className="space-y-3">
                {Array.from((stream.subagents as Map<string, unknown>).entries()).map(([toolCallId, subagent]: [string, unknown]) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const saAny = subagent as any
                  const saStatus: string = saAny?.status ?? 'running'
                  const saToolCall = saAny?.toolCall ?? {}
                  const saName: string = saToolCall?.name ?? saToolCall?.function?.name ?? '子 Agent'
                  const saArgs = saToolCall?.args ?? saToolCall?.function?.arguments ?? null
                  const saMessages: unknown[] = saAny?.messages ?? []
                  const isActive = saStatus === 'running' || saStatus === 'pending'
                  return (
                    <div key={toolCallId} className={`rounded-md border-l-2 pl-3 py-2 ${
                      isActive ? 'border-l-blue-400' : 'border-l-emerald-400'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isActive && <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />}
                        {!isActive && <span className="text-emerald-500 text-xs">✓</span>}
                        <Badge variant="outline" className="text-xs font-mono">
                          {saName === 'task' ? '🚀 子 Agent' : `⚙️ ${saName}`}
                        </Badge>
                        <Badge variant={isActive ? 'secondary' : 'default'} className="text-xs">
                          {isActive ? '运行中' : '已完成'}
                        </Badge>
                        <code className="text-xs font-mono text-muted-foreground/50 ml-auto">{toolCallId.slice(0, 8)}…</code>
                      </div>
                      {saArgs && (
                        <details className="mt-1.5">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">派遣参数</summary>
                          <pre className="text-xs font-mono bg-muted/50 rounded p-2 mt-1 overflow-x-auto max-h-20 whitespace-pre-wrap break-all">
                            {typeof saArgs === 'string' ? saArgs.slice(0, 400) : JSON.stringify(saArgs, null, 2).slice(0, 400)}
                          </pre>
                        </details>
                      )}
                      {saMessages.length > 0 && (
                        <details className="mt-1">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            内部消息（{saMessages.length} 条）
                          </summary>
                          <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
                            {saMessages.slice(-5).map((msg, mi) => {
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              const m = msg as any
                              const mType: string = m?.type ?? m?.role ?? 'unknown'
                              const mContent: string = typeof m?.content === 'string'
                                ? m.content.slice(0, 200)
                                : JSON.stringify(m?.content ?? '').slice(0, 200)
                              return (
                                <div key={mi} className="flex gap-1.5">
                                  <Badge variant="outline" className="text-[10px] font-mono shrink-0 h-4">{mType}</Badge>
                                  <p className="text-xs text-muted-foreground break-words">{mContent}</p>
                                </div>
                              )
                            })}
                          </div>
                        </details>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

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
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground/60 font-mono">
                              {new Date(item.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
                            <span className="text-xs text-muted-foreground/50">{item.root_run_name}</span>
                            {item.stats_loaded && (
                              <>
                                {item.model && (
                                  <>
                                    <span className="text-xs text-muted-foreground/40">·</span>
                                    <span className="text-xs text-blue-500/70 font-mono">{item.model.replace('anthropic/', '')}</span>
                                  </>
                                )}
                                <span className="text-xs text-muted-foreground/40">·</span>
                                <span className="text-xs text-muted-foreground/60 font-mono">
                                  {(item.total_tokens ?? 0).toLocaleString()} tokens
                                </span>
                                <span className="text-xs text-muted-foreground/40">·</span>
                                <span className="text-xs text-muted-foreground/60">
                                  {item.llm_rounds} 轮思考
                                </span>
                                <span className="text-xs text-muted-foreground/40">·</span>
                                <span className="text-xs text-muted-foreground/60">
                                  {item.tool_call_count} 次工具调用
                                </span>
                                {item.tool_names && item.tool_names.length > 0 && (
                                  <>
                                    <span className="text-xs text-muted-foreground/40">·</span>
                                    <span className="inline-flex flex-wrap gap-0.5">
                                      {item.tool_names.map((t) => (
                                        <span key={t} className="text-[10px] font-mono bg-muted px-1 py-0.5 rounded text-muted-foreground/70">{t}</span>
                                      ))}
                                    </span>
                                  </>
                                )}
                                {item.total_cost != null && item.total_cost > 0 && (
                                  <>
                                    <span className="text-xs text-muted-foreground/40">·</span>
                                    <span className="text-xs text-emerald-600/70 font-mono">
                                      ${item.total_cost.toFixed(4)}{item.cost_estimated ? ' ≈' : ''}
                                    </span>
                                  </>
                                )}
                                {item.duration_ms && (
                                  <>
                                    <span className="text-xs text-muted-foreground/40">·</span>
                                    <span className="text-xs text-muted-foreground/60">
                                      {(item.duration_ms / 1000).toFixed(1)}s
                                    </span>
                                  </>
                                )}
                                {item.first_token_ms != null && item.first_token_ms > 0 && (
                                  <>
                                    <span className="text-xs text-muted-foreground/40">·</span>
                                    <span className="text-xs text-muted-foreground/60">
                                      TTFT {(item.first_token_ms / 1000).toFixed(1)}s
                                    </span>
                                  </>
                                )}
                                {item.feedback_stats && Object.keys(item.feedback_stats).length > 0 && (
                                  <>
                                    <span className="text-xs text-muted-foreground/40">·</span>
                                    {Object.entries(item.feedback_stats).map(([k, v]) => (
                                      <span key={k} className="text-xs text-amber-600/70">
                                        {k}: {v.avg.toFixed(1)}
                                      </span>
                                    ))}
                                  </>
                                )}
                              </>
                            )}
                          </div>
                          {item.error && (
                            <p className="text-xs text-destructive mt-0.5 truncate">{item.error}</p>
                          )}
                        </div>
                        {/* Cancel Run 按鈕：只对 pending/running 状态显示 */}
                        {(item.status === 'pending' || item.status === 'running') && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                                    onClick={() => cancelRun(item.id)}
                                    disabled={cancellingRunId === item.id}
                                  />
                                }
                              >
                                {cancellingRunId === item.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <StopCircle className="w-3 h-3" />}
                              </TooltipTrigger>
                              <TooltipContent>取消此 Run（interrupt 模式，保留 checkpoint）</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Section>

          {/* Checkpoint 时间线（LangGraph 原生，折叠展示） */}
          {liveThreadId && (
            <Section icon={History} title="Checkpoint 历史" subtitle="LangGraph 每步写入一个 checkpoint，可用于时间旅行和回滚">
              <Collapsible open={checkpointsOpen} onOpenChange={(v) => { setCheckpointsOpen(v); if (v && liveThreadId && checkpoints.length === 0) fetchCheckpoints(liveThreadId) }}>
                <Card>
                  <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors">
                    <span className="text-xs text-muted-foreground">
                      {checkpoints.length > 0 ? `${checkpoints.length} 个 checkpoint` : '点击加载 checkpoint 历史'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${checkpointsOpen ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border">
                      {checkpointsLoading ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground/50">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          正在加载…
                        </div>
                      ) : checkpoints.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-muted-foreground/50 italic">暂无 checkpoint（Agent 尚未运行）</div>
                      ) : (
                        <div className="divide-y divide-border/30">
                          {checkpoints.map((cp, i) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const cpAny = cp as any
                            const cpId: string = cpAny.config?.configurable?.checkpoint_id ?? cpAny.checkpoint_id ?? ''
                            const cpMeta = cpAny.metadata ?? {}
                            const cpCreatedAt: string = cpAny.created_at ?? ''
                            return (
                            <div key={cpId || i} className="flex items-start gap-3 px-4 py-2.5">
                              <span className="text-xs font-mono text-muted-foreground/40 shrink-0 pt-0.5 w-5 text-right">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                    {cpId ? cpId.slice(0, 8) + '…' : '未知'}
                                  </code>
                                  {cpMeta.step != null && (
                                    <Badge variant="outline" className="text-xs">step {cpMeta.step}</Badge>
                                  )}
                                  {cpMeta.source && (
                                    <Badge variant="secondary" className="text-xs font-mono">{cpMeta.source}</Badge>
                                  )}
                                </div>
                                {cpCreatedAt && (
                                  <span className="text-xs text-muted-foreground/50 font-mono mt-0.5 block">
                                    {new Date(cpCreatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                )}
                                {cpMeta.writes && Object.keys(cpMeta.writes).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {Object.keys(cpMeta.writes).map((k: string) => (
                                      <Badge key={k} variant="outline" className="text-xs font-mono text-muted-foreground">{k}</Badge>
                                    ))}
                                  </div>
                                )}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="mt-1.5 h-6 text-xs text-muted-foreground hover:text-foreground px-2"
                                          disabled={restoringCheckpointId === cpId}
                                          onClick={() => cpId && restoreCheckpoint(cpId)}
                                        />
                                      }
                                    >
                                      {restoringCheckpointId === cpId ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <History className="w-3 h-3 mr-1" />}
                                      从此恢复
                                    </TooltipTrigger>
                                    <TooltipContent>时间旅行：将 Thread 状态回滚到此 checkpoint，然后重新运行</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </Section>
          )}

          {/* 对话流（仅展示历史消息，不需要实时 SDK） */}
          {data.messages && data.messages.length > 0 && (
            <Section icon={MessageCircle} title="对话流" subtitle={`Thread ${data.thread_id ? data.thread_id.slice(0, 8) + '…' : ''} · ${data.messages.length} 条消息`}>
              <div className="space-y-2">
                {data.messages.map((msg) => {
                  if (msg.type === 'human') return (
                    <Card key={msg.id} className="border-l-2" style={{ borderLeftColor: 'var(--onit-blue)' }}>
                      <CardContent className="pt-3 pb-3">
                        <Badge variant="secondary" className="text-xs mb-1.5">用户</Badge>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </CardContent>
                    </Card>
                  )
                  if (msg.type === 'tool') {
                    const isErr = msg.content.includes('"ok": false') || msg.content.toLowerCase().includes('error')
                    return (
                      <div key={msg.id} className="pl-5 flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 mt-1 text-muted-foreground/40 shrink-0" />
                        <div className="flex-1 rounded-md border border-border/40 bg-muted/30 px-3 py-2">
                          <Badge variant="outline" className="text-xs font-mono mb-1" style={{ color: isErr ? 'var(--onit-red)' : 'var(--onit-green)', borderColor: isErr ? 'var(--onit-red)' : 'var(--onit-green)' }}>
                            {isErr ? '✗' : '✓'} {msg.name ?? 'tool'}
                          </Badge>
                          <p className="text-xs text-muted-foreground font-mono break-all">{msg.content.slice(0, 300)}{msg.content.length > 300 ? '…' : ''}</p>
                        </div>
                      </div>
                    )
                  }
                  if (msg.type === 'ai') {
                    const hasTools = msg.tool_calls && msg.tool_calls.length > 0
                    const isSubAgent = msg.tool_calls?.some((tc) => tc.name === 'task')
                    return (
                      <Card key={msg.id} className={isSubAgent ? 'border-l-2' : ''} style={isSubAgent ? { borderLeftColor: 'var(--onit-green)' } : {}}>
                        <CardContent className="pt-3 pb-3">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <Badge variant="outline" className="text-xs">@Lumen</Badge>
                            {hasTools && <Badge variant="secondary" className="text-xs">{msg.tool_calls!.length} 个工具调用</Badge>}
                            {isSubAgent && <Badge className="text-xs" style={{ background: 'var(--onit-green-muted)', color: 'var(--onit-green)' }}>派遣子 Agent</Badge>}
                          </div>
                          {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap mb-2">{msg.content.slice(0, 800)}{msg.content.length > 800 ? '…' : ''}</p>}
                          {hasTools && (
                            <div className="flex flex-wrap gap-1.5">
                              {msg.tool_calls!.map((tc) => (
                                <Badge key={tc.id} variant="outline" className="text-xs font-mono text-muted-foreground">
                                  {tc.name === 'task' ? '🚀 ' : '⚙️ '}{tc.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  }
                  return null
                })}
              </div>
            </Section>
          )}

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

          {/* LangGraph Store — 跨 Thread 持久化 KV */}
          <Section icon={Layers} title="Store（跨 Thread 知识库）" subtitle="LangGraph 原生持久化 KV，子 Agent 产出可跨 MCSP 复用">
            <Collapsible open={storeOpen} onOpenChange={(v) => { setStoreOpen(v); if (v && storeItems.length === 0) fetchStore() }}>
              <CollapsibleTrigger className="w-full">
                <Button variant="outline" size="sm" className="w-full justify-between pointer-events-none">
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    {storeOpen ? '收起 Store' : '展开 Store'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${storeOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-2">
                  <CardContent className="pt-3 pb-3">
                    {storeLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />加载中…</div>
                    ) : storeItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 italic py-2">Store 为空（尚无跨 Thread 共享数据）</p>
                    ) : (
                      <div className="space-y-2">
                        {storeItems.map((item, i) => (
                          <div key={i} className="rounded-md border border-border/40 bg-muted/20 px-3 py-2">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs font-mono">{item.namespace.join('/')}</Badge>
                              <code className="text-xs text-muted-foreground">{item.key}</code>
                              {item.updated_at && <span className="text-xs text-muted-foreground/50 ml-auto">{new Date(item.updated_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                            </div>
                            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto">{JSON.stringify(item.value, null, 2).slice(0, 400)}</pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </Section>

          {/* LangGraph Crons — 原生定时任务 */}
          <Section icon={Clock} title="Cron Jobs" subtitle="LangGraph 原生定时任务，可替代 pg_cron">
            <Collapsible open={cronsOpen} onOpenChange={(v) => { setCronsOpen(v); if (v && crons.length === 0) fetchCrons() }}>
              <CollapsibleTrigger className="w-full">
                <Button variant="outline" size="sm" className="w-full justify-between pointer-events-none">
                  <span className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    {cronsOpen ? '收起 Crons' : '展开 Crons'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${cronsOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-2">
                  <CardContent className="pt-3 pb-3">
                    {cronsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />加载中…</div>
                    ) : crons.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 italic py-2">暂无 Cron Job（当前使用 Supabase pg_cron）</p>
                    ) : (
                      <div className="space-y-2">
                        {crons.map((cron) => (
                          <div key={cron.cron_id} className="rounded-md border border-border/40 bg-muted/20 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={cron.enabled ? 'default' : 'secondary'} className="text-xs">{cron.enabled ? '开启' : '关闭'}</Badge>
                              <code className="text-xs font-mono text-muted-foreground flex-1">{cron.schedule}</code>
                              <Badge variant="outline" className="text-xs font-mono">{cron.assistant_id.slice(0, 8)}…</Badge>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                        disabled={deletingCronId === cron.cron_id}
                                        onClick={() => deleteCron(cron.cron_id)}
                                      />
                                    }
                                  >
                                    {deletingCronId === cron.cron_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <StopCircle className="w-3 h-3" />}
                                  </TooltipTrigger>
                                  <TooltipContent>删除此 Cron Job</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            {cron.next_run_date && <p className="text-xs text-muted-foreground/50 mt-1">下次运行：{new Date(cron.next_run_date).toLocaleString('zh-CN')}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </Section>

          {/* Fork Thread */}
          {liveThreadId && (
            <Section icon={GitBranch} title="Thread 操作" subtitle="Fork 当前 Thread 创建平行实验分支">
              <div className="flex items-center gap-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={forking}
                          onClick={forkThread}
                          className="flex items-center gap-2"
                        />
                      }
                    >
                      {forking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
                      Fork Thread
                    </TooltipTrigger>
                    <TooltipContent>复制当前 Thread 状态，创建平行实验分支，不破坏主线</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="text-xs text-muted-foreground">当前 Thread: <code className="font-mono">{liveThreadId.slice(0, 12)}…</code></p>
              </div>
            </Section>
          )}

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
function McspTab({ meta, runDays, isWriting = false }: { meta: TenantMetadata; runDays: number; isWriting?: boolean }) {
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
      <Section icon={Target} title="1. 目标与背景" subtitle="我们双方对「这次合作是什么」的共同认知" id="mcsp-1">
        <div className="divide-y divide-border/50">
          <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2.5">
            <span className="text-xs text-muted-foreground pt-0.5 font-medium">客户名称</span>
            <span className="text-sm">{client.name}</span>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2.5">
            <span className="text-xs text-muted-foreground pt-0.5 font-medium">客户成功经理</span>
            <span className="text-sm">@{client.lumen}</span>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2.5">
            <span className="text-xs text-muted-foreground pt-0.5 font-medium">执行工程师</span>
            <span className="text-sm">@{client.sega}</span>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2.5">
            <span className="text-xs text-muted-foreground pt-0.5 font-medium">客户负责人</span>
            <span className="text-sm">{client.client_lead || <Pending />}</span>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2.5">
            <span className="text-xs text-muted-foreground pt-0.5 font-medium">合同开始日期</span>
            <span className="text-sm font-mono">{client.contract_start}</span>
          </div>
          {mcsp.context && (
            <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2.5">
              <span className="text-xs text-muted-foreground pt-0.5 font-medium">背景说明</span>
              <Md>{mcsp.context}</Md>
            </div>
          )}
          <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2.5">
            <span className="text-xs text-muted-foreground pt-0.5 font-medium">合作目标</span>
            {mcsp.goal ? <Md>{mcsp.goal}</Md> : <Pending />}
          </div>
        </div>
      </Section>

      {/* Block 2: 现状 vs 理想状态 */}
      <Section icon={ArrowRight} title="2. 现状 → 理想状态" subtitle="起点和终点的对比，成功标准从这里推导" id="mcsp-2">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-semibold mb-2">现状（As-Is）</h3>
            <p className="text-xs text-muted-foreground mb-3">我们现在的处境</p>
            {mcsp.as_is
              ? <Md>{typeof mcsp.as_is === 'string' ? mcsp.as_is : mcsp.as_is.join('\n')}</Md>
              : <Pending />}
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">理想状态（To-Be）</h3>
            <p className="text-xs text-muted-foreground mb-3">3 个月后我们希望庆祝什么</p>
            {mcsp.to_be
              ? <Md>{typeof mcsp.to_be === 'string' ? mcsp.to_be : mcsp.to_be.join('\n')}</Md>
              : <Pending />}
          </div>
        </div>
      </Section>

      {/* Block 3: 成功标准 */}
      <Section icon={CheckCircle2} title="3. 成功标准（Success Criteria）" subtitle="可量化、可验证的指标——这是我们验收和续约的唯一依据" id="mcsp-3">
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
      </Section>

      {/* Block 4: 角色与职责 */}
      <Section icon={Users} title="4. 角色与职责（RACI）" subtitle="明确我们每个人对这个项目负什么责" id="mcsp-4">
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
      </Section>

      {/* Block 5: 里程碑 */}
      <Section icon={Flag} title="5. 里程碑（Milestones）" subtitle="ONIT WhileLoop 的四个节点——找到、设计、试运行、验证通过" id="mcsp-5">
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
      </Section>

      {/* Block 6: 风险登记 */}
      <Section icon={AlertTriangle} title="6. 风险登记（Risk Register）" subtitle="提前写下可能让我们卡住的事" id="mcsp-6">
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
      </Section>

      {/* Block 7: 交接与 Cadence */}
      <Section icon={GitBranch} title="7. 交接 & 节奏（Handoff & Cadence）" subtitle="这份文档怎么活着" id="mcsp-7">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-semibold mb-2">同步节奏</h3>
            <p className="text-xs text-muted-foreground mb-3">定期见面是我们保持对齐的方式</p>
            {mcsp.cadence && mcsp.cadence.length > 0 ? (
              <div className="divide-y divide-border/40">
                {mcsp.cadence.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 py-2">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{c.type}</div>
                      <div className="text-xs text-muted-foreground">{c.frequency} · {c.owner}</div>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{c.duration}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/50 italic">待填写</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">什么时候我们视为完成</h3>
            <p className="text-xs text-muted-foreground mb-3">续约谈判的起点，也是这份计划的终点</p>
            <ul className="space-y-2">
              {[
                `M0-M3 里程碑全部完成（当前 ${doneMilestones}/4）`,
                '成功标准中所有指标达到目标值',
                `${client.client_lead || '客户负责人'} 签字确认验收报告`,
                '续约/扩容/结束决策已明确并记录',
                'Agent 运行数据已归档，链接写入本文档',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Block 8: 凭证清单 */}
      <Section icon={Key} title="8. 凭证清单（Credentials）" subtitle="集成所需的账号、API Key 和权限清单" id="mcsp-8">
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
          <p className="text-sm text-muted-foreground/50 italic">待填写</p>
        )}
      </Section>

      {/* @Eva 审计结论：独立数据单元，保留 Card */}
      <Section icon={AlertTriangle} title="@Eva 审计结论" subtitle="M3 阶段由 @Eva 执行，结论实时更新" id="mcsp-eva">
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
            {audit.eva_note && (
              <div className="rounded-lg border border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/20 px-3 py-2 space-y-1">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">@Eva 备注</p>
                <Md isAnimating={isWriting}>{audit.eva_note}</Md>
              </div>
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
function OmtTab({ meta, runDays, tenantSlug, tenantId, isWriting = false, langgraphThreadId }: {
  meta: TenantMetadata
  runDays: number
  tenantSlug: string
  tenantId: string
  isWriting?: boolean
  langgraphThreadId?: string
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
    fetch('/api/agent-registry').then(r => r.json()).then(d => setAgentRegistry(d.agents ?? [])).catch(() => setAgentRegistry([]))
  }, [])

  // ─── B7: Agent Market 派遣 Sheet state ───────────────────────────────────────────
  const [dispatchSheetOpen, setDispatchSheetOpen] = useState(false)
  const [dispatchTarget, setDispatchTarget] = useState<{ id: string; name: string } | null>(null)
  const [dispatchTask, setDispatchTask] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [dispatchResult, setDispatchResult] = useState<string | null>(null)

  const dispatchAgent = async () => {
    if (!dispatchTarget || !dispatchTask.trim() || !langgraphThreadId) return
    setDispatching(true)
    setDispatchResult(null)
    try {
      // 通过 AgentChat 相同的 /api/agent-chat 路由向对应 Agent 发送任务
      const resp = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistant_id: dispatchTarget.id,
          message: dispatchTask.trim(),
          thread_id: langgraphThreadId, // 共用同一个 Thread
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      // 读取 SSE 流，只取最后一条 AI 消息作为结果
      const reader = resp.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventType = ''
      let lastContent = ''
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (line.startsWith('event:')) { eventType = line.slice(6).trim() }
            else if (line.startsWith('data:') && eventType === 'values') {
              try {
                const payload = JSON.parse(line.slice(5).trim())
                const msgs: Array<{ role?: string; type?: string; content?: string }> = payload?.messages ?? []
                const lastAi = [...msgs].reverse().find(m => m.role === 'assistant' || m.type === 'ai')
                if (lastAi?.content) lastContent = lastAi.content
              } catch { /* ignore */ }
              eventType = ''
            }
          }
        }
      }
      setDispatchResult(lastContent || '派遣完成，Agent 已接收任务')
      setDispatchTask('')
    } catch (e) {
      setDispatchResult(`失败：${String(e)}`)
    } finally {
      setDispatching(false)
    }
  }

  // 调度日志（pg_cron 历史，已归档，不再渲染）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dispatcherLog, setDispatcherLog] = useState<Array<{ runid: number; status: string; start_time: string; end_time: string; return_message: string }> | null>(null)

  // ─── useStream：监听 Thread 实时状态（thread status / interrupts）─────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const omtStream = useStream<Record<string, unknown>>({
    apiUrl: '/api/lg-proxy',
    assistantId: LUMEN_ASSISTANT_ID, // 入口 Agent @Lumen
    threadId: langgraphThreadId,
  }) as any

  // ─── B3 fix: 从 LangGraph GET /threads/{id}/runs 拉取真实 Runs ─────────────
  type LgRun = {
    run_id: string; assistant_id: string; status: string
    created_at: string; updated_at?: string
    thread_id: string; thread_status: string
    interrupt_reason?: string; tool_calls_count?: number
    tool_name?: string; tool_args?: unknown
  }
  const [lgRuns, setLgRuns] = useState<LgRun[] | null>(null)
  const [lgRunsLoading, setLgRunsLoading] = useState(false)

  const fetchLgRuns = useCallback(async () => {
    if (!langgraphThreadId) return
    setLgRunsLoading(true)
    try {
      const res = await fetch('/api/langgraph-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/threads/${langgraphThreadId}/runs` }),
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const runs: LgRun[] = data.map((r: any) => ({
          run_id: r.run_id ?? r.id ?? '',
          assistant_id: r.assistant_id ?? LUMEN_ASSISTANT_ID,
          status: r.status ?? 'unknown',
          created_at: r.created_at ?? '',
          updated_at: r.updated_at,
          thread_id: langgraphThreadId,
          thread_status: omtStream.isLoading ? 'busy' : omtStream.interrupts?.length > 0 ? 'interrupted' : 'idle',
          interrupt_reason: r.kwargs?.config?.metadata?.interrupt_reason,
          tool_calls_count: r.kwargs?.config?.metadata?.tool_calls_count,
        }))
        setLgRuns(runs)
      }
    } catch { setLgRuns([]) } finally { setLgRunsLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langgraphThreadId])

  useEffect(() => { fetchLgRuns() }, [fetchLgRuns])
  // 当 Thread 从 busy 变为 idle 时自动刷新 Runs
  const prevBusy = useRef(false)
  useEffect(() => {
    const isBusy = !!omtStream.isLoading
    if (prevBusy.current && !isBusy) { fetchLgRuns() }
    prevBusy.current = isBusy
  }, [omtStream.isLoading, fetchLgRuns])

  // traceStats 从真实 runs 计算
  const traceStats = useMemo(() => {
    if (!lgRuns) return null
    const totalCalls = lgRuns.reduce((acc, r) => acc + (r.tool_calls_count ?? 0), 0)
    const agentIds = new Set(lgRuns.map(r => r.assistant_id))
    const agents = Array.from(agentIds).map(id => agentName(id))
    const successCount = lgRuns.filter(r => r.status === 'success').length
    return {
      total_calls: totalCalls,
      agents,
      success_count: successCount,
      pass_rate: lgRuns.length > 0 ? Math.round((successCount / lgRuns.length) * 100) : null,
    }
  }, [lgRuns])

  // PostHog 客户活跃度
  const [posthogActivity, setPosthogActivity] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    fetch(`/api/posthog-activity?tenant_id=${tenantId}&tenant_slug=${tenantSlug}`)
      .then(r => r.json())
      .then(d => setPosthogActivity(d.events ?? null))
      .catch(() => setPosthogActivity(null))
  }, [tenantId, tenantSlug])

  return (
    <div id="section-omt" className="space-y-8 scroll-mt-24">
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
            { label: '调度机制', desc: '@Lumen 在 Thread 内直接 task() 派遣子 Agent，同一个 Thread 共享上下文，不再需要 Dispatcher 轮询' },
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
        {/* #5 与客户沟通次数（来自 update_log type=user_message 条目数）*/}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">与客户沟通次数</p>
                <p className="text-2xl font-bold mt-1">
                  {meta.update_log?.filter(l => l.type === 'user_message').length ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">update_log · user_message</p>
              </div>
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        {/* #6 试运行通过率（LangSmith run success / total）*/}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">试运行通过率</p>
                <div className="mt-1">
                  {traceStats === null ? (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />加载中…</div>
                  ) : traceStats.pass_rate === null ? (
                    <p className="text-2xl font-bold">—</p>
                  ) : (
                    <p className="text-2xl font-bold">{traceStats.pass_rate}%</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {traceStats ? `${traceStats.success_count}/${traceStats.total_calls} runs 成功` : 'LangSmith 实时'}
                </p>
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
        <div className="space-y-4">
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
        </div>
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
                <div key={m.id} className={`rounded-lg border border-border/60 px-4 py-3 ${isCurrent ? 'ring-1 ring-border' : ''}`}>
                  <div className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">{m.id}</Badge>
                        <span className="text-sm font-semibold">{m.name}</span>
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
                    <div className="pb-2">
                      <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950 rounded px-2 py-1">
                        ⚠️ {m.blocked_reason}
                      </p>
                    </div>
                  )}
                  </div>
                  {m.tasks && m.tasks.length > 0 && (
                    <div className="pt-0">
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
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </Section>

      {/* 当前卡点 & 下一步行动 */}
      <Section icon={AlertTriangle} title="当前卡点 & 下一步行动" subtitle="现在有什么在拖慢我们？每个卡点必须有下一步行动和 Owner">
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
      </Section>

      {/* 平台活跃度（PostHog 按 tenant_id 过滤）*/}
      <Section icon={Activity} title="看板活跃度" subtitle="PostHog 实时统计，按这个看板过滤">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '看板访问次数', icon: Activity, key: 'live_board_nav', source: 'PostHog live_board_nav' },
            { label: '看板互动次数', icon: MessageCircle, key: 'live_report_tab_switch', source: 'PostHog live_report_tab_switch' },
            { label: 'Agent 连接点击', icon: GitBranch, key: 'marketplace_agent_connect_click', source: 'PostHog marketplace_agent_connect_click' },
            { label: 'Telegram 点击', icon: MessageCircle, key: 'live_report_telegram_click', source: 'PostHog live_report_telegram_click' },
          ].map(({ label, icon: Icon, key, source }) => {
            const count = posthogActivity?.[key]
            const isLoading = posthogActivity === null
            const isUnavailable = count === -1 || count === undefined
            return (
              <Card key={label}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <div className="mt-1">
                        {isLoading ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />加载中…</div>
                        ) : isUnavailable ? (
                          <ComingSoon source="PostHog" />
                        ) : (
                          <p className="text-2xl font-bold">{count}</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/50 mt-1 truncate">{source}</p>
                    </div>
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </Section>

      {/* 更新日志 */}
      <Section icon={FileText} title="更新日志（Update Log）" subtitle="每次有进展，@Lumen 或 Agent 追加一行——只加不改">
        <div className="space-y-3">
              {meta.update_log && meta.update_log.length > 0 ? (
                meta.update_log.slice().reverse().map((log, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                    <span className="text-xs font-mono text-muted-foreground shrink-0 pt-0.5">{log.date}</span>
                    <span className="text-sm shrink-0 pt-0.5">
                      {log.type === 'milestone_done' ? '✅' : log.type === 'audit' ? '📊' : log.type === 'task_update' ? '🔧' : log.type === 'user_message' ? '💬' : '•'}
                    </span>
                    <div className="flex-1">
                      <Md>{log.note}</Md>
                      <span className="text-xs text-muted-foreground">— {log.author}</span>
                      {log.evidence && log.evidence.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {log.evidence.map((url, ei) => (
                            <a key={ei} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt={`证据截图 ${ei + 1}`} className="rounded-md border border-border/50 w-full object-cover hover:opacity-90 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-2 text-sm text-muted-foreground/40 italic">暂无更新日志</div>
          )}
        </div>
      </Section>

      {/* Agent 注册表 */}
      <Section icon={Users} title="Agent 注册表" subtitle="当前系统注册的核心 Agent，来自 agent_market 表">
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
                <TableHead className="text-xs">操作</TableHead>
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
                  {/* B7: 派遣按鈕 */}
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 gap-1"
                      disabled={!agent.enabled || !langgraphThreadId}
                      onClick={() => {
                        setDispatchTarget({ id: agent.id, name: agent.name })
                        setDispatchResult(null)
                        setDispatchTask('')
                        setDispatchSheetOpen(true)
                      }}
                    >
                      <Zap className="w-3 h-3" />派遣
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
      </Section>

      {/* B7: Agent Market 派遣 Sheet */}
      <Sheet open={dispatchSheetOpen} onOpenChange={setDispatchSheetOpen}>
        <SheetContent side="right" className="w-[420px] sm:w-[480px] flex flex-col">
          <SheetHeader className="pb-4">
            <SheetTitle>派遣 {dispatchTarget?.name ?? 'Agent'}</SheetTitle>
            <p className="text-xs text-muted-foreground">直接向该 Agent 发送任务，共用当前看板 Thread，执行过程在左侧工具面板实时可见</p>
          </SheetHeader>
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">任务描述</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={5}
                placeholder={`告诉 ${dispatchTarget?.name ?? 'Agent'} 要做什么…`}
                value={dispatchTask}
                onChange={e => setDispatchTask(e.target.value)}
                disabled={dispatching}
              />
            </div>
            <Button
              onClick={dispatchAgent}
              disabled={!dispatchTask.trim() || dispatching || !langgraphThreadId}
              className="gap-2"
            >
              {dispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {dispatching ? '派遣中…' : '立即派遣'}
            </Button>
            {!langgraphThreadId && (
              <p className="text-xs text-destructive">未绑定 LangGraph Thread，无法派遣</p>
            )}
            {dispatchResult && (
              <div className="rounded-md border border-border bg-muted/30 p-3 flex-1 overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground mb-1">Agent 回复</p>
                <p className="text-sm whitespace-pre-wrap break-words">{dispatchResult}</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Agent 运行日志 */}
      <Section icon={Terminal} title="Agent 运行日志" subtitle="LangGraph runs 实时执行轨迹，含真实工具调用次数（按 tenant_slug 过滤）">
        {lgRuns === null || lgRunsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />拉取 LangGraph Runs…</div>
        ) : lgRuns.length === 0 ? (
          <div className="text-sm text-muted-foreground/40 italic">暂无执行记录</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">时间</TableHead>
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="text-xs">耗时</TableHead>
                <TableHead className="text-xs">工具调用</TableHead>
                <TableHead className="text-xs">Thread 状态</TableHead>
                <TableHead className="text-xs">Run 状态</TableHead>
                <TableHead className="text-xs">Run ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lgRuns.map((run: { run_id: string; assistant_id: string; status: string; created_at: string; updated_at?: string; thread_id: string; thread_status: string; interrupt_reason?: string; tool_calls_count?: number; tool_name?: string; tool_args?: unknown }) => {
                const ms = run.updated_at && run.created_at
                  ? Math.round((new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()))
                  : null
                const runStatusVariant = run.status === 'success' ? 'default' : run.status === 'error' ? 'destructive' : 'secondary'
                const runStatusLabel = run.status === 'success' ? '成功' : run.status === 'error' ? '失败' : run.status === 'pending' ? '进行中' : run.status
                const threadStatusVariant = run.thread_status === 'interrupted' ? 'destructive' : run.thread_status === 'busy' ? 'secondary' : 'outline'
                const threadStatusLabel = run.thread_status === 'interrupted' ? '已中断' : run.thread_status === 'busy' ? '运行中' : run.thread_status === 'idle' ? '空闲' : run.thread_status
                return (
                  <TableRow key={run.run_id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {run.created_at ? new Date(run.created_at).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }).slice(0, 16) : '—'}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{agentName(run.assistant_id)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{ms !== null ? `${(ms / 1000).toFixed(1)}s` : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.tool_calls_count != null && run.tool_calls_count > 0 ? (
                        <span className="font-mono">{run.tool_calls_count} 次</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant={threadStatusVariant} className="text-xs cursor-default">{threadStatusLabel}</Badge>
                          </TooltipTrigger>
                          {run.interrupt_reason && (
                            <TooltipContent className="max-w-xs text-xs">
                              <p>中断原因: {run.interrupt_reason}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <Badge variant={runStatusVariant} className="text-xs">{runStatusLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {/* B4 fix: 不跳转 LangSmith，纯文本显示 */}
                      <span className="select-all" title={run.run_id}>{run.run_id.slice(0, 8)}…</span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────
export function LiveClient({ meta: initialMeta, tenantId, tenantName, tenantCreatedAt, tenantSlug, apiKeyCount, runDays, langgraphThreadId }: LiveClientProps) {
  const posthog = usePostHog()
  const [meta, setMeta] = useState<TenantMetadata>(initialMeta)
  // isWriting: Agent 刚写入 Supabase，触发 Streamdown 动画，2 秒后归 false
  const [isWriting, setIsWriting] = useState(false)

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
            // Agent 写入时触发 Streamdown 动画
            setIsWriting(true)
            setTimeout(() => setIsWriting(false), 2000)
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

  // Scrollspy：当前可见的 Section id
  const [activeSection, setActiveSection] = useState<string>('section-overview')
  // 签认状态（乐观更新）
  const [signing, setSigning] = useState<'M1' | 'M3' | null>(null)
  const handleSign = async (milestone: 'M1' | 'M3') => {
    setSigning(milestone)
    try {
      const res = await fetch('/api/tenants/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, milestone }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast(`${milestone} 签认成功`, { description: '已记录，@Lumen 将收到通知', duration: 3000 })
      posthog?.capture('live_board_sign', { milestone, tenant_id: tenantId })
    } catch (e) {
      toast('签认失败', { description: String(e), duration: 3000 })
    } finally {
      setSigning(null)
    }
  }

  // 当前里程碑（用于导航高亮）
  const currentMilestoneId = meta.current_milestone
  // 按 order 排序的里程碑列表
  const sortedMilestones = [...meta.milestones].sort((a, b) => a.order - b.order)

  // Scrollspy：IntersectionObserver 监听各 Section，滚动时自动高亮对应导航项
  useEffect(() => {
    const sectionIds = [
      'section-overview',
      'mcsp-1', 'mcsp-2', 'mcsp-3', 'mcsp-4', 'mcsp-5', 'mcsp-6', 'mcsp-7', 'mcsp-8', 'mcsp-eva',
      'section-omt',
      ...sortedMilestones.map(m => `section-${m.id}`),
    ]
    const observers: IntersectionObserver[] = []
    sectionIds.forEach(id => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id) },
        { rootMargin: '-10% 0px -60% 0px', threshold: 0 }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedMilestones.length])

  // 平滑滚动到指定 Section
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    posthog?.capture('live_board_nav', { section: id, tenant_id: tenantId })
  }

  // 里程碑状态点颜色
  const milestoneStatusDot = (status: string) => {
    if (status === 'done') return 'bg-emerald-500'
    if (status === 'running') return 'bg-blue-500 animate-pulse'
    if (status === 'blocked') return 'bg-red-500'
    if (status === 'ready') return 'bg-amber-400'
    return 'bg-muted-foreground/30'
  }

  // @Lumen 的 LangGraph assistant_id（L2-coordinator-agent）
  const lumenAssistantId = '73a8b433-7a94-4ff0-a4d2-5d71bb998fc8'

  return (
    <main className="flex-1 max-w-6xl mx-auto px-4 pt-12 pb-16 w-full">
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{meta.client.name} 共同成功计划</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {meta.client.name} × ONIT · 由 @{meta.client.lumen} 维护 · 实时同步，无需刷新
            </p>
          </div>
          {/* @Lumen 对话入口（右上角）*/}
          <Sheet>
            <SheetTrigger render={
              <Button variant="outline" size="sm" className="gap-2 shrink-0">
                <MessageSquare className="w-3.5 h-3.5" />
                问 @Lumen
              </Button>
            } />
            <SheetContent side="right" className="w-[420px] sm:w-[480px] flex flex-col">
              <SheetHeader className="pb-4">
                <SheetTitle>与 @{meta.client.lumen} 对话</SheetTitle>
                <p className="text-xs text-muted-foreground">直接告诉 @Lumen 你的问题，无需跳转 Telegram</p>
              </SheetHeader>
              <div className="flex-1 overflow-hidden">
                {/* B1 fix: 传入 langgraphThreadId，对话和看板共用同一个 Thread */}
                <AgentChat assistantId={lumenAssistantId} threadId={langgraphThreadId} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* 主体：左侧 TOC 导航（Scrollspy）+ 右侧连续长页 */}
      <div className="flex gap-8">
        {/* 左侧 TOC：固定导航，滚动时自动高亮当前 Section */}
        <aside className="hidden md:block w-52 shrink-0">
          <div className="sticky top-24 space-y-0.5 overflow-y-auto max-h-[calc(100vh-7rem)]">
            {/* 共同成功计划 MCSP：一级入口 + 二级子导航 */}
            <button
              onClick={() => scrollTo('section-overview')}
              className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                ['section-overview','mcsp-1','mcsp-2','mcsp-3','mcsp-4','mcsp-5','mcsp-6','mcsp-7','mcsp-8','mcsp-eva','section-omt'].includes(activeSection)
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Target className="w-3.5 h-3.5 shrink-0" />
              <span>共同成功计划 MCSP</span>
            </button>

            {/* MCSP 二级子导航 */}
            {([
              { id: 'mcsp-1', label: '1. 目标与背景' },
              { id: 'mcsp-2', label: '2. 现状 → 理想' },
              { id: 'mcsp-3', label: '3. 成功标准' },
              { id: 'mcsp-4', label: '4. RACI' },
              { id: 'mcsp-5', label: '5. 里程碑' },
              { id: 'mcsp-6', label: '6. 风险' },
              { id: 'mcsp-7', label: '7. 节奏' },
              { id: 'mcsp-8', label: '8. 凭证' },
              { id: 'mcsp-eva', label: '@Eva 审计' },
              { id: 'section-omt', label: '实施进度表 OMT' },
            ] as const).map(item => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`flex items-center gap-2 w-full text-left pl-7 pr-3 py-1 rounded-md text-xs transition-colors ${
                  activeSection === item.id
                    ? 'text-foreground font-medium bg-muted'
                    : 'text-muted-foreground/70 hover:text-foreground'
                }`}
              >
                <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}

            <div className="pt-3 pb-1 px-3">
              <span className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">Milestones</span>
            </div>

            {/* 里程碑 TOC */}
            {sortedMilestones.map((m, idx) => {
              const sectionId = `section-${m.id}`
              const isActive = activeSection === sectionId
              const isCurrent = m.id === currentMilestoneId
              return (
                <div key={m.id} className="relative">
                  {/* 连接线 */}
                  {idx < sortedMilestones.length - 1 && (
                    <div className="absolute left-[22px] top-[32px] w-px h-[calc(100%+2px)] bg-border/50" />
                  )}
                  <button
                    onClick={() => scrollTo(sectionId)}
                    className={`relative flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'text-foreground font-medium bg-muted'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${milestoneStatusDot(m.status)}`} />
                    <span className="flex-1 truncate text-xs">
                      <span className="font-mono mr-1">{m.id}</span>
                      {m.name}
                    </span>
                    {isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </button>
                </div>
              )
            })}


          </div>
        </aside>

        {/* 右侧连续长页：所有 Section 全部连续渲染 */}
        <div className="flex-1 min-w-0 space-y-16">

          {/* Section 1：项目概览 */}
          <section id="section-overview" className="scroll-mt-24">
            <McspTab meta={meta} runDays={runDays} isWriting={isWriting} />
            <div className="mt-8">
              <OmtTab meta={meta} runDays={runDays} tenantSlug={tenantSlug} tenantId={tenantId} isWriting={isWriting} langgraphThreadId={langgraphThreadId} />
            </div>
            <div className="mt-8">
              <TraceTab tenantSlug={tenantSlug} meta={meta} isWriting={isWriting} langgraphThreadId={langgraphThreadId} />
            </div>
          </section>

          {/* Section 2+：里程碑（每个里程碑是一个独立 Section）*/}
          {sortedMilestones.map(m => (
            <section key={m.id} id={`section-${m.id}`} className="scroll-mt-24 space-y-6">
              {/* 里程碑头部 */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{m.id}</Badge>
                      <Badge
                        variant={m.status === 'done' ? 'default' : m.status === 'running' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {milestoneStatusLabel(m.status)}
                      </Badge>
                      {m.id === currentMilestoneId && (
                        <Badge variant="secondary" className="text-xs">当前阶段</Badge>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">{m.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {m.assignee && (
                        <span>执行 Agent：<span className="font-mono">{m.assignee}</span></span>
                      )}
                      {m.target_date && <span>目标日期：{m.target_date}</span>}
                      {m.completed_at && <span>完成于：{m.completed_at.slice(0, 10)}</span>}
                      {(m.failure_count ?? 0) > 0 && (
                        <Badge variant="destructive" className="text-xs">失败 {m.failure_count} 次</Badge>
                      )}
                    </div>
                  </div>
                  {/* 签认按鈕（M1/M3）*/}
                  {(m.id === 'M1' || m.id === 'M3') && (
                    <div className="shrink-0">
                      {(m.id === 'M1' ? meta.mcsp.signed_m1 : meta.mcsp.signed_m3) ? (
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--onit-green)' }}>
                          <CheckCircle2 className="w-4 h-4" />已签认
                        </div>
                      ) : (
                        <Button
                          size="sm" variant="outline"
                          disabled={signing === m.id || m.status !== 'done'}
                          onClick={() => handleSign(m.id as 'M1' | 'M3')}
                          className="gap-1.5"
                        >
                          {signing === m.id
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />签认中…</>
                            : <><CheckCircle2 className="w-3.5 h-3.5" />签认 {m.id}</>
                          }
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* 进度条 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>任务进度</span>
                    <span>{m.tasks_done}/{m.tasks_total}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((m.tasks_done / Math.max(m.tasks_total, 1)) * 100)}%`,
                        backgroundColor: m.status === 'done' ? 'var(--onit-green)' : 'var(--foreground)',
                      }}
                    />
                  </div>
                </div>

                {/* blocked Alert */}
                {m.status === 'blocked' && m.blocked_reason && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">阶段阻塞</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{m.blocked_reason}</p>
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">@{meta.client.lumen} 已收到通知，正在处理中</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* 任务清单 */}
              {m.tasks && m.tasks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">任务清单</h3>
                  <div className="space-y-1.5">
                    {m.tasks.map((task, i) => {
                      const isDone = task.status === 'done' || task.done === true
                      const isRunning = task.status === 'in_progress' || task.status === 'running'
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
                </div>
              )}

              {/* 执行轨迹（该里程碑的佐证）*/}
              {m.run_id && (
                <MilestoneRunStats runId={m.run_id} dispatchedAt={m.dispatched_at} milestoneName={m.name} />
              )}

              {/* @Lumen 对话区（里程碑上下文）*/}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  问 @{meta.client.lumen} 关于 {m.id}
                </h3>
                <AgentChat
                  assistantId={lumenAssistantId}
                  placeholder={`关于 ${m.name}，有什么问题或想法？`}
                />
              </div>
            </section>
          ))}

        </div>
      </div>

      {/* 验收状态 + SKILL.md 下载 */}
      <div className="mt-12 rounded-lg border border-border/50 p-4 flex items-center justify-between gap-4">
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
        <button
          disabled
          title="验收完成后可下载 SKILL.md"
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border text-muted-foreground opacity-50 cursor-not-allowed shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          SKILL.md
        </button>
      </div>

      <div className="text-center text-xs text-muted-foreground mt-6 pb-4">
        由 ONIT 提供 · 此页面实时同步，无需刷新
      </div>
    </main>
  )
}
