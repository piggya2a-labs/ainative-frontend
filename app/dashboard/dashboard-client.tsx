'use client'

import React from 'react'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Copy, Check, Eye, EyeOff, Trash2, ExternalLink, Loader2, ChevronDown, Plus, Pencil } from 'lucide-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { usePostHog } from 'posthog-js/react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectTrigger } from '@/components/ui/select'
import type { AgentListItem, ConnectorRow } from '@/lib/database.types'

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
      if (res.ok) { const data = await res.json(); setApiKeys(data.keys ?? []) }
    } finally { setLoadingKeys(false) }
  }

  const [creatingTenant, setCreatingTenant] = useState(false)
  const [showNewTenantModal, setShowNewTenantModal] = useState(false)
  const [newTenantName, setNewTenantName] = useState('')

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
        setNewTenantName(''); setShowNewTenantModal(false)
        if (data.tenant) { setTenants(prev => [...prev, data.tenant]); setActiveTenantId(data.tenant.id) }
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
      if (res.ok) { const data = await res.json(); setApiKeys(data.keys ?? []) }
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
    if (!newKeyName.trim()) return
    posthog?.capture('api_key_create', { name: newKeyName.trim() })
    setCreatingKey(true)
    const tenantParam = activeTenantId ? `?tenant_id=${activeTenantId}` : ''
    const res = await fetch(`/api/keys${tenantParam}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName.trim() }),
    })
    const data = await res.json()
    if (res.ok && data.key) { setCreatedKey(data.key); setNewKeyName(''); await refreshKeys() }
    setCreatingKey(false)
  }

  const handleRevokeKey = async (id: string) => {
    posthog?.capture('api_key_revoke', { id })
    await fetch(`/api/keys?id=${id}`, { method: 'DELETE' })
    setApiKeys(prev => prev.filter(k => k.id !== id))
  }

  const handleCopy = () => {
    if (createdKey) { navigator.clipboard.writeText(createdKey); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  const orgName = tenant?.name || 'My Workspace'
  const orgSlug = tenant?.slug || '—'

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
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/channel-telegram`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
          body: JSON.stringify({ action: 'status' }),
        })
        const data = await res.json()
        if (data.status === 'connected') {
          clearInterval(tgPollRef.current!); tgPollRef.current = null; setTgStep('done')
          setTimeout(() => { setTelegramOpen(false); setTgStep('input'); setTgToken(''); setTgBotInfo(null); setTgDeepLink(null); window.location.reload() }, 2000)
        }
      } catch { /* ignore */ }
    }, 2000)
  }

  const handleTelegramVerify = async () => {
    if (!tgToken.trim()) return
    posthog?.capture('telegram_verify_click'); setTgLoading(true); setTgError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/channel-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'verify', bot_token: tgToken.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      setTgBotInfo(data.bot ?? { username: data.bot_username ?? data.username, first_name: data.bot_name ?? data.first_name })
      setTgStep('confirm')
    } catch (e: unknown) { setTgError(e instanceof Error ? e.message : 'Unknown error') }
    finally { setTgLoading(false) }
  }

  const handleTelegramConfirm = async () => {
    posthog?.capture('telegram_confirm_click'); setTgLoading(true); setTgError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/channel-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'connect', bot_token: tgToken.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connect failed')
      setTgDeepLink(data.deep_link ?? null); setTgStep('pending')
      if (session?.access_token) startTgPolling(session.access_token)
    } catch (e: unknown) { setTgError(e instanceof Error ? e.message : 'Unknown error') }
    finally { setTgLoading(false) }
  }

  const connectedAgents = mcpTools

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
            <a href="https://t.me/ONITAgent_bot" target="_blank" rel="noopener noreferrer" onClick={() => posthog?.capture('dashboard_telegram_cta_click')} className="shrink-0">
              <Button size="sm" className="h-7 text-xs">加入 →</Button>
            </a>
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

        {/* 已连接 Agent */}
        <CollapsibleSection title="已连接 AGENT" count={String(connectedAgents.length)}>
          {connectedAgents.length === 0 ? (
            <div className="px-4 py-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-mono">暂无连接。创建 API Key 后通过 MCP 接入。</span>
              <Link href="/marketplace">
                <Button variant="outline" size="sm" className="h-6 text-xs gap-1"><ExternalLink className="w-3 h-3" />Agent Wiki</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {connectedAgents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                  <div className="min-w-0">
                    <span className="text-sm font-medium block truncate">{agent.name}</span>
                    {agent.description && <span className="text-xs text-muted-foreground block truncate mt-0.5">{agent.description}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px] h-4 px-1 text-[oklch(0.45_0.18_145)] border-[oklch(0.65_0.18_145)/40]">已连接</Badge>
                    {agent.skills?.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1">{agent.skills.length} 工具</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* 我的项目（所有 tenant，可增删改，每行可展开数字卡片） */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">我的项目</span>
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
                    <div className="px-4 pb-3 pt-1 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/20 border-t border-border">
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
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        </div>

        {/* 审计视图 */}
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
            <DialogTitle className="text-sm">{createdKey ? '密钥已创建' : '创建 API Key'}</DialogTitle>
            <DialogDescription>{createdKey ? '请立即复制并妥善保存，此密钥只显示一次。' : '为这个密钥起一个名字，方便日后识别。'}</DialogDescription>
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
              <div className="space-y-1.5">
                <Label className="text-xs">Key 名称</Label>
                <Input placeholder="e.g. claude-desktop" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()} className="text-xs" autoFocus />
              </div>
              <Button className="w-full" size="sm" onClick={handleCreateKey} disabled={creatingKey || !newKeyName.trim()}>
                {creatingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}创建
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

      {/* Telegram Dialog */}
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
                <Input placeholder="1234567890:ABCDef..." value={tgToken} onChange={(e) => setTgToken(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleTelegramVerify()} className="text-xs font-mono" autoFocus />
                <p className="text-xs text-muted-foreground">在 <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline">@BotFather</a> 获取 Token</p>
              </div>
              {tgError && <p className="text-xs text-destructive">{tgError}</p>}
              <Button className="w-full" size="sm" onClick={handleTelegramVerify} disabled={tgLoading || !tgToken.trim()}>
                {tgLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}Verify
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
                {tgLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}Confirm & Connect
              </Button>
            </div>
          )}
          {tgStep === 'pending' && (
            <div className="space-y-3">
              {tgDeepLink ? (
                <a href={tgDeepLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full h-9 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors">
                  在 Telegram 中完成绑定 →
                </a>
              ) : <p className="text-xs text-muted-foreground">正在生成链接…</p>}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />等待你在 Telegram 中发送 /start…
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
