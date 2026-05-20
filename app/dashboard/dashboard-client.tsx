'use client'

import React from 'react'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Copy, Check, Eye, EyeOff, Trash2, ExternalLink, Loader2, ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { usePostHog } from 'posthog-js/react'
import { Label } from '@/components/ui/label'
import type { AgentListItem, ConnectorRow } from '@/lib/database.types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at?: string | null
}

interface Tenant {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
  metadata?: Record<string, unknown> | null
}

type Agent = AgentListItem

interface McpTool {
  id: string
  agent_id: string
  name: string
  description: string
  skills: Array<{ id: string; name: string; description: string }>
  connected_at: string
}

type Connector = Pick<ConnectorRow, 'id' | 'agent_id' | 'status' | 'metadata' | 'created_at'>

interface GitHubBinding {
  id: string
  repository_full_name: string
  status: string
  created_at: string
}

interface AuditLog {
  id: string
  action: string
  resource_type: string
  status: string
  metadata?: Record<string, unknown>
  created_at: string
}

interface Props {
  user: User
  tenant: Tenant | null
  initialApiKeys: ApiKey[]
  agents: Agent[]
  mcpTools: McpTool[]
  githubBindings: GitHubBinding[]
  connectors: Connector[]
  auditLogs: AuditLog[]
}

// ─── MCP URL ─────────────────────────────────────────────────────────────────
const ONIT_MCP_URL = 'https://bgzrcrftjkcfdszumywd.supabase.co/functions/v1/mcp-server?agent=l2-coordinator-agent'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'numeric', day: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function ClaudeConfigBlock({ apiKey }: { apiKey?: string }) {
  const [copied, setCopied] = useState(false)
  const config = JSON.stringify({
    mcpServers: {
      onit: {
        type: 'http',
        url: ONIT_MCP_URL,
        headers: { Authorization: `Bearer ${apiKey ?? 'YOUR_ONIT_API_KEY'}` }
      }
    }
  }, null, 2)
  function copyConfig() {
    navigator.clipboard.writeText(config).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <div className="relative">
      <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">{config}</pre>
      <Button variant="outline" size="sm" className="absolute top-2 right-2 h-6 text-[10px] gap-1" onClick={copyConfig}>
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? '已复制' : '复制'}
      </Button>
    </div>
  )
}

// ─── WhileLoop 里程碑数据 ─────────────────────────────────────────────────────
const MILESTONES = [
  { id: 'M0', label: 'M0 研究', role: '研究员 @Polly',         status: 'done'    },
  { id: 'M1', label: 'M1 方案', role: '客户成功经理 @Lumen',   status: 'active'  },
  { id: 'M2', label: 'M2 试运行', role: '执行工程师 @Sega',    status: 'pending' },
  { id: 'M3', label: 'M3 验收',  role: '审计员 @Eva',          status: 'pending' },
]

function milestoneBadge(status: string) {
  if (status === 'done')   return <Badge variant="outline" className="text-[10px] h-4 px-1 text-[oklch(0.45_0.18_145)] border-[oklch(0.65_0.18_145)/40]">已完成</Badge>
  if (status === 'active') return <Badge variant="outline" className="text-[10px] h-4 px-1 text-[oklch(0.55_0.18_75)] border-[oklch(0.75_0.18_75)/40]">进行中</Badge>
  return <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">待开始</Badge>
}

// ─── InlineCollapsible ─────────────────────────────────────────────────────
// 胶囊内的折叠行：共用同一个 border 容器，每行用 border-t 分隔
function InlineCollapsible({
  title,
  count,
  children,
}: {
  title: string
  count?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className="w-full px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between hover:bg-muted/40 transition-colors"
      >
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{title}</span>
        <div className="flex items-center gap-2">
          {count !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── CollapsibleSection ─────────────────────────────────────────────────────
// 复用 tools/page.tsx 的 border+header 行语言，加 Collapsible 展开
function CollapsibleSection({
  title,
  count,
  children,
}: {
  title: string
  count?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border border-border rounded-lg overflow-hidden">
        <CollapsibleTrigger
          className="w-full px-4 py-3 bg-muted/20 flex items-center justify-between hover:bg-muted/40 transition-colors"
        >
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{title}</span>
          <div className="flex items-center gap-2">
            {count !== undefined && (
              <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardClient({
  user,
  tenant,
  initialApiKeys,
  agents,
  mcpTools,
  githubBindings: _githubBindings,
  connectors,
  auditLogs,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const posthog = usePostHog()

  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys)
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [creatingKey, setCreatingKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)

  const toggleReveal = (id: string) => {
    setRevealedKeys(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyKeyPrefix = async (id: string, prefix: string) => {
    await navigator.clipboard.writeText(prefix)
    setCopiedKeyId(id)
    setTimeout(() => setCopiedKeyId(null), 2000)
  }

  const refreshKeys = async () => {
    setLoadingKeys(true)
    try {
      const res = await fetch('/api/keys')
      if (res.ok) {
        const data = await res.json()
        setApiKeys(data.keys ?? [])
      }
    } finally {
      setLoadingKeys(false)
    }
  }

  useEffect(() => {
    posthog?.capture('page_view', { page: 'dashboard' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignOut = async () => {
    posthog?.capture('dashboard_sign_out')
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return
    posthog?.capture('api_key_create', { name: newKeyName.trim() })
    setCreatingKey(true)
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName.trim() }),
    })
    const data = await res.json()
    if (res.ok && data.key) {
      setCreatedKey(data.key)
      setNewKeyName('')
      await refreshKeys()
    }
    setCreatingKey(false)
  }

  const handleRevokeKey = async (id: string) => {
    posthog?.capture('api_key_revoke', { id })
    await fetch(`/api/keys?id=${id}`, { method: 'DELETE' })
    setApiKeys(prev => prev.filter(k => k.id !== id))
  }

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const displayName = user.email?.split('@')[0] || user.id.slice(0, 8)
  const orgName = tenant?.name || 'My Workspace'
  const orgSlug = tenant?.slug || '—'

  // Telegram 连接 Dialog 状态（保留，供 Integrations 里的私有 Bot 接入流程使用）
  const [telegramOpen, setTelegramOpen] = useState(false)
  const [tgStep, setTgStep] = useState<'input' | 'confirm' | 'pending' | 'done'>('input')
  const [tgToken, setTgToken] = useState('')
  const [tgBotInfo, setTgBotInfo] = useState<{ username: string; first_name: string } | null>(null)
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null)
  const [tgLoading, setTgLoading] = useState(false)
  const [tgError, setTgError] = useState('')
  const tgPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTgPolling = (accessToken: string) => {
    if (tgPollRef.current) clearInterval(tgPollRef.current)
    tgPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/channel-telegram`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({ action: 'status' }),
          }
        )
        const data = await res.json()
        if (data.status === 'connected') {
          clearInterval(tgPollRef.current!)
          tgPollRef.current = null
          setTgStep('done')
          setTimeout(() => {
            setTelegramOpen(false)
            setTgStep('input'); setTgToken(''); setTgBotInfo(null); setTgDeepLink(null)
            window.location.reload()
          }, 2000)
        }
      } catch { /* 网络错误不中断轮询 */ }
    }, 2000)
  }

  const handleTelegramVerify = async () => {
    if (!tgToken.trim()) return
    posthog?.capture('telegram_verify_click')
    setTgLoading(true)
    setTgError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/channel-telegram`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'verify', bot_token: tgToken.trim() }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      setTgBotInfo(data.bot ?? { username: data.bot_username ?? data.username, first_name: data.bot_name ?? data.first_name })
      setTgStep('confirm')
    } catch (e: unknown) {
      setTgError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setTgLoading(false)
    }
  }

  const handleTelegramConfirm = async () => {
    posthog?.capture('telegram_confirm_click')
    setTgLoading(true)
    setTgError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/channel-telegram`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'connect', bot_token: tgToken.trim() }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connect failed')
      setTgDeepLink(data.deep_link ?? null)
      setTgStep('pending')
      if (session?.access_token) startTgPolling(session.access_token)
    } catch (e: unknown) {
      setTgError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setTgLoading(false)
    }
  }

  // 已连接的 Agent（mcpTools）
  const connectedAgents = mcpTools

  return (
    <div className="min-h-screen bg-muted/40">
      {/* ── Top navbar ── */}
      <header className="bg-background border-b px-4 h-12 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded bg-foreground flex items-center justify-center">
              <span className="text-background text-xs font-bold">O</span>
            </div>
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm font-medium">{orgName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:block">{user.email}</span>
          <Link href="/docs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            文档
          </Link>
          <a
            href="mailto:support@onit.ai"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Support
          </a>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleSignOut}>
            退出
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* ── Workspace header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">{orgName}</h1>
            <p className="text-xs text-muted-foreground font-mono">{orgSlug}</p>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">Beta</Badge>
        </div>

        {/* ══════════════════════════════════════
            1. Telegram 入口行
        ══════════════════════════════════════ */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Telegram 主行 */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-background">
            <div className="flex items-center gap-3 min-w-0">
              {/* Telegram 彩色 icon */}
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#2AABEE] shrink-0" aria-hidden>
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              <div className="min-w-0">
                <span className="text-sm font-medium">Telegram</span>
                <span className="text-xs text-muted-foreground ml-2">加入全服群，和 Agent 团队直接对话</span>
              </div>
            </div>
            <a
              href="https://t.me/ONITAgent_bot"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => posthog?.capture('dashboard_telegram_cta_click')}
              className="shrink-0"
            >
              <Button size="sm" className="h-7 text-xs">
                加入 →
              </Button>
            </a>
          </div>
          {/* API KEYS 折叠行 */}
          <InlineCollapsible
            title="API KEYS"
            count={apiKeys.length > 0 ? String(apiKeys.length) : undefined}
          >
            {loadingKeys ? (
              <div className="px-4 py-3 text-xs text-muted-foreground font-mono">加载中…</div>
            ) : apiKeys.length === 0 ? (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">还没有 API Key。创建一个开始接入 ONIT。</span>
                <Button size="sm" className="h-6 text-xs" onClick={() => setShowCreateModal(true)}>+ 创建</Button>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0 flex items-center gap-3">
                        <span className="text-xs font-medium truncate">{key.name}</span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {revealedKeys.has(key.id) ? key.key_prefix : `${key.key_prefix.slice(0, 8)}${'•'.repeat(8)}`}
                          </code>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => toggleReveal(key.id)}>
                            {revealedKeys.has(key.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => copyKeyPrefix(key.id, key.key_prefix)}>
                            {copiedKeyId === key.id ? <Check className="h-3 w-3 text-[oklch(0.65_0.18_145)]" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground hidden sm:block">{formatDate(key.created_at)}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleRevokeKey(key.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-border">
                  <Button size="sm" className="h-6 text-xs" onClick={() => setShowCreateModal(true)}>+ 创建</Button>
                </div>
              </>
            )}
          </InlineCollapsible>

          {/* MCP 折叠行 */}
          <InlineCollapsible title="MCP 接入 · CLAUDE DESKTOP">
            <div className="px-4 py-3">
              <ClaudeConfigBlock />
              <p className="text-xs text-muted-foreground mt-2">
                粘贴到 <code className="font-mono bg-muted px-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code>
              </p>
            </div>
          </InlineCollapsible>

          {/* 其他渠道（胶囊最底，暗示未来开放） */}
          <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">其他渠道：</span>
            {['Slack', '飞书', '微信'].map((ch) => (
              <Badge key={ch} variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">
                {ch} · Coming soon
              </Badge>
            ))}
          </div>
        </div>

        <CollapsibleSection title="已连接 AGENT" count={String(connectedAgents.length)}>
          {connectedAgents.length === 0 ? (
            <div className="px-4 py-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-mono">暂无连接。创建 API Key 后通过 MCP 接入。</span>
              <Link href="/marketplace">
                <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
                  <ExternalLink className="w-3 h-3" />Agent Wiki
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {connectedAgents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                  <div className="min-w-0">
                    <span className="text-sm font-medium block truncate">{agent.name}</span>
                    {agent.description && (
                      <span className="text-xs text-muted-foreground block truncate mt-0.5">{agent.description}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px] h-4 px-1 text-[oklch(0.45_0.18_145)] border-[oklch(0.65_0.18_145)/40]">已连接</Badge>
                    {agent.skills?.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">{agent.skills.length} 工具</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* ══════════════════════════════════════
            2. 我的项目
        ══════════════════════════════════════ */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* 区块 header */}
          <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">我的项目</span>
            <Link href="/how-we-work">
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground gap-1">
                查看流程 <ExternalLink className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          {/* 项目行 */}
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[10px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded shrink-0">P1</span>
                <div className="min-w-0">
                  <span className="text-sm font-medium block truncate">{orgName}</span>
                  <span className="text-xs text-muted-foreground block truncate">ONIT 全局试运行</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px] h-4 px-1 text-[oklch(0.55_0.18_75)] border-[oklch(0.75_0.18_75)/40]">
                  M1 进行中
                </Badge>
                <Link href="/how-we-work">
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground">详情</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>



        {/* ══════════════════════════════════════
            4. 审计视图（Eva）+ 汇总数字 + Live 看板链接
        ══════════════════════════════════════ */}
        {(() => {
          // 从 tenant.metadata 读取 MCSP 数据
          const meta = tenant?.metadata as {
            share_token?: string
            current_milestone?: string
            milestones?: Array<{ id: string; order: number; status: string; tasks_total: number; tasks_done: number; name: string }>
            audit?: { health: string; last_audit: string | null; conclusion: string | null; next_action: string | null }
            client?: { contract_start: string; plan_period: string }
          } | null

          const contractStart = meta?.client?.contract_start
          const runDays = contractStart
            ? Math.floor((Date.now() - new Date(contractStart).getTime()) / (1000 * 60 * 60 * 24))
            : null

          const milestones = Array.isArray(meta?.milestones) ? meta.milestones : []
          const doneMilestones = milestones.length > 0
            ? milestones.filter(m => m.status === 'done').length
            : null

          const currentM = meta?.current_milestone
            ? milestones.find(m => m.id === meta.current_milestone) ?? null
            : null
          const currentProgress = currentM
            ? Math.round((currentM.tasks_done / Math.max(currentM.tasks_total, 1)) * 100)
            : null

          const health = meta?.audit?.health
          const shareToken = meta?.share_token
          const liveUrl = tenant?.slug && shareToken
            ? `/r/${tenant.slug}?t=${shareToken}`
            : null

          return (
            <>
              {/* 汇总数字卡片（仅在有 metadata 时展示） */}
              {meta && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: '里程碑', value: doneMilestones !== null ? `${doneMilestones}/4` : '—', sub: 'M0 → M3' },
                    { label: '当前进度', value: currentProgress !== null ? `${currentProgress}%` : '—', sub: meta.current_milestone ? `${meta.current_milestone} · ${currentM?.name ?? ''}` : '—' },
                    { label: '运行天数', value: runDays !== null ? String(runDays) : '—', sub: contractStart ?? '—' },
                    {
                      label: '健康度',
                      value: health === 'green' ? '健康' : health === 'yellow' ? '关注' : health === 'red' ? '风险' : '—',
                      sub: '待 @Eva 审计',
                      healthColor: health
                    },
                  ].map(({ label, value, sub, healthColor }) => (
                    <div key={label} className="border border-border rounded-lg px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p
                        className="text-lg font-bold mt-0.5"
                        style={healthColor ? {
                          color: healthColor === 'green'
                            ? 'var(--onit-green)'
                            : healthColor === 'yellow'
                            ? 'var(--onit-amber)'
                            : healthColor === 'red'
                            ? 'var(--destructive)'
                            : undefined
                        } : undefined}
                      >
                        {value}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 审计视图 */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    审计员 @Eva · WhileLoop 状态
                  </span>
                  <div className="flex items-center gap-2">
                    {liveUrl && (
                      <Link
                        href={liveUrl}
                        target="_blank"
                        onClick={() => posthog?.capture('dashboard_live_report_click', { tenant: tenant?.name })}
                      >
                        <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
                          Live 看板 <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    )}
                    <Link href="/how-we-work">
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground gap-1">
                        查看 MCSP <ExternalLink className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {MILESTONES.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0">
                        <span className="text-sm font-medium block">{m.label}</span>
                        <span className="text-xs text-muted-foreground block mt-0.5">{m.role}</span>
                      </div>
                      <div className="shrink-0">
                        {milestoneBadge(m.status)}
                      </div>
                    </div>
                  ))}
                  {/* 审计结论行 */}
                  <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-muted/10">
                    <span className="text-xs text-muted-foreground">
                      {meta?.audit?.next_action ?? 'M1 方案交付后，@Eva 将进行全局审计。'}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1 text-[oklch(0.55_0.18_75)] border-[oklch(0.75_0.18_75)/40] shrink-0">
                      {meta?.audit?.conclusion ? '已审' : '待审'}
                    </Badge>
                  </div>
                </div>
              </div>
            </>
          )
        })()}



        {/* ══════════════════════════════════════
            7. 最近系统活动
        ══════════════════════════════════════ */}
        {auditLogs.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-muted/20 border-b border-border">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">最近系统活动</span>
            </div>
            <div className="divide-y divide-border">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                  <div className="min-w-0">
                    <span className="text-xs font-mono truncate block">{log.action}</span>
                    <span className="text-[10px] text-muted-foreground">{log.resource_type}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={log.status === 'success' ? 'secondary' : 'destructive'}
                      className="text-[10px] h-4 px-1"
                    >
                      {log.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:block">
                      {formatTime(log.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ── Modal: Create API Key ── */}
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          if (!open) { setShowCreateModal(false); setCreatedKey(null); setNewKeyName('') }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {createdKey ? '密钥已创建' : '创建 API Key'}
            </DialogTitle>
            <DialogDescription>
              {createdKey
                ? '请立即复制并妥善保存，此密钥只显示一次。'
                : '为这个密钥起一个名字，方便日后识别。'}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <code className="text-xs font-mono flex-1 break-all">{createdKey}</code>
                <Button variant="outline" size="sm" className="shrink-0 h-7 text-xs" onClick={handleCopy}>
                  {copied ? '已复制' : '复制'}
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">接入 Claude Desktop</p>
                <ClaudeConfigBlock apiKey={createdKey} />
              </div>
              <Button className="w-full" onClick={() => { setShowCreateModal(false); setCreatedKey(null) }}>
                我已保存，关闭
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Key 名称</Label>
                <Input
                  placeholder="e.g. claude-desktop"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
                  className="text-xs"
                  autoFocus
                />
              </div>
              <Button
                className="w-full"
                size="sm"
                onClick={handleCreateKey}
                disabled={creatingKey || !newKeyName.trim()}
              >
                {creatingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                创建
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Telegram 私有 Bot Dialog（保留供未来私有接入） ── */}
      <Dialog open={telegramOpen} onOpenChange={(o) => {
        if (!o) {
          if (tgPollRef.current) { clearInterval(tgPollRef.current); tgPollRef.current = null }
          setTelegramOpen(false); setTgStep('input'); setTgToken(''); setTgBotInfo(null); setTgDeepLink(null); setTgError('')
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Connect Telegram</DialogTitle>
            <DialogDescription>
              {tgStep === 'input' && '输入你的 Telegram Bot Token，我们会验证并连接。'}
              {tgStep === 'confirm' && `确认连接 @${tgBotInfo?.username} 吗？`}
              {tgStep === 'pending' && '点击下方链接完成绑定'}
              {tgStep === 'done' && '绑定成功！'}
            </DialogDescription>
          </DialogHeader>

          {tgStep === 'input' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Bot Token</Label>
                <Input
                  placeholder="1234567890:ABCDef..."
                  value={tgToken}
                  onChange={(e) => setTgToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTelegramVerify()}
                  className="text-xs font-mono"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  在 <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline">@BotFather</a> 获取 Token
                </p>
              </div>
              {tgError && <p className="text-xs text-destructive">{tgError}</p>}
              <Button className="w-full" size="sm" onClick={handleTelegramVerify} disabled={tgLoading || !tgToken.trim()}>
                {tgLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Verify
              </Button>
            </div>
          )}

          {tgStep === 'confirm' && tgBotInfo && (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-muted text-xs space-y-1">
                <p><span className="text-muted-foreground">Name:</span> {tgBotInfo.first_name}</p>
                <p><span className="text-muted-foreground">Username:</span> @{tgBotInfo.username}</p>
              </div>
              {tgError && <p className="text-xs text-destructive">{tgError}</p>}
              <Button className="w-full" size="sm" onClick={handleTelegramConfirm} disabled={tgLoading}>
                {tgLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Confirm & Connect
              </Button>
            </div>
          )}

          {tgStep === 'pending' && (
            <div className="space-y-3">
              {tgDeepLink ? (
                <a
                  href={tgDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-9 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  在 Telegram 中完成绑定 →
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">正在生成链接…</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                等待你在 Telegram 中发送 /start…
              </div>
            </div>
          )}

          {tgStep === 'done' && (
            <div className="text-center py-4">
              <p className="text-sm font-medium text-[oklch(0.45_0.18_145)]">绑定成功！</p>
              <p className="text-xs text-muted-foreground mt-1">正在刷新页面…</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
