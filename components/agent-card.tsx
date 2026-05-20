'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { AgentIcon } from '@/components/agent-icon'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Textarea } from '@/components/ui/textarea'
import {
  Zap,
  BookOpen,
  ExternalLink,
  Plug,
  Unplug,
  Loader2,
  Radio,
  ChevronRight,
  Cpu,
  Globe,
  Tag,
  Clock,
  Flame,
  PenLine,
  Send,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentSkill {
  id: string
  name?: string
  description?: string
  tags?: string[]
  examples?: string[]
  inputSchema?: Record<string, unknown>
}

export interface SupportedInterface {
  url: string
  protocol: 'A2A' | 'MCP' | 'HTTP' | string
  transport?: string
}

export interface AgentCapabilities {
  streaming?: boolean
  pushNotifications?: boolean
  stateTransitionHistory?: boolean
  tools?: string[]
  role_models?: Array<{
    name: string
    principle?: string
    principles?: string
    affiliation?: string
  }>
}

export interface AgentRecord {
  id: string
  name: string
  type: 'agent' | 'external' | 'capability' | string
  description?: string | null
  version?: string | null
  tags?: string[] | null
  skills?: AgentSkill[] | null
  url?: string | null
  mcp_url?: string | null
  documentation_url?: string | null
  icon_url?: string | null
  provider?: string | null
  connector_type?: string | null
  supported_interfaces?: SupportedInterface[] | null
  capabilities?: AgentCapabilities | null
  default_input_modes?: string[] | null
  default_output_modes?: string[] | null
  langsmith_handle?: string | null
  enabled?: boolean
  created_at?: string | null
  updated_at?: string | null
  // runtime state (injected by parent)
  isConnected?: boolean
  isOnline?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
}

/** 协议 → badge className */
function protocolCls(protocol: string) {
  switch (protocol.toUpperCase()) {
    case 'A2A':
      return 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400'
    case 'MCP':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400'
    case 'HTTP':
    case 'JSONRPC':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400'
    default:
      return ''
  }
}

/** connector_type / type → 中文标签 */
function getTypeLabel(agent: AgentRecord): string {
  const ct = agent.connector_type ?? agent.type
  switch (ct) {
    case 'preset':   return '核心'
    case 'openapi':  return 'OpenAPI'
    case 'custom':   return 'MCP'
    case 'external': return '外部'
    case 'agent':    return 'Agent'
    case 'capability': return '能力'
    default: return ct ?? '外部'
  }
}

/** 是否「活跃」（在线 / 已连接） */
function isActive(agent: AgentRecord) {
  return agent.type === 'agent' ? !!agent.isOnline : !!agent.isConnected
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ agent }: { agent: AgentRecord }) {
  const active = isActive(agent)
  const label = agent.type === 'agent'
    ? (active ? '在线' : '待机')
    : (active ? '已连接' : '未连接')
  return (
    <Badge
      variant="outline"
      className={active
        ? 'bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.55_0.15_145)] border-[oklch(0.65_0.15_145)]/20'
        : ''}
    >
      {label}
    </Badge>
  )
}

// ─── AgentCard (compact grid card) ───────────────────────────────────────────

interface AgentCardProps {
  agent: AgentRecord
  onConnect?: (agent: AgentRecord) => Promise<void>
  onDisconnect?: (agent: AgentRecord) => Promise<void>
  connecting?: boolean
  disconnecting?: boolean
}

export function AgentCard({
  agent,
  onConnect,
  onDisconnect,
  connecting,
  disconnecting,
}: AgentCardProps) {
  const [open, setOpen] = useState(false)
  const skills = Array.isArray(agent.skills) ? agent.skills : []
  const interfaces = Array.isArray(agent.supported_interfaces) ? agent.supported_interfaces : []
  const typeLabel = getTypeLabel(agent)
  const timestamp = agent.updated_at ?? agent.created_at

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Card className="hover:ring-foreground/20 transition-all cursor-default h-full">
        <CardHeader>
          {/* Title + status */}
          <div className="flex items-start gap-2">
            <AgentIcon
              name={agent.name}
              iconUrl={agent.icon_url}
              mcpUrl={agent.mcp_url}
              url={agent.url}
              size={20}
              className="mt-0.5 shrink-0"
            />
            <DialogTrigger
              render={<button className="font-heading text-base leading-snug font-medium cursor-pointer hover:underline underline-offset-2 text-left" />}
            >
              {agent.name}
            </DialogTrigger>
            <CardAction>
              <StatusBadge agent={agent} />
            </CardAction>
          </div>
          <CardDescription className="line-clamp-2 text-xs leading-relaxed">
            {agent.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-2">
          {/* Protocol badges */}
          {interfaces.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {interfaces.slice(0, 2).map((iface, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={`text-[10px] font-mono ${protocolCls(iface.protocol)}`}
                >
                  {iface.protocol}
                </Badge>
              ))}
            </div>
          )}

          {/* Skill pills */}
          {skills.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {skills.slice(0, 3).map((s) => (
                <Badge key={s.id} variant="outline" className="text-[10px] font-mono">
                  {s.name ?? s.id}
                </Badge>
              ))}
              {skills.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{skills.length - 3}</span>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{typeLabel}</Badge>
          {timestamp && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={<span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground font-mono cursor-default" />}
                >
                  <Clock className="w-2.5 h-2.5" />
                  {relativeTime(timestamp)}
                </TooltipTrigger>
                <TooltipContent>{formatDate(timestamp)}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardFooter>
      </Card>

      {/* Full Agent Card Dialog */}
      <AgentCardDialog
        agent={agent}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        connecting={connecting}
        disconnecting={disconnecting}
      />
    </Dialog>
  )
}

// ─── AgentCard Dialog (full A2A Agent Card) ───────────────────────────────────

function AgentCardDialog({
  agent,
  onConnect,
  onDisconnect,
  connecting,
  disconnecting,
}: AgentCardProps) {
  const skills = Array.isArray(agent.skills) ? agent.skills : []
  const interfaces = Array.isArray(agent.supported_interfaces) ? agent.supported_interfaces : []
  const caps = agent.capabilities ?? {}
  const roleModels = Array.isArray(caps.role_models) ? caps.role_models : []
  const typeLabel = getTypeLabel(agent)
  const active = isActive(agent)
  const timestamp = agent.updated_at ?? agent.created_at

    // ── Experience notes state ──
  const [notes, setNotes] = useState<Array<{ id: string; content: string; created_at: string; author?: string }>>([])
  const [noteInput, setNoteInput] = useState('')
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string } | null } }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  const fetchNotes = useCallback(async () => {
    setNotesLoading(true)
    try {
      const res = await fetch(`/api/agent-notes?agent_id=${encodeURIComponent(agent.id)}`)
      if (res.ok) {
        const data = await res.json()
        setNotes(data.notes ?? [])
      }
    } finally {
      setNotesLoading(false)
    }
  }, [agent.name, agent.id])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const handleSaveNote = async () => {
    if (!noteInput.trim()) return
    setNoteSaving(true)
    try {
      const res = await fetch('/api/agent-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agent.id, content: noteInput.trim(), author: userEmail ?? 'anonymous' }),
      })
      if (res.ok) {
        setNoteInput('')
        await fetchNotes()
      }
    } finally {
      setNoteSaving(false)
    }
  }

  const hasTabs = true // always show tabs (experience tab is always present)

  return (
    <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
      {/* ── Header ── */}
      <DialogHeader className="px-5 pt-5 pb-4">
        {/* Name row */}
        <div className="flex items-start gap-2 flex-wrap pr-6">
          <DialogTitle className="text-base font-semibold leading-snug">
            {agent.name}
          </DialogTitle>
          <StatusBadge agent={agent} />
          <Badge variant="secondary" className="text-[10px]">{typeLabel}</Badge>
          {agent.version && (
            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
              v{agent.version}
            </Badge>
          )}
        </div>

        {/* Description */}
        {agent.description && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">
            {agent.description}
          </p>
        )}

        {/* Protocol / interface row */}
        {interfaces.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Radio className="w-3 h-3 text-muted-foreground shrink-0" />
            {interfaces.map((iface, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono ${protocolCls(iface.protocol)}`}
                >
                  {iface.protocol}
                </Badge>
                {iface.transport && (
                  <span className="text-[10px] text-muted-foreground font-mono">{iface.transport}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Endpoint URL */}
        {(agent.mcp_url || agent.url) && (
          <code className="mt-2 block text-[10px] font-mono bg-muted px-2.5 py-1.5 rounded-lg break-all text-muted-foreground">
            {agent.mcp_url ?? agent.url}
          </code>
        )}
      </DialogHeader>

      <Separator />

      {/* ── Body ── */}
      {hasTabs && (
        <Tabs defaultValue={skills.length > 0 ? 'tools' : roleModels.length > 0 ? 'models' : 'experience'} className="flex flex-col">
          <TabsList variant="line" className="px-5 rounded-none border-b border-border h-9 w-full justify-start gap-0">
            {skills.length > 0 && (
              <TabsTrigger value="tools" className="text-xs gap-1.5">
                <Zap className="w-3 h-3" />
                工具
                <Badge variant="secondary" className="text-[10px] ml-0.5">{skills.length}</Badge>
              </TabsTrigger>
            )}
            {(caps.streaming !== undefined || (agent.default_input_modes?.length ?? 0) > 0) && (
              <TabsTrigger value="protocol" className="text-xs gap-1.5">
                <Cpu className="w-3 h-3" />
                协议
              </TabsTrigger>
            )}
            {roleModels.length > 0 && (
              <TabsTrigger value="models" className="text-xs gap-1.5">
                <Flame className="w-3 h-3" />
                SOUL
              </TabsTrigger>
            )}
            <TabsTrigger value="experience" className="text-xs gap-1.5">
              <PenLine className="w-3 h-3" />
              经验
              {notes.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-0.5">{notes.length}</Badge>
              )}
            </TabsTrigger>
            {(agent.tags?.length ?? 0) > 0 && (
              <TabsTrigger value="meta" className="text-xs gap-1.5">
                <Tag className="w-3 h-3" />
                元数据
              </TabsTrigger>
            )}
          </TabsList>

          {/* Tools tab */}
          {skills.length > 0 && (
            <TabsContent value="tools" className="mt-0">
              <ScrollArea className="h-64">
                <div className="px-5 py-3 space-y-1">
                  {skills.map((skill) => (
                    <div key={skill.id} className="flex items-start gap-2 py-1.5 group">
                      <ChevronRight className="w-3 h-3 text-muted-foreground/40 mt-0.5 shrink-0 group-hover:text-muted-foreground transition-colors" />
                      <span className="text-xs font-mono font-medium text-foreground shrink-0 min-w-[110px]">
                        {skill.name ?? skill.id}
                      </span>
                      {skill.description && (
                        <span className="text-xs text-muted-foreground leading-relaxed">
                          {skill.description}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {/* Protocol tab */}
          {(caps.streaming !== undefined || (agent.default_input_modes?.length ?? 0) > 0) && (
            <TabsContent value="protocol" className="mt-0">
              <div className="px-5 py-4 space-y-4">
                {/* Capabilities */}
                {caps.streaming !== undefined && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">能力标志</p>
                    <div className="flex flex-wrap gap-2">
                      <CapBadge active={!!caps.streaming} label="Streaming" />
                      <CapBadge active={!!caps.pushNotifications} label="Push" />
                      <CapBadge active={!!caps.stateTransitionHistory} label="History" />
                    </div>
                  </div>
                )}
                {/* I/O modes */}
                {((agent.default_input_modes?.length ?? 0) > 0 || (agent.default_output_modes?.length ?? 0) > 0) && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> 输入 / 输出模态
                    </p>
                    <div className="flex gap-6">
                      {(agent.default_input_modes?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">INPUT</p>
                          <div className="flex gap-1 flex-wrap">
                            {agent.default_input_modes!.map((m) => (
                              <Badge key={m} variant="outline" className="text-[10px] font-mono">{m}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {(agent.default_output_modes?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">OUTPUT</p>
                          <div className="flex gap-1 flex-wrap">
                            {agent.default_output_modes!.map((m) => (
                              <Badge key={m} variant="outline" className="text-[10px] font-mono">{m}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {/* Role models tab */}
          {roleModels.length > 0 && (
            <TabsContent value="models" className="mt-0">
              <ScrollArea className="h-64">
                <div className="px-5 py-3 space-y-4">
                  {roleModels.map((rm, i) => (
                    <div key={i} className="border-l-2 border-border pl-3">
                      <p className="text-xs font-semibold">{rm.name}</p>
                      {rm.affiliation && (
                        <p className="text-[10px] text-muted-foreground">{rm.affiliation}</p>
                      )}
                      <p className="text-xs text-muted-foreground italic mt-1">
                        &ldquo;{rm.principle ?? rm.principles}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {/* Meta tab */}
          {(agent.tags?.length ?? 0) > 0 && (
            <TabsContent value="meta" className="mt-0">
              <div className="px-5 py-4 space-y-3">
                {agent.tags && agent.tags.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">标签</p>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] font-mono">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {agent.provider && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Provider</p>
                    <span className="text-xs font-mono">{agent.provider}</span>
                  </div>
                )}
                {timestamp && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">更新时间</p>
                    <span className="text-xs font-mono text-muted-foreground">{formatDate(timestamp)}</span>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
          {/* Experience tab */}
          <TabsContent value="experience" className="mt-0">
            <div className="flex flex-col h-64">
              <ScrollArea className="flex-1">
                <div className="px-5 py-3 space-y-3">
                  {notesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : notes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">还没有经验笔记，写第一条吧</p>
                  ) : (
                    notes.map((n) => (
                      <div key={n.id} className="border-l-2 border-border pl-3 py-0.5">
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{n.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {n.author && n.author !== 'anonymous' && (
                            <span className="text-[10px] text-muted-foreground font-mono">{n.author}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground font-mono">{formatDate(n.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <div className="border-t border-border px-4 py-3 flex gap-2 items-end">
                <Textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="写下你的使用经验…"
                  className="text-xs resize-none min-h-[56px] flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveNote()
                  }}
                />
                <Button
                  size="sm"
                  className="shrink-0 gap-1"
                  disabled={noteSaving || !noteInput.trim()}
                  onClick={handleSaveNote}
                >
                  {noteSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Separator />

      {/* ── Footer ── */}
      <div className="px-5 py-3 flex items-center justify-between gap-3">
        {agent.documentation_url ? (
          <a
            href={agent.documentation_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            查看文档
          </a>
        ) : <span />}

        {/* Connect / Disconnect (external agents only) */}
        {(onConnect || onDisconnect) && (
          active ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
              disabled={disconnecting}
              onClick={() => onDisconnect?.(agent)}
            >
              {disconnecting
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Unplug className="w-3 h-3" />}
              {disconnecting ? '断开中…' : '断开连接'}
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={connecting}
              onClick={() => onConnect?.(agent)}
            >
              {connecting
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Plug className="w-3 h-3" />}
              {connecting ? '连接中…' : '连接 Agent'}
            </Button>
          )
        )}
      </div>
    </DialogContent>
  )
}

// ─── Micro helpers ────────────────────────────────────────────────────────────

function CapBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-mono ${
        active
          ? 'bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.55_0.15_145)] border-[oklch(0.65_0.15_145)]/20'
          : 'opacity-40'
      }`}
    >
      {active ? '✓' : '✗'} {label}
    </Badge>
  )
}
