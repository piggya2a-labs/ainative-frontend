'use client'
import { Streamdown } from 'streamdown'
import 'streamdown/styles.css'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/sonner'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import {
  Target, Users, CheckCircle2, AlertTriangle, GitBranch,
  Calendar, Clock, ArrowRight, Flag, Layers, FileText, Info,
  Lock, Zap, Activity, MessageCircle, Key, Download, Loader2,
  Terminal, Image, RefreshCw, ChevronRight, ChevronDown, StopCircle, History
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

// ─── Agent UUID → 名字映射（单一来源，来自 agent_market 表）──────────────────────
const AGENT_NAMES: Record<string, string> = {
  '73a8b433-7a94-4ff0-a4d2-5d71bb998fc8': '@Lumen',
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
function Md({ children, className }: { children?: string | null; className?: string }) {
  if (!children) return null
  return (
    <div className={`text-sm [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mt-0.5 [&_img]:rounded-md [&_img]:max-w-full [&_img]:mt-2 [&_a]:text-onit-blue [&_a]:underline [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground ${className ?? ''}`}>
      <Streamdown>{children}</Streamdown>
    </div>
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

// ─── KR3: useThreadStream — SSE 实时订阅 Thread，替代 fetchTrace 轮询 ───────────────────────
// 订阅 /api/langgraph-stream?thread_id=xxx，Agent 每跑一步看板自动更新
interface InterruptItem {
  value: unknown
  resumable: boolean
  ns?: string[]
  when?: string
}
function useThreadStream(threadId: string | undefined, streamKey?: number) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [interrupts, setInterrupts] = useState<InterruptItem[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  // Thread 级别状态：idle / busy / interrupted / error（LangGraph 原生）
  const [threadStatus, setThreadStatus] = useState<'idle' | 'busy' | 'interrupted' | 'error' | null>(null)

  useEffect(() => {
    if (!threadId) return
    setIsStreaming(true)
    setStreamError(null)

    const es = new EventSource(`/api/langgraph-stream?thread_id=${encodeURIComponent(threadId)}`)

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data)
        // snapshot 事件：初始加载或无 running run 时
        if (payload.type === 'snapshot') {
          if (Array.isArray(payload.messages)) {
            const msgs = payload.messages
              .filter((m: Record<string, unknown>) => m.type !== 'system')
              .map((m: Record<string, unknown>) => ({
                id: String(m.id ?? Math.random()),
                type: m.type as ThreadMessage['type'],
                content: Array.isArray(m.content)
                  ? (m.content as Array<{ type?: string; text?: string }>)
                      .filter(c => c.type === 'text').map(c => c.text ?? '').join('')
                  : String(m.content ?? ''),
                tool_calls: (m.tool_calls as ThreadMessage['tool_calls']) ?? undefined,
                tool_call_id: m.tool_call_id ? String(m.tool_call_id) : undefined,
                name: m.name ? String(m.name) : undefined,
              }))
            setMessages(msgs)
          }
          if (payload.has_interrupt && Array.isArray(payload.interrupts)) {
            setInterrupts(payload.interrupts as InterruptItem[])
          } else {
            setInterrupts([])
          }
          // 从 run_status 推断 thread 状态
          const rs = payload.run_status as string | undefined
          if (rs === 'pending' || rs === 'running') setThreadStatus('busy')
          else if (rs === 'error') setThreadStatus('error')
          else if (payload.has_interrupt) setThreadStatus('interrupted')
          else setThreadStatus('idle')
          setIsStreaming(false)
          es.close()
          return
        }
        // LangGraph SSE 流事件：values / messages / metadata / interrupts
        if (payload.type === 'values' && payload.values?.messages) {
          const rawMsgs: Array<Record<string, unknown>> = payload.values.messages
          const msgs = rawMsgs
            .filter((m) => m.type !== 'system')
            .map((m) => ({
              id: String(m.id ?? Math.random()),
              type: m.type as ThreadMessage['type'],
              content: Array.isArray(m.content)
                ? (m.content as Array<{ type?: string; text?: string }>)
                    .filter(c => c.type === 'text').map(c => c.text ?? '').join('')
                : String(m.content ?? ''),
              tool_calls: (m.tool_calls as ThreadMessage['tool_calls']) ?? undefined,
              tool_call_id: m.tool_call_id ? String(m.tool_call_id) : undefined,
              name: m.name ? String(m.name) : undefined,
            }))
          setMessages(msgs)
        }
        // interrupt 事件：Agent 暂停等待人类确认
        if (payload.type === 'interrupt' || payload.type === 'interrupts') {
          const items = Array.isArray(payload.interrupts) ? payload.interrupts : [payload]
          setInterrupts(items as InterruptItem[])
        }
        // end 事件：run 完成
        if (payload.type === 'end') {
          setIsStreaming(false)
          setInterrupts([])
          setThreadStatus('idle')
          es.close()
        }
        // metadata 事件：run 开始，thread 变为 busy
        if (payload.type === 'metadata') {
          setThreadStatus('busy')
        }
      } catch (_) { /* ignore parse errors */ }
    }

    es.onerror = () => {
      setStreamError('实时订阅断开，请刷新页面')
      setIsStreaming(false)
      es.close()
    }

    return () => { es.close() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, streamKey])

  return { messages, interrupts, isStreaming, streamError, threadStatus }
}

// ─── KR4: HumanGate — 看板内的 interrupt 确认 UI ───────────────────────────────────
function HumanGate({ threadId, interrupts, onResume }: {
  threadId: string
  interrupts: InterruptItem[]
  onResume: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [resumeText, setResumeText] = useState('')

  const handleResume = async (value: unknown) => {
    setSubmitting(true)
    try {
      await fetch('/api/langgraph-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: threadId, resume_value: value }),
      })
      onResume()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border-2 border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">等待人类确认</span>
        <Badge variant="outline" className="text-xs border-amber-400/60 text-amber-600">Human Gate</Badge>
      </div>
      {interrupts.map((item, i) => (
        <div key={i} className="space-y-3">
          {item.value != null && (
            <div className="rounded-md bg-background/80 border border-border/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">需要确认的内容：</p>
              <p className="text-sm leading-relaxed">
                {typeof item.value === 'string' ? item.value : JSON.stringify(item.value, null, 2)}
              </p>
            </div>
          )}
          {item.resumable && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="回复内容（可留空直接确认）"
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
                className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-1 focus:ring-amber-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleResume(resumeText || true)}
                  disabled={submitting}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  确认，Agent 继续跑
                </button>
                <button
                  onClick={() => handleResume(false)}
                  disabled={submitting}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                >
                  拒绝
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Trace Tab ───────────────────────────────────────────────────────────────
function TraceTab({ tenantSlug, meta }: { tenantSlug: string; meta: TenantMetadata }) {
  const [data, setData] = useState<TraceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // KR3: 实时 thread_id（从初始 snapshot 拉取）
  const [liveThreadId, setLiveThreadId] = useState<string | undefined>(undefined)
  // KR4: interrupt 后重新订阅（必须在 useThreadStream 之前声明）
  const [streamKey, setStreamKey] = useState(0)
  // fetchKey 独立控制 fetchTrace 重运行（与 streamKey 解耦）
  const [fetchKey, setFetchKey] = useState(0)
  // KR3: SSE 实时订阅
  const { messages: liveMessages, interrupts, isStreaming, streamError, threadStatus } = useThreadStream(liveThreadId, streamKey)
  // Checkpoint 历史
  const [checkpoints, setCheckpoints] = useState<Array<{ checkpoint_id: string; created_at: string; metadata?: { step?: number; source?: string; writes?: Record<string, unknown> } }>>([])
  const [checkpointsOpen, setCheckpointsOpen] = useState(false)
  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null)

  // 取消正在跑的 run
  const cancelRun = async (runId: string) => {
    if (!liveThreadId) return
    setCancellingRunId(runId)
    try {
      await fetch('/api/langgraph-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/threads/${liveThreadId}/runs/${runId}/cancel` }),
      })
      toast('Run 已取消', { description: `run_id: ${runId.slice(0, 8)}…`, duration: 3000 })
      setStreamKey(k => k + 1)
    } catch {
      toast('取消失败', { description: '请稍后重试', duration: 3000 })
    } finally {
      setCancellingRunId(null)
    }
  }

  // 拉取 checkpoint 历史
  const fetchCheckpoints = async () => {
    if (!liveThreadId) return
    try {
      const res = await fetch('/api/langgraph-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `/threads/${liveThreadId}/history?limit=50` }),
      })
      const data = await res.json()
      // LangGraph history API 返回的格式：checkpoint_id 在 config.configurable.checkpoint_id 里
      // 需要映射到顶层字段以匹配渲染逻辑
      if (Array.isArray(data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalized = data.map((cp: any) => ({
          checkpoint_id: cp.config?.configurable?.checkpoint_id ?? cp.checkpoint_id ?? '',
          created_at: cp.created_at ?? '',
          metadata: cp.metadata,
          next: cp.next ?? [],
        }))
        // 只保留 source=loop 且 next 不为空的 checkpoint（可以真正恢复的中间状态）
        const restorable = normalized.filter((cp) =>
          cp.metadata?.source === 'loop' && cp.next.length > 0
        )
        setCheckpoints(restorable.length > 0 ? restorable : normalized.slice(0, 5))
      }
    } catch { /* ignore */ }
  }

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
            assistant_id: 'meta_manage_agent',
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
        // KR3: 设置 liveThreadId 启动 SSE 订阅
        const latestThread = threads[0]
        const threadId = latestThread?.thread_id ?? ''
        setLiveThreadId(threadId)
        // 每次 fetchTrace 完成后强制 SSE 重新订阅（即使 threadId 没变）
        setStreamKey(k => k + 1)

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
  useEffect(() => { fetchTrace() }, [tenantSlug, fetchKey])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">Trace</Badge>
            {isStreaming ? (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                实时订阅中
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">LangSmith</Badge>
            )}
            {data && <Badge variant="outline" className="text-xs">{data.total_calls} 次 Run</Badge>}
            {interrupts.length > 0 && (
              <Badge variant="outline" className="text-xs border-amber-400/60 text-amber-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                等待确认
              </Badge>
            )}
            {/* Thread 状态指示器（LangGraph 原生 idle/busy/interrupted/error） */}
            {threadStatus === 'busy' && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1 text-onit-amber">
                <Loader2 className="w-3 h-3 animate-spin" />
                Thread 运行中
              </Badge>
            )}
            {threadStatus === 'interrupted' && (
              <Badge variant="outline" className="text-xs border-amber-400/60 text-amber-600">
                Thread 已暂停
              </Badge>
            )}
            {threadStatus === 'error' && (
              <Badge variant="destructive" className="text-xs">
                Thread 错误
              </Badge>
            )}
            {threadStatus === 'idle' && (
              <Badge variant="outline" className="text-xs text-onit-green border-onit-green/40">
                Thread 空闲
              </Badge>
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
                              <TooltipTrigger>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                                  onClick={() => cancelRun(item.id)}
                                  disabled={cancellingRunId === item.id}
                                >
                                  {cancellingRunId === item.id
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <StopCircle className="w-3 h-3" />}
                                </Button>
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
              <Collapsible open={checkpointsOpen} onOpenChange={(open) => {
                setCheckpointsOpen(open)
                if (open && checkpoints.length === 0) fetchCheckpoints()
              }}>
                <Card>
                  <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors">
                    <span className="text-xs text-muted-foreground">
                      {checkpoints.length > 0 ? `${checkpoints.length} 个 checkpoint` : '点击加载 checkpoint 历史'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${checkpointsOpen ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border">
                      {checkpoints.length === 0 ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground/50">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          正在加载…
                        </div>
                      ) : (
                        <div className="divide-y divide-border/30">
                          {checkpoints.map((cp, i) => (
                            <div key={cp.checkpoint_id} className="flex items-start gap-3 px-4 py-2.5">
                              <span className="text-xs font-mono text-muted-foreground/40 shrink-0 pt-0.5 w-5 text-right">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                    {cp.checkpoint_id.slice(0, 8)}…
                                  </code>
                                  {cp.metadata?.step != null && (
                                    <Badge variant="outline" className="text-xs">step {cp.metadata.step}</Badge>
                                  )}
                                  {cp.metadata?.source && (
                                    <Badge variant="secondary" className="text-xs font-mono">{cp.metadata.source}</Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground/50 font-mono mt-0.5 block">
                                  {new Date(cp.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                                {cp.metadata?.writes && Object.keys(cp.metadata.writes).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {Object.keys(cp.metadata.writes).map(k => (
                                      <Badge key={k} variant="outline" className="text-xs font-mono text-muted-foreground">{k}</Badge>
                                    ))}
                                  </div>
                                )}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mt-1.5 h-6 text-xs text-muted-foreground hover:text-foreground px-2"
                                        disabled={restoringCheckpointId === cp.checkpoint_id}
                                        onClick={() => restoreCheckpoint(cp.checkpoint_id)}
                                      >
                                        {restoringCheckpointId === cp.checkpoint_id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <History className="w-3 h-3 mr-1" />}
                                        从此恢复
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>时间旅行：将 Thread 状态回滚到此 checkpoint，然后重新订阅 SSE</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </Section>
          )}

          {/* KR4: Human Gate — interrupt 确认 UI */}
          {interrupts.length > 0 && liveThreadId && (
            <HumanGate
              threadId={liveThreadId}
              interrupts={interrupts}
              onResume={() => setStreamKey(k => k + 1)}
            />
          )}

          {/* KR3: 实时对话流（SSE 订阅，替代静态 data.messages） */}
          {(liveMessages.length > 0 || (data.messages && data.messages.length > 0)) && (
            <Section icon={MessageCircle} title="对话流" subtitle={`Thread ${liveThreadId ? liveThreadId.slice(0, 8) + '…' : (data.thread_id ? data.thread_id.slice(0, 8) + '…' : '')} · ${(liveMessages.length || data.messages?.length || 0)} 条消息${isStreaming ? ' · 实时订阅中…' : ''}`}>
              {streamError && (
                <div className="rounded-md border border-amber-400/30 bg-amber-50/20 px-3 py-2 text-xs text-amber-600 mb-2">
                  {streamError}
                </div>
              )}
              <div className="space-y-2">
                {(liveMessages.length > 0 ? liveMessages : (data.messages ?? [])).map((msg) => {
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
                    const isSubAgent = msg.tool_calls?.some(tc => tc.name === 'task')
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
                              {msg.tool_calls!.map(tc => (
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
                                  <TooltipTrigger>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                      disabled={deletingCronId === cron.cron_id}
                                      onClick={() => deleteCron(cron.cron_id)}
                                    >
                                      {deletingCronId === cron.cron_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <StopCircle className="w-3 h-3" />}
                                    </Button>
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
                    <TooltipTrigger>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={forking}
                        onClick={forkThread}
                        className="flex items-center gap-2"
                      >
                        {forking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
                        Fork Thread
                      </Button>
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
                <Md>{mcsp.context}</Md>
              </div>
            )}
            <div className="grid grid-cols-[160px_1fr] gap-3 items-start py-2">
              <span className="text-xs text-muted-foreground pt-0.5 font-medium">合作目标</span>
              {mcsp.goal ? <Md>{mcsp.goal}</Md> : <Pending />}
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
              {mcsp.as_is
                ? <Md>{typeof mcsp.as_is === 'string' ? mcsp.as_is : mcsp.as_is.join('\n')}</Md>
                : <Pending />}
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">理想状态（To-Be）</CardTitle>
              <CardDescription className="text-xs">3 个月后我们希望庆祝什么</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {mcsp.to_be
                ? <Md>{typeof mcsp.to_be === 'string' ? mcsp.to_be : mcsp.to_be.join('\n')}</Md>
                : <Pending />}
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
function OmtTab({ meta, runDays, tenantSlug, tenantId }: {
  meta: TenantMetadata
  runDays: number
  tenantSlug: string
  tenantId: string
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

  // PostHog 客户活跃度
  const [posthogActivity, setPosthogActivity] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    fetch(`/api/posthog-activity?tenant_id=${tenantId}&tenant_slug=${tenantSlug}`)
      .then(r => r.json())
      .then(d => setPosthogActivity(d.events ?? null))
      .catch(() => setPosthogActivity(null))
  }, [tenantId, tenantSlug])

  // 拉取 LangGraph trace 数据，用于填充总览数字
  const [traceStats, setTraceStats] = useState<{ total_calls: number; agents: string[]; success_count: number; pass_rate: number | null } | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const lg = (path: string, body?: unknown) => fetch('/api/langgraph-trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, body })
    }).then(r => r.json())
    // agentName() 来自顶层 AGENT_NAMES 常量
    lg('/threads/search', { metadata: { tenant_slug: tenantSlug }, limit: 20 })
      .then(async (threads: Array<{ thread_id: string }>) => {
        if (!Array.isArray(threads) || !threads.length) { setTraceStats({ total_calls: 0, agents: [], success_count: 0, pass_rate: null }); return }
        const allRuns: Array<{ assistant_id: string; status: string }> = []
        await Promise.all(threads.slice(0, 5).map(async t => {
          const runs = await lg(`/threads/${t.thread_id}/runs`) as Array<{ assistant_id: string; status: string }>
          if (Array.isArray(runs)) allRuns.push(...runs)
        }))
        const successCount = allRuns.filter(r => r.status === 'success').length
        const passRate = allRuns.length > 0 ? Math.round((successCount / allRuns.length) * 100) : null
        setTraceStats({
          total_calls: allRuns.length,
          agents: [...new Set(allRuns.map(r => agentName(r.assistant_id)))],
          success_count: successCount,
          pass_rate: passRate,
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
            { label: '看板互动次数', icon: Activity, key: 'live_report_tab_switch', source: 'PostHog live_report_tab_switch' },
            { label: '连接 Agent 次数', icon: GitBranch, key: 'marketplace_agent_connect_success', source: 'PostHog marketplace_agent_connect_click' },
            { label: '点击 Telegram 次数', icon: MessageCircle, key: 'dashboard_telegram_cta_click', source: 'PostHog dashboard_telegram_cta_click' },
            { label: '创建 API Key 次数', icon: Lock, key: 'api_key_create', source: 'PostHog api_key_create' },
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
          </CardContent>
        </Card>
      </Section>

      {/* Agent 注册表 */}
      <Section icon={Users} title="Agent 注册表" subtitle="当前系统注册的核心 Agent，来自 agent_market 表">
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

      {/* Agent 运行日志 */}
      <Section icon={Terminal} title="Agent 运行日志" subtitle="Dispatcher 历史记录（已归档，新架构由 Thread 直接派遣）">
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
          <OmtTab meta={meta} runDays={runDays} tenantSlug={tenantSlug} tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="trace">
          <TraceTab tenantSlug={tenantSlug} meta={meta} />
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
          <p className="text-xs text-muted-foreground mt-0.5">切换到「执行轨迹」 Tab，如有 interrupt 可在看板里直接确认，无需跳转 Telegram</p>
        </div>
        <a
          href="https://t.me/lumen_onit"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => posthog?.capture('live_report_telegram_click', { tenant_id: tenantId })}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          备用：Telegram @Lumen →
        </a>
      </div>

      <div className="text-center text-xs text-muted-foreground mt-6 pb-4">
        由 ONIT 提供 · 此页面实时同步，无需刷新
      </div>
    </main>
  )
}
