'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Copy, Check, Eye, EyeOff, Trash2, ExternalLink, Loader2, ChevronDown, Plus, Pencil, Download, CheckCircle2 } from 'lucide-react'
import { toast } from '@/components/ui/sonner'
import { useSearchParams } from 'next/navigation'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { usePostHog } from 'posthog-js/react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectTrigger } from '@/components/ui/select'
import type { AgentListItem, ConnectorRow } from '@/lib/database.types'
import { AgentIcon } from '@/components/agent-icon'

// ⚠️ 防回退：ApiKey 是单 key 设计，没有 id/name/last_used_at。
// 不要改回多 key 设计或引入 tenant_api_keys 表（已删）。
interface ApiKey {
  key_prefix: string
  created_at: string | null
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
  icon_url?: string | null
  mcp_url?: string | null
  url?: string | null
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
  metadata?: { actor?: string; cost_usd?: number; [key: string]: unknown }
  created_at: string
}

interface Props {
  user: User
  tenants: Tenant[]
  tenant: Tenant | null
  initialApiKeys: ApiKey[]
  agents: Agent[]
  mcpTools: McpTool[]
  githubBindings: GitHubBinding[]
  connectors: Connector[]
  auditLogs: AuditLog[]
  composioConnected: boolean
  composioToolCount: number
  agentCount: number
  allAgents: Array<{ id: string; name: string; icon_url?: string | null; mcp_url?: string | null; url?: string | null; description?: string | null; status?: string | null }>
}

const ONIT_MCP_URL = 'https://bgzrcrftjkcfdszumywd.supabase.co/functions/v1/mcp-server?agent=l2-coordinator-agent'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

function formatAction(action: string) {
  const map: Record<string, string> = {
    'api_key.create': '创建了 API Key',
    'api_key.revoke': '删除了 API Key',
    'tenant.create': '开启了新项目',
    'tenant.update': '更新了项目信息',
    'tenant.delete': '删除了项目',
    'milestone.update': '更新了里程碑状态',
    'milestone.complete': '完成了里程碑',
    'audit.submit': '提交了审计结论',
    'agent.connect': '连接了 Agent',
    'agent.disconnect': '断开了 Agent',
    'user.login': '登录',
    'mcsp.generate': '生成了 MCSP',
    'mcsp.update': '更新了 MCSP',
  }
  return map[action] ?? action
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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

function milestoneBadge(status: string) {
  if (status === 'done')   return <Badge variant="outline" className="text-[10px] h-4 px-1 text-[oklch(0.45_0.18_145)] border-[oklch(0.65_0.18_145)/40]">已完成</Badge>
  if (status === 'active') return <Badge variant="outline" className="text-[10px] h-4 px-1 text-[oklch(0.55_0.18_75)] border-[oklch(0.75_0.18_75)/40]">进行中</Badge>
  return <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">待开始</Badge>
}

function InlineCollapsible({ title, count, children }: { title: string; count?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between hover:bg-muted/40 transition-colors">
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{title}</span>
        <div className="flex items-center gap-2">
          {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent><div className="border-t border-border">{children}</div></CollapsibleContent>
    </Collapsible>
  )
}

function CollapsibleSection({ title, count, children }: { title: string; count?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border border-border rounded-lg overflow-hidden">
        <CollapsibleTrigger className="w-full px-4 py-3 bg-muted/20 flex items-center justify-between hover:bg-muted/40 transition-colors">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{title}</span>
          <div className="flex items-center gap-2">
            {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent><div className="border-t border-border">{children}</div></CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function getLiveUrl(tenant: Tenant | null | undefined): string | null {
  if (!tenant?.slug) return null
  const meta = tenant.metadata as { share_token?: string } | null
  if (!meta?.share_token) return null
  return `/r/${tenant.slug}?t=${meta.share_token}`
}

export function DashboardClient({
  user,
  tenants: initialTenants,
  tenant: initialTenant,
  initialApiKeys,
  agents: _agents,
  mcpTools,
  githubBindings: _githubBindings,
  connectors: _connectors,
  auditLogs,
  composioConnected: initialComposioConnected,
  composioToolCount,
  agentCount,
  allAgents,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const posthog = usePostHog()

  const [tenants, setTenants] = useState<Tenant[]>(initialTenants)
  const [activeTenantId, setActiveTenantId] = useState<string | null>(initialTenant?.id ?? null)
  const tenant = tenants.find(t => t.id === activeTenantId) ?? tenants[0] ?? null

  const handleTenantSwitch = async (id: string | null) => {
    if (!id) return
    setActiveTenantId(id)
    setLoadingKeys(true)
    try {
      const res = await fetch(`/api/keys?tenant_id=${id}`)
      if (res.ok) { const data = await res.json(); setApiKeys(data.key ? [data.key] : []) }
    } finally { setLoadingKeys(false) }
  }

  const [creatingTenant, setCreatingTenant] = useState(false)
  const [showNewTenantModal, setShowNewTenantModal] = useState(false)
  const [newTenantName, setNewTenantName] = useState('')
  // 新建成功后的 Telegram 引导弹窗
  const [showTelegramGuide, setShowTelegramGuide] = useState(false)
  const [newlyCreatedTenantName, setNewlyCreatedTenantName] = useState('')

  const handleCreateTenant = async () => {
    if (!newTenantName.trim()) return
    setCreatingTenant(true)
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTenantName.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        posthog?.capture('tenant_create', { name: newTenantName.trim() })
        const createdName = newTenantName.trim()
        setNewTenantName(''); setShowNewTenantModal(false)
        if (data.tenant) { setTenants(prev => [...prev, data.tenant]); setActiveTenantId(data.tenant.id) }
        // 新建成功后弹出 Telegram 引导
        setNewlyCreatedTenantName(createdName)
        setShowTelegramGuide(true)
        router.refresh()
      }
    } finally { setCreatingTenant(false) }
  }

  const [renamingTenant, setRenamingTenant] = useState<Tenant | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [savingRename, setSavingRename] = useState(false)

  const handleRename = async () => {
    if (!renamingTenant || !renameValue.trim()) return
    setSavingRename(true)
    try {
      const res = await fetch(`/api/tenants?id=${renamingTenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setTenants(prev => prev.map(t => t.id === renamingTenant.id ? { ...t, name: data.tenant.name } : t))
        setRenamingTenant(null); setRenameValue('')
      }
    } finally { setSavingRename(false) }
  }

  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleDeleteTenant = async (id: string) => {
    setDeletingTenantId(id)
    try {
      const res = await fetch(`/api/tenants?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        const remaining = tenants.filter(t => t.id !== id)
        setTenants(remaining)
        if (activeTenantId === id) setActiveTenantId(remaining[0]?.id ?? null)
        setConfirmDeleteId(null)
      }
    } finally { setDeletingTenantId(null) }
  }

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
    setRevealedKeys(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const copyKeyPrefix = async (id: string, prefix: string) => {
    await navigator.clipboard.writeText(prefix)
    setCopiedKeyId(id); setTimeout(() => setCopiedKeyId(null), 2000)
  }

  const refreshKeys = async () => {
    setLoadingKeys(true)
    try {
      const tenantParam = activeTenantId ? `?tenant_id=${activeTenantId}` : ''
      const res = await fetch(`/api/keys${tenantParam}`)
      if (res.ok) { const data = await res.json(); setApiKeys(data.key ? [data.key] : []) }
    } finally { setLoadingKeys(false) }
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
    posthog?.capture('api_key_create')
    setCreatingKey(true)
    const tenantParam = activeTenantId ? `?tenant_id=${activeTenantId}` : ''
    const res = await fetch(`/api/keys${tenantParam}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    if (res.ok && data.key) { setCreatedKey(data.key); setNewKeyName(''); await refreshKeys() }
    setCreatingKey(false)
  }

  const handleRevokeKey = async () => {
    posthog?.capture('api_key_revoke')
    await fetch('/api/keys', { method: 'DELETE' })
    setApiKeys([])
  }

  const handleCopy = () => {
    if (createdKey) { navigator.clipboard.writeText(createdKey); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  const orgName = tenant?.name || 'My Workspace'
  const orgSlug = tenant?.slug || '—'

  // ── Telegram 绑定（B 方案，已定稿，勿改回 A 方案）──────────────────────────────
  // 设计决策：ONIT 使用统一官方 Bot（@onitmeowbot），用户不需要自带 Bot Token。
  // 流程：点「加入 →」→ 调 channel-telegram（connect）→ 拿带 bind_token 的 deep link
  //       → 跳转 Telegram → 用户发 /start <bind_token> → webhook 写 tenants.telegram_chat_id
  // ⚠️ 不要改回「用户输入 Bot Token」的 A 方案——那是废弃设计，已清除。
  // ⚠️ 不要引入 telegramOpen dialog、tgToken state、handleTelegramVerify/Confirm——均已删除。
  const [tgBindLoading, setTgBindLoading] = useState(false)

  const handleTelegramBind = async () => {
    posthog?.capture('telegram_bind_click')
    setTgBindLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { toast.error('请先登录'); return }
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/channel-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'connect' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? '生成绑定链接失败，请重试'); return }
      const deepLink = data.deep_link as string
      if (deepLink) {
        window.open(deepLink, '_blank', 'noopener,noreferrer')
      } else {
        toast.error('未能获取绑定链接，请重试')
      }
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setTgBindLoading(false)
    }
  }

  const connectedAgents = mcpTools

  // Composio 连接器状态（初始值从服务端 user_metadata 读取，刷新后不丢失）
  const [composioConnecting, setComposioConnecting] = useState(false)
  const [composioConnected, setComposioConnected] = useState(initialComposioConnected)
  const searchParams = useSearchParams()

  const handleComposioConnect = async () => {
    setComposioConnecting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      // MCP OAuth 2.1 PKCE 授权流程
      const res = await fetch('/api/composio/mcp-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()

      if (data.authUrl) {
        // 把 PKCE 数据存入 sessionStorage，回调时用
        sessionStorage.setItem('composio_mcp_pkce', JSON.stringify({
          state: data.state ?? '',
          codeVerifier: data.codeVerifier ?? '',
          clientId: data.clientId ?? '',
          redirectUri: data.redirectUri,
        }))
        posthog?.capture('composio_mcp_connect_start')
        window.location.href = data.authUrl
      } else {
        toast.error(data.error ?? '获取授权链接失败，请重试')
      }
    } catch {
      toast.error('连接失败，请重试')
    } finally { setComposioConnecting(false) }
  }

  // 检测 Composio MCP OAuth 回调参数，完成 token 交换
  useEffect(() => {
    const composioError = searchParams.get('composio_error')
    const mcpCode = searchParams.get('composio_mcp_code')
    const mcpState = searchParams.get('composio_mcp_state')
    const composioConnectedParam = searchParams.get('composio_connected')

    if (composioError) {
      toast.error(`Composio 授权失败：${composioError}`)
      const url = new URL(window.location.href)
      url.searchParams.delete('composio_error')
      window.history.replaceState({}, '', url.toString())
      return
    }

    // MCP OAuth 回调：用 code 换 token
    if (mcpCode && mcpState) {
      const pkceRaw = sessionStorage.getItem('composio_mcp_pkce')
      if (!pkceRaw) {
        toast.error('授权数据丢失，请重试')
        return
      }
      const pkce = JSON.parse(pkceRaw) as { state: string; codeVerifier: string; clientId: string; redirectUri: string }
      if (pkce.state !== mcpState) {
        toast.error('授权状态不匹配，请重试')
        return
      }
      sessionStorage.removeItem('composio_mcp_pkce')
      const url = new URL(window.location.href)
      url.searchParams.delete('composio_mcp_code')
      url.searchParams.delete('composio_mcp_state')
      window.history.replaceState({}, '', url.toString())

      // 完成 token 交换
      ;(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch('/api/composio/mcp-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            code: mcpCode,
            codeVerifier: pkce.codeVerifier,
            clientId: pkce.clientId,
            redirectUri: pkce.redirectUri,
          }),
        })
        const result = await res.json()
        if (result.success) {
          setComposioConnected(true)
          posthog?.capture('composio_mcp_connect_success', { autoConnected: result.autoConnected })
          if (result.autoConnected?.length > 0) {
            toast.success(`Composio 已连接！自动接入 Agent：${result.autoConnected.join('、')} 🎉`)
            // 刷新页面让 AGENT 列表更新
            setTimeout(() => window.location.reload(), 1500)
          } else {
            toast.success('Composio 已连接！所有工具现在可用。')
          }
        } else {
          toast.error(result.error ?? 'Token 交换失败，请重试')
        }
      })()
      return
    }

    // 旧版 Connect Link 回调兼容
    if (composioConnectedParam) {
      setComposioConnected(true)
      posthog?.capture('composio_connect_success', { app: composioConnectedParam })
      toast.success(`已成功连接 ${composioConnectedParam}！Agent 现在可以使用这个工具了。`)
      const url = new URL(window.location.href)
      url.searchParams.delete('composio_connected')
      window.history.replaceState({}, '', url.toString())
      return
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const meta = tenant?.metadata as {
    share_token?: string
    current_milestone?: string
    milestones?: Array<{ id: string; order: number; status: string; tasks_total: number; tasks_done: number; name: string }>
    audit?: { health: string; last_audit: string | null; conclusion: string | null; next_action: string | null }
    client?: { contract_start: string; plan_period: string }
  } | null

  const milestones = Array.isArray(meta?.milestones) ? meta!.milestones : []
  const totalMilestones = milestones.length || 4
  const doneMilestones = milestones.filter(m => m.status === 'done').length
  const overallProgress = milestones.length > 0 ? Math.round((doneMilestones / totalMilestones) * 100) : null
  const currentM = meta?.current_milestone ? milestones.find(m => m.id === meta.current_milestone) ?? null : null
  const startDate = meta?.client?.contract_start || tenant?.created_at
  const runDays = startDate ? Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) : null
  const health = meta?.audit?.health
  const liveUrl = getLiveUrl(tenant)
  const latestKeyPrefix = apiKeys.length > 0 ? apiKeys[0].key_prefix : undefined

  return (
    <div className="min-h-screen bg-muted/40">
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
          <Link href="/docs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">文档</Link>
          <a href="mailto:support@onit.ai" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Support</a>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleSignOut}>退出</Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Workspace header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {tenants.length > 1 ? (
              <Select value={activeTenantId ?? ''} onValueChange={handleTenantSwitch}>
                <SelectTrigger className="h-8 text-sm font-semibold border-0 shadow-none px-0 gap-1 w-auto max-w-[240px] focus:ring-0">
                  <span className="flex-1 text-left truncate">{tenant?.name ?? '选择看板'}</span>
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(t => (
                    <button key={t.id} className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors ${t.id === activeTenantId ? 'font-semibold' : ''}`} onClick={() => handleTenantSwitch(t.id)}>
                      {t.name}
                    </button>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <h1 className="text-base font-semibold truncate">{orgName}</h1>
            )}
            <p className="text-xs text-muted-foreground font-mono hidden sm:block truncate">{orgSlug}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowNewTenantModal(true)}>
              <Plus className="w-3 h-3" />新建看板
            </Button>
            <Badge variant="secondary" className="text-xs">Beta</Badge>
          </div>
        </div>

        {/* Telegram + API KEYS + MCP */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-background">
            <div className="flex items-center gap-3 min-w-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#2AABEE] shrink-0" aria-hidden>
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              <div className="min-w-0">
                <span className="text-sm font-medium">Telegram</span>
                <span className="text-xs text-muted-foreground ml-2">加入全服群，和 Agent 团队直接对话</span>
              </div>
            </div>
            {/* ⚠️ 防回退：按钮调 handleTelegramBind 拿带 bind_token 的 deep link 再跳转，
                不要改回写死 https://t.me/onitmeowbot（没有 bind_token 无法关联 tenant）*/}
            <Button
              size="sm"
              className="h-7 text-xs shrink-0"
              disabled={tgBindLoading}
              onClick={handleTelegramBind}
            >
              {tgBindLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : '加入 →'}
            </Button>
          </div>

          {/* Composio 工具授权 */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-background border-t border-border">
            <div className="flex items-center gap-3 min-w-0">
              <svg viewBox="0 0 32 32" className="w-5 h-5 shrink-0" aria-hidden fill="none">
                <rect width="32" height="32" rx="8" fill="#6366f1"/>
                <path d="M8 16a8 8 0 1 1 16 0A8 8 0 0 1 8 16z" fill="white" fillOpacity=".15"/>
                <path d="M16 10v12M10 16h12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <div className="min-w-0">
                <span className="text-sm font-medium">Composio</span>
                <span className="text-xs text-muted-foreground ml-2">授权工具访问，Agent 自动继承</span>
              </div>
            </div>
            {composioConnected ? (
              <span className="text-xs text-[oklch(0.65_0.18_145)] font-medium flex items-center gap-1">
                <Check className="w-3 h-3" /> 已连接{composioToolCount > 0 ? ` · ${composioToolCount} 个工具` : ''}
              </span>
            ) : (
              <Button
                size="sm"
                className="h-7 text-xs shrink-0"
                variant="default"
                disabled={composioConnecting}
                onClick={handleComposioConnect}
              >
                {composioConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : '连接 →'}
              </Button>
            )}
          </div>

          <InlineCollapsible title="API KEYS" count={apiKeys.length > 0 ? String(apiKeys.length) : undefined}>
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
                    <div key={key.key_prefix} className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0 flex items-center gap-3">
                        <span className="text-xs font-medium truncate text-muted-foreground">API Key</span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {revealedKeys.has(key.key_prefix) ? key.key_prefix : `${key.key_prefix.slice(0, 8)}${'\u2022'.repeat(8)}`}
                          </code>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => toggleReveal(key.key_prefix)}>
                            {revealedKeys.has(key.key_prefix) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => copyKeyPrefix(key.key_prefix, key.key_prefix)}>
                            {copiedKeyId === key.key_prefix ? <Check className="h-3 w-3 text-[oklch(0.65_0.18_145)]" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground hidden sm:block">{key.created_at ? formatDate(key.created_at) : ''}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleRevokeKey()}>
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

          <InlineCollapsible title="MCP 接入 · CLAUDE DESKTOP">
            <div className="px-4 py-3">
              <ClaudeConfigBlock apiKey={latestKeyPrefix} />
              {!latestKeyPrefix && <p className="text-xs text-amber-600 mt-1.5">先创建一个 API Key，配置会自动填入。</p>}
              <p className="text-xs text-muted-foreground mt-2">
                粘贴到 <code className="font-mono bg-muted px-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code>
              </p>
            </div>
          </InlineCollapsible>

          <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">其他渠道：</span>
            {['Slack', '飞书', '微信'].map((ch) => (
              <Badge key={ch} variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">{ch} · Coming soon</Badge>
            ))}
          </div>
        </div>

        {/* PROJECT（所有 tenant，可增删改，每行可展开数字卡片） */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">PROJECT</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground gap-1" onClick={() => setShowNewTenantModal(true)}>
              <Plus className="w-3 h-3" /> 新建
            </Button>
          </div>
          <div className="divide-y divide-border">
            {tenants.map((t, idx) => {
              const tMeta = t.metadata as {
                share_token?: string
                current_milestone?: string
                milestones?: Array<{ id: string; order: number; status: string; tasks_total: number; tasks_done: number; name: string }>
                audit?: { health: string; conclusion: string | null }
                client?: { contract_start: string }
              } | null
              const tLiveUrl = getLiveUrl(t)
              const tMilestones = Array.isArray(tMeta?.milestones) ? tMeta!.milestones : []
              const tDone = tMilestones.filter(m => m.status === 'done').length
              const tTotal = tMilestones.length || 4
              const tCurrentM = tMeta?.current_milestone ? tMilestones.find(m => m.id === tMeta.current_milestone) : null
              const tProgress = tMilestones.length > 0 ? Math.round((tDone / tTotal) * 100) : null
              const tStartDate = tMeta?.client?.contract_start || t.created_at
              const tRunDays = tStartDate ? Math.floor((Date.now() - new Date(tStartDate).getTime()) / (1000 * 60 * 60 * 24)) : null
              const tHealth = tMeta?.audit?.health
              const tStatus = tCurrentM
                ? `${tCurrentM.id} ${tCurrentM.name} · 进行中`
                : tMilestones.length > 0
                  ? `${tDone}/${tTotal} 完成`
                  : 'ONIT 全局试运行'

              return (
                <Collapsible key={t.id}>
                  {/* 主行 */}
                  <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[10px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded shrink-0">P{idx + 1}</span>
                      <div className="min-w-0">
                        <span className="text-sm font-medium block truncate">{t.name}</span>
                        <span className="text-xs text-muted-foreground block truncate">{tStatus}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {tLiveUrl ? (
                        <Link href={tLiveUrl} target="_blank">
                          <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={() => posthog?.capture('dashboard_project_live_click', { tenant: t.name })}>
                            Live 看板 <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="outline" size="sm" className="h-6 text-xs gap-1 opacity-50" disabled>待初始化</Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => { setRenamingTenant(t); setRenameValue(t.name) }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {confirmDeleteId === t.id ? (
                        <div className="flex items-center gap-1">
                          <Button variant="destructive" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleDeleteTenant(t.id)} disabled={deletingTenantId === t.id}>
                            {deletingTenantId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '确认删除'}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setConfirmDeleteId(null)}>取消</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDeleteId(t.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                      {/* 展开箭头 */}
                      <CollapsibleTrigger className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:bg-muted/60 transition-colors">
                        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200" />
                      </CollapsibleTrigger>
                    </div>
                  </div>
                  {/* 展开的数字卡片 */}
                  <CollapsibleContent>
                    <div className="px-4 pb-3 pt-1 bg-muted/20 border-t border-border space-y-2">
                    {/* 验收状态 + skill.md 下载 */}
                    {(() => {
                      const isAccepted = !!(tMeta?.audit?.conclusion)
                      return (
                        <div className="flex items-center justify-between gap-3 py-1.5">
                          <div className="flex items-center gap-2">
                            {isAccepted ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--onit-green)' }} />
                                <span className="text-xs font-medium" style={{ color: 'var(--onit-green)' }}>已验收</span>
                                <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{tMeta?.audit?.conclusion}</span>
                              </>
                            ) : (
                              <>
                                <Loader2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground animate-spin" />
                                <span className="text-xs text-muted-foreground">Building…</span>
                              </>
                            )}
                          </div>
                          {/* ⚠️ 占位按钮：skill.md 下载，待接逻辑后启用。
                              内容来源：agent_registry.wiki + skills，由 Agent 通过 skill-creator 生成。
                              启用条件：isAccepted === true 且后端 /api/tenants/skill-export 接口就绪。*/}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] gap-1 shrink-0"
                            disabled
                            title="验收完成后可下载 SKILL.md"
                          >
                            <Download className="w-3 h-3" />
                            SKILL.md
                          </Button>
                        </div>
                      )
                    })()}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: '里程碑', value: tMilestones.length > 0 ? `${tDone}/${tTotal}` : '—', sub: 'M0 → M3' },
                        { label: '当前进度', value: tProgress !== null ? `${tProgress}%` : '—', sub: tCurrentM ? `${tCurrentM.id} · ${tCurrentM.name}` : tMeta?.current_milestone ?? '—' },
                        { label: '运行天数', value: tRunDays !== null ? String(tRunDays) : '—', sub: tStartDate ? formatDate(tStartDate) : '—' },
                        { label: '健康度', value: tHealth === 'green' ? '健康' : tHealth === 'yellow' ? '关注' : tHealth === 'red' ? '风险' : '—', sub: tMeta?.audit?.conclusion ? '已审计' : '待 @Eva 审计', healthColor: tHealth },
                      ].map(({ label, value, sub, healthColor }) => (
                        <div key={label} className="border border-border rounded-lg px-3 py-2.5 bg-background">
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                          <p className="text-base font-bold mt-0.5" style={healthColor ? { color: healthColor === 'green' ? 'var(--onit-green)' : healthColor === 'yellow' ? 'var(--onit-amber)' : healthColor === 'red' ? 'var(--destructive)' : undefined } : undefined}>
                            {value}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>
                        </div>
                      ))}
                    </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        </div>

        {/* AGENT */}
        <CollapsibleSection title="AGENT" count={agentCount > 0 ? String(agentCount) : undefined}>
          {allAgents.length === 0 ? (
            <div className="px-4 py-4">
              {!composioConnected ? (
                // 未连 Composio：引导连接
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono">连接 Composio 后，你的工具将自动出现在这里。</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs gap-1 shrink-0"
                    onClick={handleComposioConnect}
                    disabled={composioConnecting}
                  >
                    {composioConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                    连接 Composio
                  </Button>
                </div>
              ) : (
                // 已连 Composio 但暂无工具
                <span className="text-xs text-muted-foreground font-mono">暂无已连接工具，前往 Composio 添加应用后刷新。</span>
              )}
            </div>
          ) : (
            <div className="px-4 py-4">
              {/* Composio 工具 icon 头像墙 */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {allAgents.map((agent) => {
                  const st = agent.status ?? 'ACTIVE'
                  const dotColor =
                    st === 'ACTIVE' ? 'bg-green-400' :
                    st === 'EXPIRED' ? 'bg-yellow-400' :
                    st === 'INITIALIZING' || st === 'INITIATED' ? 'bg-gray-400 animate-pulse' :
                    'bg-red-400'
                  const tooltip = st === 'ACTIVE' ? agent.name :
                    st === 'EXPIRED' ? `${agent.name}（需重新授权）` :
                    st === 'INITIALIZING' || st === 'INITIATED' ? `${agent.name}（连接中...）` :
                    `${agent.name}（连接失败）`
                  return (
                    <a key={agent.id} href="https://app.composio.dev" target="_blank" rel="noopener noreferrer" title={tooltip}>
                      <div className="relative">
                        <AgentIcon
                          name={agent.name}
                          iconUrl={agent.icon_url}
                          mcpUrl={agent.mcp_url}
                          url={agent.url}
                          size={28}
                          className={`hover:scale-110 transition-all cursor-pointer ring-1 ring-border ${st !== 'ACTIVE' ? 'opacity-50' : 'opacity-80 hover:opacity-100'}`}
                        />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${dotColor}`} />
                      </div>
                    </a>
                  )
                })}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">已连接 {agentCount} 个工具，点击头像管理。</span>
                <a href="https://app.composio.dev" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="h-6 text-xs gap-1"><ExternalLink className="w-3 h-3" />Composio</Button>
                </a>
              </div>
            </div>
          )}
        </CollapsibleSection>

        {/* 操作日志 */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">操作日志</span>
            {liveUrl && (
              <Link href={liveUrl} target="_blank" onClick={() => posthog?.capture('dashboard_live_report_click', { tenant: tenant?.name })}>
                <Button variant="outline" size="sm" className="h-6 text-xs gap-1">Live 看板 <ExternalLink className="w-3 h-3" /></Button>
              </Link>
            )}
          </div>
          {auditLogs.length > 0 ? (
            <div className="divide-y divide-border">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded shrink-0 text-muted-foreground">
                      {log.metadata?.actor ?? (log.resource_type === 'agent' ? '@Agent' : '用户')}
                    </span>
                    <span className="text-xs truncate">{formatAction(log.action)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {log.metadata?.cost_usd != null && (
                      <span className="text-[10px] font-mono text-muted-foreground">${Number(log.metadata.cost_usd).toFixed(4)}</span>
                    )}
                    <Badge variant={log.status === 'success' ? 'secondary' : 'destructive'} className="text-[10px] h-4 px-1">{log.status === 'success' ? '成功' : '失败'}</Badge>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:block">{formatTime(log.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-muted-foreground font-mono">暂无操作记录。Agent 和用户的每次操作将自动记录在此。</div>
          )}
        </div>

      </main>

      {/* Modal: Create API Key */}
      <Dialog open={showCreateModal} onOpenChange={(open) => { if (!open) { setShowCreateModal(false); setCreatedKey(null); setNewKeyName('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{createdKey ? '密钥已创建' : '生成 API Key'}</DialogTitle>
            <DialogDescription>{createdKey ? '请立即复制并妥善保存，此密钥只显示一次。' : '点击生成你的 API Key，每个账号只有一个。'}</DialogDescription>
          </DialogHeader>
          {createdKey ? (
            <>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <code className="text-xs font-mono flex-1 break-all">{createdKey}</code>
                <Button variant="outline" size="sm" className="shrink-0 h-7 text-xs" onClick={handleCopy}>{copied ? '已复制' : '复制'}</Button>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">接入 Claude Desktop</p>
                <ClaudeConfigBlock apiKey={createdKey} />
              </div>
              <Button className="w-full" onClick={() => { setShowCreateModal(false); setCreatedKey(null) }}>我已保存，关闭</Button>
            </>
          ) : (
            <div className="space-y-3">
              <Button className="w-full" size="sm" onClick={handleCreateKey} disabled={creatingKey}>
                {creatingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}生成 API Key
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: 新建看板 */}
      <Dialog open={showNewTenantModal} onOpenChange={(open) => { if (!open) { setShowNewTenantModal(false); setNewTenantName('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">新建看板</DialogTitle>
            <DialogDescription>为新客户或新项目创建一个独立的 Live 看板。创建后可由 @Lumen 写入 MCSP 数据。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">看板名称（客户名 / 项目名）</Label>
              <Input placeholder="如：Acme Corp、小红书项目、客服 Agent 试运行" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateTenant()} className="text-xs" autoFocus />
            </div>
            <Button className="w-full" size="sm" onClick={handleCreateTenant} disabled={creatingTenant || !newTenantName.trim()}>
              {creatingTenant ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: 改名看板 */}
      <Dialog open={!!renamingTenant} onOpenChange={(open) => { if (!open) { setRenamingTenant(null); setRenameValue('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">改名看板</DialogTitle>
            <DialogDescription>修改「{renamingTenant?.name}」的名称。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">新名称</Label>
              <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRename()} className="text-xs" autoFocus />
            </div>
            <Button className="w-full" size="sm" onClick={handleRename} disabled={savingRename || !renameValue.trim()}>
              {savingRename ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ⚠️ 防回退：Telegram Dialog 已删除（A 方案废弃）。
          绑定流程是 B 方案：handleTelegramBind → deep link → Telegram Bot。
          不要在这里重新加 Dialog 或 Bot Token 输入框。*/}

      {/* Modal: 新建成功后 Telegram 引导
          ⚠️ 防回退：这是新建看板后引导用户去 Telegram 初始化项目的弹窗。
          不要删除或改成自动初始化——人类需要在 Telegram 里跟 Agent 用自然语言说清楚项目需求。*/}
      <Dialog open={showTelegramGuide} onOpenChange={setShowTelegramGuide}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--onit-green)' }} />
              看板「{newlyCreatedTenantName}」已创建
            </DialogTitle>
            <DialogDescription>
              下一步：去 Telegram 找 @onitmeowbot，告诉 Agent 这个项目的目标和背景，Agent 会帮你初始化 MCSP 和里程碑。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">可以这样说：</p>
              <p>「帮我初始化看板「{newlyCreatedTenantName}」，目标是 [你的目标]，背景是 [项目背景]」</p>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                size="sm"
                onClick={() => {
                  window.open('https://t.me/onitmeowbot', '_blank')
                  setShowTelegramGuide(false)
                }}
              >
                去 Telegram 初始化 →
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowTelegramGuide(false)}>稍后再说</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
