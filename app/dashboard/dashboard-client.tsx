'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'
import type { DashboardConfig } from '@/app/api/generate-dashboard/route'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  created_at: string
  revoked_at: string | null
}

interface Project {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
}

interface Tenant {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
  metadata?: Record<string, unknown>
}

interface Props {
  user: User
  tenant: Tenant | null
  apiKeys: ApiKey[]
  projects: Project[]
  dashboardConfig: DashboardConfig
}

const ALL_INTEGRATIONS = [
  { id: 'github', name: 'GitHub', desc: '代码仓库与 CI/CD 自动化' },
  { id: 'slack', name: 'Slack', desc: '团队沟通与通知推送' },
  { id: 'supabase', name: 'Supabase', desc: '数据库与实时数据访问' },
  { id: 'posthog', name: 'PostHog', desc: '产品分析与用户行为追踪' },
  { id: 'sanity', name: 'Sanity', desc: '内容管理与知识库' },
  { id: 'vercel', name: 'Vercel', desc: '部署与边缘函数' },
  { id: 'langgraph', name: 'LangGraph', desc: 'Agent 编排与状态机' },
  { id: 'trigger', name: 'Trigger.dev', desc: '后台任务与定时自动化' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'numeric', day: 'numeric'
  })
}

function maskKey(prefix: string) {
  return `${prefix}${'•'.repeat(20)}`
}

export function DashboardClient({ user, tenant, apiKeys, projects, dashboardConfig }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [creatingKey, setCreatingKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [localApiKeys, setLocalApiKeys] = useState<ApiKey[]>(apiKeys)
  const [copied, setCopied] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleCreateApiKey = async () => {
    if (!tenant || !newKeyName.trim()) return
    setCreatingKey(true)

    const rawKey = 'onit_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    const prefix = rawKey.slice(0, 12)

    const { data, error } = await supabase
      .from('tenant_api_keys')
      .insert({
        tenant_id: tenant.id,
        name: newKeyName.trim(),
        key_hash: rawKey,
        key_prefix: prefix,
      })
      .select('id, name, key_prefix, created_at, revoked_at')
      .single()

    if (!error && data) {
      setLocalApiKeys([data, ...localApiKeys])
      setCreatedKey(rawKey)
      setShowKeyModal(true)
      setNewKeyName('')
    }
    setCreatingKey(false)
  }

  const handleRevokeKey = async (keyId: string) => {
    await supabase
      .from('tenant_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyId)
    setLocalApiKeys(localApiKeys.filter(k => k.id !== keyId))
  }

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const toggleStep = (step: number) => {
    setCompletedSteps(prev => {
      const next = new Set(prev)
      if (next.has(step)) next.delete(step)
      else next.add(step)
      return next
    })
  }

  const sortedIntegrations = [...ALL_INTEGRATIONS].sort((a, b) => {
    const aRec = dashboardConfig.suggested_integrations.some(
      s => s.toLowerCase().includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(s.toLowerCase())
    )
    const bRec = dashboardConfig.suggested_integrations.some(
      s => s.toLowerCase().includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(s.toLowerCase())
    )
    if (aRec && !bRec) return -1
    if (!aRec && bRec) return 1
    return 0
  })

  const displayName = user.email?.split('@')[0] || user.id.slice(0, 8)
  const orgName = dashboardConfig.workspace_name || tenant?.name || 'My Workspace'
  const orgSlug = tenant?.slug || '—'
  const stepsProgress = Math.round((completedSteps.size / dashboardConfig.onboarding_steps.length) * 100)

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Top navbar */}
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
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleSignOut}>
            退出
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Workspace header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{orgName}</CardTitle>
                <CardDescription className="mt-0.5">{dashboardConfig.tagline}</CardDescription>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  <code className="bg-muted px-1 py-0.5 rounded">{orgSlug}</code>
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">{dashboardConfig.primary_goal}</Badge>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview" className="text-xs">概览</TabsTrigger>
            <TabsTrigger value="setup" className="text-xs">配置</TabsTrigger>
            <TabsTrigger value="usage" className="text-xs">用量</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Welcome */}
            <Card className="bg-foreground text-background">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted mb-1">欢迎回来，{displayName}</p>
                <p className="text-sm leading-relaxed">{dashboardConfig.welcome_message}</p>
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">快捷操作</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {dashboardConfig.quick_actions.map((action) => (
                    <button
                      key={action.action}
                      className="text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <p className="text-xs font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{action.description}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Suggested Agents */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">推荐 Agent 配置</CardTitle>
                <CardDescription>根据你的目标，AI 为你推荐以下 Agent 团队组合。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboardConfig.suggested_agents.map((agent) => (
                  <div key={agent.name} className="flex items-start justify-between py-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium">{agent.name}</p>
                        <Badge
                          variant={agent.priority === 'high' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {agent.priority === 'high' ? '核心' : agent.priority === 'medium' ? '推荐' : '可选'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{agent.role} · {agent.description}</p>
                    </div>
                    <Button size="sm" className="ml-3 h-7 text-xs shrink-0">启用</Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Onboarding steps */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">上手步骤</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {completedSteps.size}/{dashboardConfig.onboarding_steps.length}
                  </span>
                </div>
                <Progress value={stepsProgress} className="h-1 mt-2" />
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboardConfig.onboarding_steps.map((step) => {
                  const done = completedSteps.has(step.step)
                  return (
                    <div
                      key={step.step}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        done ? 'opacity-50 bg-muted/30' : 'hover:bg-muted/30'
                      }`}
                      onClick={() => toggleStep(step.step)}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        done ? 'border-foreground bg-foreground' : 'border-muted-foreground'
                      }`}>
                        {done && <span className="text-background text-xs leading-none">✓</span>}
                      </div>
                      <div>
                        <p className={`text-xs font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>
                          {step.step}. {step.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Metrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">建议追踪的指标</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {dashboardConfig.metrics_to_track.map((metric) => (
                    <div key={metric.label} className="p-3 bg-muted/40 rounded-lg">
                      <p className="text-xs font-medium">{metric.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{metric.description}</p>
                      <p className="text-2xl font-semibold mt-2 text-muted-foreground">—</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SETUP ── */}
          <TabsContent value="setup" className="space-y-4 mt-4">
            {/* API Keys */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">API Keys</CardTitle>
                    <CardDescription>管理 MCP Server 的鉴权密钥。</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="密钥名称"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateApiKey()}
                      className="h-8 text-xs w-28"
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateApiKey}
                      disabled={creatingKey || !newKeyName.trim() || !tenant}
                      className="h-8 text-xs"
                    >
                      + 创建
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {localApiKeys.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">名称</TableHead>
                        <TableHead className="text-xs">密钥</TableHead>
                        <TableHead className="text-xs">创建时间</TableHead>
                        <TableHead className="text-xs text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {localApiKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell className="text-xs font-medium">{key.name}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {maskKey(key.key_prefix)}
                            </code>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(key.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRevokeKey(key.id)}
                            >
                              撤销
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-xs text-muted-foreground">暂无密钥，创建一个开始使用。</p>
                )}
              </CardContent>
            </Card>

            {/* Integrations */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">工具集成</CardTitle>
                <CardDescription>
                  推荐优先连接：
                  <span className="font-medium text-foreground ml-1">
                    {dashboardConfig.suggested_integrations.join('、')}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {sortedIntegrations.map((integration) => {
                  const isRec = dashboardConfig.suggested_integrations.some(
                    s => s.toLowerCase().includes(integration.name.toLowerCase()) ||
                         integration.name.toLowerCase().includes(s.toLowerCase())
                  )
                  return (
                    <div
                      key={integration.id}
                      className={`flex items-center justify-between py-2.5 transition-opacity ${!isRec ? 'opacity-40' : ''}`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium">{integration.name}</p>
                          {isRec && <Badge className="text-xs">推荐</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{integration.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">未连接</span>
                        <Button size="sm" className="h-7 text-xs">连接</Button>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Projects */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Agent 项目</CardTitle>
                <CardDescription>你的 Agent 团队项目。</CardDescription>
              </CardHeader>
              <CardContent>
                {projects.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">项目</TableHead>
                        <TableHead className="text-xs">状态</TableHead>
                        <TableHead className="text-xs">创建时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="text-xs font-medium">{project.name}</TableCell>
                          <TableCell>
                            <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                              {project.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(project.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-xs text-muted-foreground">暂无项目。Agent 团队上线后将在此显示。</p>
                )}
              </CardContent>
            </Card>

            {/* Team */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">团队成员</CardTitle>
                    <CardDescription>管理成员与邀请。</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs">邀请成员</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">成员</TableHead>
                      <TableHead className="text-xs">邮箱</TableHead>
                      <TableHead className="text-xs">角色</TableHead>
                      <TableHead className="text-xs">加入时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-xs font-medium">
                        {displayName} <span className="text-muted-foreground font-normal">(你)</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{user.email}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="secondary" className="text-xs">owner</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(user.created_at)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── USAGE ── */}
          <TabsContent value="usage" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">用量统计</CardTitle>
                <CardDescription>Agent 调用次数、工具使用情况等。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {dashboardConfig.metrics_to_track.map((metric) => (
                    <div key={metric.label} className="p-4 bg-muted/40 rounded-lg">
                      <p className="text-xs text-muted-foreground">{metric.label}</p>
                      <p className="text-2xl font-semibold mt-1 text-muted-foreground">—</p>
                      <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
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

      {/* API Key created modal */}
      <Dialog open={showKeyModal} onOpenChange={(open) => { if (!open) { setShowKeyModal(false); setCreatedKey(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">密钥已创建</DialogTitle>
            <DialogDescription>
              请立即复制并妥善保存，此密钥只显示一次。
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <code className="text-xs font-mono flex-1 break-all">{createdKey}</code>
            <Button variant="outline" size="sm" className="shrink-0 h-7 text-xs" onClick={handleCopy}>
              {copied ? '已复制' : '复制'}
            </Button>
          </div>
          <Button
            className="w-full"
            onClick={() => { setShowKeyModal(false); setCreatedKey(null) }}
          >
            我已保存，关闭
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
