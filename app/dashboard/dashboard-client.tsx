'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'

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
}

interface Agent {
  id: string
  name: string
  type: string
  description: string
  url?: string
  tags?: string[]
  enabled: boolean
}

interface McpTool {
  id: string
  tool_name: string
  category: string
  annotations?: Record<string, unknown>
}

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
  auditLogs: AuditLog[]
}

// ─── Integrations config ─────────────────────────────────────────────────────
// Integrations = 用户与 ONIT Agent 对话的渠道
// connected 状态从后端数据判断；coming_soon = 即将支持
const INTEGRATIONS = [
  {
    id: 'slack',
    name: 'Slack',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#4A154B]" aria-hidden>
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
      </svg>
    ),
    desc: '在 Slack 中与 Agent 团队对话',
    comingSoon: false,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#2CA5E0]" aria-hidden>
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    desc: '通过 Telegram Bot 与 Agent 对话',
    comingSoon: true,
  },
  {
    id: 'email',
    name: 'Email',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
    desc: '通过邮件与 Agent 收发任务',
    comingSoon: true,
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

// Agent type → badge variant
function agentTypeBadge(type: string) {
  if (type === 'external') return 'outline'
  return 'secondary'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardClient({
  user,
  tenant,
  initialApiKeys,
  agents,
  mcpTools,
  githubBindings,
  auditLogs,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys)
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [creatingKey, setCreatingKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refreshKeys = async () => {
    setLoadingKeys(true)
    const res = await fetch('/api/keys')
    if (res.ok) {
      const data = await res.json()
      setApiKeys(data.keys ?? [])
    }
    setLoadingKeys(false)
  }

  useEffect(() => { refreshKeys() }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return
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

  // 判断对话渠道的连接状态
  // Slack: 暂无用户级 binding 表，默认 Not connected
  const connectedIntegrations: Record<string, boolean> = {
    slack: false,
    telegram: false,
    email: false,
  }

  // 真实 agents（排除 spec）
  const realAgents = agents.filter(a => a.type !== 'spec')
  const liveAgents = realAgents.filter(a => a.url && a.url !== 'pending' && a.url !== 'N/A')

  // MCP 工具按 category 分组
  const mcpByCategory = mcpTools.reduce<Record<string, McpTool[]>>((acc, t) => {
    const cat = t.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {})

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
                <p className="text-xs text-muted-foreground font-mono mt-1.5">
                  Slug: <code className="bg-muted px-1.5 py-0.5 rounded">{orgSlug}</code>
                </p>
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
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {key.key_prefix}{'•'.repeat(16)}
                            </code>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(key.created_at)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {key.last_used_at ? formatDate(key.last_used_at) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRevokeKey(key.id)}
                            >
                              Revoke
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

            {/* ── Integrations ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">⚡ Integrations</CardTitle>
                <CardDescription>选择一个渠道，直接与你的 Agent 团队对话</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {INTEGRATIONS.map((integration) => {
                  const connected = connectedIntegrations[integration.id] ?? false
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
                            {integration.comingSoon && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal">
                                Coming soon
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
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground">Not connected</span>
                            <Button variant="outline" size="sm" className="h-6 text-xs" disabled={integration.comingSoon}>
                              Connect
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* ── Agent 团队 ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">🤖 Agent 团队</CardTitle>
                    <CardDescription>
                      {realAgents.length} 个 Agent，{liveAgents.length} 个在线
                    </CardDescription>
                  </div>
                  <Link href="/agents">
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      查看详情 →
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {realAgents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">暂无 Agent。</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Agent</TableHead>
                        <TableHead className="text-xs">类型</TableHead>
                        <TableHead className="text-xs">状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {realAgents.map((agent) => {
                        const isLive = agent.url && agent.url !== 'pending' && agent.url !== 'N/A'
                        return (
                          <TableRow key={agent.id}>
                            <TableCell className="text-xs font-medium">{agent.name}</TableCell>
                            <TableCell>
                              <Badge variant={agentTypeBadge(agent.type)} className="text-xs">
                                {agent.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                <span className="text-xs text-muted-foreground">
                                  {isLive ? 'Live' : 'Pending'}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* ── MCP 工具 ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">🔌 MCP 工具</CardTitle>
                    <CardDescription>
                      接入你自己的工具和数据源，供 Agent 团队调用
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                    + 接入 MCP
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {mcpTools.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs text-muted-foreground">暂无已接入的 MCP 工具</p>
                    <p className="text-xs text-muted-foreground mt-1">通过 MCP 协议接入你的工具和数据源，让 Agent 代你工作</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(mcpByCategory).map(([category, tools]) => (
                      <div key={category}>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">
                          {category}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {tools.map((tool) => (
                            <Badge key={tool.id} variant="secondary" className="text-xs font-normal">
                              {mcpFriendlyName(tool.tool_name)}
                            </Badge>
                          ))}
                        </div>
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

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">在线 Agent</p>
                <p className="text-2xl font-semibold mt-1">{liveAgents.length}</p>
                <p className="text-xs text-muted-foreground mt-1">共 {realAgents.length} 个</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">已接入 MCP</p>
                <p className="text-2xl font-semibold mt-1">{mcpTools.length}</p>
                <p className="text-xs text-muted-foreground mt-1">能力工具</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">GitHub 绑定</p>
                <p className="text-2xl font-semibold mt-1">{githubBindings.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {githubBindings.length > 0 ? githubBindings[0].repository_full_name.split('/')[1] : '未绑定'}
                </p>
              </Card>
            </div>

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
