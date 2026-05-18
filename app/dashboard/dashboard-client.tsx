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

interface Props {
  user: User
  tenant: Tenant | null
  initialApiKeys: ApiKey[]
}

const ALL_INTEGRATIONS = [
  { id: 'github',    name: 'GitHub',      icon: '🐙', desc: '代码仓库与 CI/CD 自动化' },
  { id: 'slack',     name: 'Slack',       icon: '💬', desc: '团队沟通与通知推送' },
  { id: 'supabase',  name: 'Supabase',    icon: '⚡', desc: '数据库与实时数据访问' },
  { id: 'posthog',   name: 'PostHog',     icon: '📊', desc: '产品分析与用户行为追踪' },
  { id: 'sanity',    name: 'Sanity',      icon: '📝', desc: '内容管理与知识库' },
  { id: 'vercel',    name: 'Vercel',      icon: '▲',  desc: '部署与边缘函数' },
  { id: 'langgraph', name: 'LangGraph',   icon: '🔗', desc: 'Agent 编排与状态机' },
  { id: 'trigger',   name: 'Trigger.dev', icon: '⚙️', desc: '后台任务与定时自动化' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'numeric', day: 'numeric'
  })
}

export function DashboardClient({ user, tenant, initialApiKeys }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys)
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [creatingKey, setCreatingKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Refresh keys from API
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
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowCreateModal(true)}
                  >
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
                <CardDescription>将外部服务接入 ONIT，供 Agent 调用。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {ALL_INTEGRATIONS.map((integration) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg w-6 text-center">{integration.icon}</span>
                      <div>
                        <p className="text-xs font-medium">{integration.name}</p>
                        <p className="text-xs text-muted-foreground">{integration.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">即将支持</span>
                    </div>
                  </div>
                ))}
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
          <TabsContent value="usage" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">用量统计</CardTitle>
                <CardDescription>API 调用次数、工具使用情况等实时数据。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'API 调用次数', desc: '本月累计' },
                    { label: '活跃 Agent 数', desc: '过去 7 天' },
                    { label: '工具调用次数', desc: '本月累计' },
                  ].map((metric) => (
                    <div key={metric.label} className="p-4 bg-muted/40 rounded-lg">
                      <p className="text-xs text-muted-foreground">{metric.label}</p>
                      <p className="text-2xl font-semibold mt-1 text-muted-foreground">—</p>
                      <p className="text-xs text-muted-foreground mt-1">{metric.desc}</p>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <p className="text-xs text-muted-foreground text-center">
                  连接 Agent 团队后，用量数据将在此实时显示。
                </p>
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
