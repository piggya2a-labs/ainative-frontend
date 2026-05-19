'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Copy, Check, Eye, EyeOff, Trash2, Zap, BookOpen, Loader2, Bot, Plug, GitBranch, ExternalLink } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import { Label } from '@/components/ui/label'
import type { AgentListItem, ConnectorRow } from '@/lib/database.types'

// ─── Types ───────────────────────────────────────────────────────────────────────

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
}

// Agent 展示用类型：直接用 database.types 中的 AgentListItem
type Agent = AgentListItem

interface McpTool {
  id: string
  agent_id: string
  name: string
  description: string
  skills: Array<{ id: string; name: string; description: string }>
  connected_at: string
}

// Connector 展示用类型：用 ConnectorRow 的字段子集
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

// ─── Integrations config ─────────────────────────────────────────────────────
const INTEGRATIONS = [
  {
    id: 'slack',
    agentId: 'ext-slack-agent',
    name: 'Slack',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#4A154B]" aria-hidden>
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
      </svg>
    ),
    desc: '在 Slack 里直接与 Agent 团队对话',
    coming_soon: false,
  },
  {
    id: 'telegram',
    agentId: 'ext-telegram-agent',
    name: 'Telegram',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#2AABEE]" aria-hidden>
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    desc: '通过 Telegram Bot 与 Agent 团队交互',
    coming_soon: false,
  },
  {
    id: 'feishu',
    agentId: 'ext-feishu-agent',
    name: '飞书',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden fill="none">
        <rect width="24" height="24" rx="6" fill="#3370FF"/>
        <path d="M7 8.5L12 6l5 2.5-5 2.5L7 8.5z" fill="white" opacity="0.9"/>
        <path d="M7 8.5v5l5 2.5v-5L7 8.5z" fill="white" opacity="0.7"/>
        <path d="M17 8.5v5l-5 2.5v-5l5-2.5z" fill="white" opacity="0.5"/>
      </svg>
    ),
    desc: '扫码连接飞书，Agent 直接在飞书回复',
    coming_soon: true,
  },
  {
    id: 'wechat',
    agentId: 'ext-wechat-agent',
    name: '微信',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#07C160]" aria-hidden>
        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zm-3.74 3.668c.532 0 .963.441.963.983a.963.963 0 0 1-.963.983.963.963 0 0 1-.963-.983c0-.542.431-.983.963-.983zm7.355 0c.532 0 .963.441.963.983a.963.963 0 0 1-.963.983.963.963 0 0 1-.963-.983c0-.542.431-.983.963-.983z"/>
      </svg>
    ),
    desc: '扫码连接微信，Agent 直接在微信回复',
    coming_soon: true,
  },
]

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

// MCP tool_name → 友好名称
function mcpFriendlyName(toolName: string): string {
  return toolName
    .replace(/^cap_/, '')
    .replace(/_mcp$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardClient({
  user,
  tenant,
  initialApiKeys,
  agents,
  mcpTools,
  githubBindings,
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
    // SSR 已通过 initialApiKeys 传入数据，不需要重复加载
    // 只做 PostHog 埋点
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

  // 渠道连接状态（从 tenant_connectors 读取）
  const connectorMap = Object.fromEntries(
    (connectors ?? []).map(c => [c.agent_id, c])
  )

  // Telegram 连接 Dialog 状态
  const [telegramOpen, setTelegramOpen] = useState(false)
  const [tgStep, setTgStep] = useState<'input' | 'confirm' | 'pending' | 'done'>('input')
  const [tgToken, setTgToken] = useState('')
  const [tgBotInfo, setTgBotInfo] = useState<{ username: string; first_name: string } | null>(null)
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null)
  const [tgLoading, setTgLoading] = useState(false)
  const [tgError, setTgError] = useState('')
  const tgPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 轮询 Telegram 连接状态
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
      // 展示 deep_link，进入等待用户点击的 pending 步骤
      setTgDeepLink(data.deep_link ?? null)
      setTgStep('pending')
      // 开始轮询，用户在 Telegram 发 /start 后自动跳转 done
      if (session?.access_token) startTgPolling(session.access_token)
    } catch (e: unknown) {
      setTgError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setTgLoading(false)
    }
  }

  const handleSlackConnect = async () => {
    posthog?.capture('slack_connect_click')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/channel-slack`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'get_oauth_url' }),
        }
      )
      const data = await res.json()
      if (data.oauth_url) {
        window.location.href = data.oauth_url
      }
    } catch (e) {
      console.error('Slack connect error:', e)
    }
  }

  // 已经在 server 侧只查 type=agent，这里直接用
  const realAgents = agents
  const liveAgents = agents.filter(a => a.enabled)

  // tag 映射中文（与 agent-card 保持一致）
  const TAG_LABELS: Record<string, string> = {
    development: '执行', operations: '运维', architecture: '设计',
    coordination: '协调', audit: '审核', platform: '核心',
    core: '核心', native: '核心',
  }
  function getRoleLabel(tags: string[] | null): string {
    for (const tag of (tags ?? [])) {
      if (TAG_LABELS[tag]) return TAG_LABELS[tag]
    }
    return 'Agent'
  }



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
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{orgName}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{orgSlug}</p>
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">Beta</Badge>
            </div>
          </CardHeader>

        </Card>

        <Tabs defaultValue="setup">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="setup" className="text-xs">Setup</TabsTrigger>
            <TabsTrigger value="usage" className="text-xs">Usage</TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════
              SETUP TAB
          ══════════════════════════════════════ */}
          <TabsContent value="setup" className="space-y-4 mt-4">

            {/* ── API Keys ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">🔑 API Keys</CardTitle>
                    <CardDescription>用于接入 ONIT MCP Server 的认证密钥。</CardDescription>
                  </div>
                  <Button size="sm" className="h-7 text-xs" onClick={() => setShowCreateModal(true)}>
                    + Create API Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingKeys ? (
                  <p className="text-xs text-muted-foreground">加载中...</p>
                ) : apiKeys.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Key</TableHead>
                        <TableHead className="text-xs">Created</TableHead>
                        <TableHead className="text-xs">Last Used</TableHead>
                        <TableHead className="text-xs text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell className="text-xs font-medium">{key.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                {revealedKeys.has(key.id)
                                  ? key.key_prefix
                                  : `${key.key_prefix.slice(0, 8)}${'\u2022'.repeat(12)}`}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                onClick={() => toggleReveal(key.id)}
                              >
                                {revealedKeys.has(key.id)
                                  ? <EyeOff className="h-3 w-3" />
                                  : <Eye className="h-3 w-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                onClick={() => copyKeyPrefix(key.id, key.key_prefix)}
                              >
                                {copiedKeyId === key.id
                                  ? <Check className="h-3 w-3 text-emerald-500" />
                                  : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(key.created_at)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {key.last_used_at ? formatDate(key.last_used_at) : '\u2014'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRevokeKey(key.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    还没有 API Key。创建一个开始接入 ONIT。
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ── 接入 Claude Desktop ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">🔌 接入 Claude Desktop</CardTitle>
                <CardDescription>创建 API Key 后，将以下配置粘贴到 claude_desktop_config.json 的 mcpServers 里。</CardDescription>
              </CardHeader>
              <CardContent>
                <ClaudeConfigBlock />
                <p className="text-xs text-muted-foreground mt-2">配置文件位置：macOS <code className="font-mono bg-muted px-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code></p>
              </CardContent>
            </Card>

            {/* ── Integrations ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">⚡ Integrations</CardTitle>
                <CardDescription>选择一个渠道，直接与你的 Agent 团队对话。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {INTEGRATIONS.map((integration) => {
                  const connector = connectorMap[integration.agentId]
                  const connected = connector?.status === 'connected'
                  const pending = connector?.status === 'pending_start' || connector?.status === 'pending_verify'
                  const comingSoon = (integration as { coming_soon?: boolean }).coming_soon
                  return (
                    <div
                      key={integration.id}
                      className="flex items-center justify-between py-2.5 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md border flex items-center justify-center bg-background shrink-0">
                          {integration.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium">{integration.name}</p>
                            {comingSoon && (
                              <Badge variant="outline" className="text-xs h-4 px-1 text-muted-foreground">
                                Coming soon
                              </Badge>
                            )}
                            {pending && (
                              <Badge variant="outline" className="text-xs h-4 px-1 text-amber-600 border-amber-400">
                                Pending
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{integration.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        {connected ? (
                          <>
                            <span className="text-xs text-emerald-600 font-medium">Connected</span>
                            <Button variant="outline" size="sm" className="h-6 text-xs" disabled>
                              Disconnect
                            </Button>
                          </>
                        ) : comingSoon ? (
                          <Button variant="outline" size="sm" className="h-6 text-xs" disabled>
                            Connect
                          </Button>
                        ) : integration.id === 'slack' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={handleSlackConnect}
                          >
                            Connect
                          </Button>
                        ) : integration.id === 'telegram' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => { setTelegramOpen(true); setTgStep('input'); setTgToken(''); setTgBotInfo(null); setTgError('') }}
                          >
                            Connect
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="h-6 text-xs" disabled>
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Telegram 连接 Dialog */}
            <Dialog open={telegramOpen} onOpenChange={(o) => { if (!o) { if (tgPollRef.current) { clearInterval(tgPollRef.current); tgPollRef.current = null } setTelegramOpen(false); setTgStep('input'); setTgToken(''); setTgBotInfo(null); setTgDeepLink(null); setTgError('') } }}>
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
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={handleTelegramVerify}
                      disabled={tgLoading || !tgToken.trim()}
                    >
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
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={handleTelegramConfirm}
                      disabled={tgLoading}
                    >
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
                        className="flex items-center justify-center gap-2 w-full h-9 rounded-md bg-[#2AABEE]/10 border border-[#2AABEE]/30 text-sm font-medium text-[#2AABEE] hover:bg-[#2AABEE]/20 transition-colors"
                      >
                        在 Telegram 中完成绑定 →
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">正在生成链接…</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      <span>等待绑定确认，点击链接后在 Telegram 发送 /start 即可自动完成</span>
                    </div>
                    {tgError && <p className="text-xs text-destructive">{tgError}</p>}
                  </div>
                )}

                {tgStep === 'done' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs">
                      <p className="font-medium text-emerald-700 dark:text-emerald-400 mb-1">绑定成功 ✅</p>
                      <p className="text-muted-foreground">@{tgBotInfo?.username} 已就绪，直接发消息即可与 ONIT 对话。</p>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* ── Brand Skills ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">📚 Brand Skills</CardTitle>
                    <CardDescription>给 Agent 添加品牌上下文、业务知识和工作规范。</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                    + Add Skill
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  还没有 Skill。添加一个让 Agent 了解你的品牌声音、产品知识或工作流程。
                </p>
              </CardContent>
            </Card>

            {/* ── 已接入的 MCP ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">🔌 已接入的 MCP</CardTitle>
                    <CardDescription>
                      {mcpTools.length > 0 ? `${mcpTools.length} 个外部工具已连接` : '还没有连接任何外部工具'}
                    </CardDescription>
                  </div>
                  <Link href="/marketplace">
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Agent Wiki →
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {mcpTools.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <p className="text-xs text-muted-foreground">还没有接入任何外部工具。</p>
                    <Link href="/marketplace">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                        <ExternalLink className="w-3 h-3" />
                        去 Agent Wiki 接入
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mcpTools.map((mcp) => (
                      <div key={mcp.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-border">
                        <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 text-[10px] font-bold">
                          {mcp.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium truncate">{mcp.name}</p>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
                              {mcp.skills.length} 工具
                            </Badge>
                          </div>
                          {mcp.description && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{mcp.description}</p>
                          )}
                        </div>
                        <Link href="/marketplace" className="shrink-0">
                          <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground">
                            管理
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Team ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">👥 Team</CardTitle>
                    <CardDescription>管理成员与邀请。</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                    ✉️ Invite Member
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-xs">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-xs font-medium">
                        {displayName}{' '}
                        <span className="text-muted-foreground font-normal">(you)</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{user.email}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="secondary" className="text-xs">owner</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(user.created_at)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

          </TabsContent>

          {/* ══════════════════════════════════════
              USAGE TAB
          ══════════════════════════════════════ */}
          <TabsContent value="usage" className="mt-4 space-y-4">

            {/* Recent Activity */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">最近系统活动</CardTitle>
                <CardDescription>来自 audit_logs 的最新事件记录</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">暂无活动记录。</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Action</TableHead>
                        <TableHead className="text-xs">Resource</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs font-mono max-w-[180px] truncate">
                            {log.action}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.resource_type}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={log.status === 'success' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTime(log.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

          </TabsContent>
        </Tabs>
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
              {/* ── 接入 Claude Desktop ── */}
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">接入 Claude Desktop</p>
                <p className="text-xs text-muted-foreground">将以下配置粘贴到 <code className="font-mono bg-muted px-1 rounded">claude_desktop_config.json</code> 的 <code className="font-mono bg-muted px-1 rounded">mcpServers</code> 里：</p>
                <ClaudeConfigBlock apiKey={createdKey} />
              </div>
              <Button
                className="w-full"
                onClick={() => { setShowCreateModal(false); setCreatedKey(null) }}
              >
                我已保存，关闭
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <Input
                placeholder="e.g. Production Key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
                className="text-sm"
                autoFocus
              />
              <Button
                className="w-full"
                onClick={handleCreateKey}
                disabled={creatingKey || !newKeyName.trim()}
              >
                {creatingKey ? '创建中...' : 'Create API Key'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
