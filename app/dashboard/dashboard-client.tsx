'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'

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
}

interface Props {
  user: User
  tenant: Tenant | null
  apiKeys: ApiKey[]
  projects: Project[]
}

// 工具集成列表（对应 Gentic.co 的 Integrations section）
const INTEGRATIONS = [
  { id: 'github', name: 'GitHub', desc: '代码仓库与 CI/CD 自动化', icon: '⬡' },
  { id: 'slack', name: 'Slack', desc: '团队沟通与通知推送', icon: '#' },
  { id: 'supabase', name: 'Supabase', desc: '数据库与实时数据访问', icon: '⚡' },
  { id: 'posthog', name: 'PostHog', desc: '产品分析与用户行为追踪', icon: '◎' },
  { id: 'sanity', name: 'Sanity', desc: '内容管理与知识库', icon: '✦' },
  { id: 'vercel', name: 'Vercel', desc: '部署与边缘函数', icon: '▲' },
  { id: 'langgraph', name: 'LangGraph', desc: 'Agent 编排与状态机', icon: '⬡' },
  { id: 'trigger', name: 'Trigger.dev', desc: '后台任务与定时自动化', icon: '⚙' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'numeric', day: 'numeric'
  })
}

function maskKey(prefix: string) {
  return `${prefix}${'•'.repeat(20)}`
}

export function DashboardClient({ user, tenant, apiKeys, projects }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'setup' | 'usage'>('setup')
  const [creatingKey, setCreatingKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [localApiKeys, setLocalApiKeys] = useState<ApiKey[]>(apiKeys)
  const [copied, setCopied] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleCreateApiKey = async () => {
    if (!tenant || !newKeyName.trim()) return
    setCreatingKey(true)

    // 生成 API Key
    const rawKey = 'onit_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    const prefix = rawKey.slice(0, 12)

    // 存储 hash（简单用 prefix 演示，生产应用 SHA-256）
    const { data, error } = await supabase
      .from('tenant_api_keys')
      .insert({
        tenant_id: tenant.id,
        name: newKeyName.trim(),
        key_hash: rawKey, // 生产环境应存 hash
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

  const displayName = user.email?.split('@')[0] || user.id.slice(0, 8)
  const orgName = tenant?.name || 'My Workspace'
  const orgSlug = tenant?.slug || '—'

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Top navbar */}
      <header className="bg-white border-b border-gray-200 px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded bg-black flex items-center justify-center">
              <span className="text-white text-xs font-bold">O</span>
            </div>
          </Link>
          <span className="text-gray-300 text-sm">/</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{orgName}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">{user.email}</span>
          <Link href="/docs" className="text-xs text-gray-500 hover:text-gray-800 transition-colors">
            文档
          </Link>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            退出
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Org header card */}
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-semibold">{orgName}</span>
          </div>
          <p className="text-xs text-gray-400 font-mono">Slug: <code className="bg-gray-100 px-1 py-0.5 rounded">{orgSlug}</code></p>

          {/* Tabs */}
          <div className="flex gap-0 mt-4 border-b border-gray-200">
            <button
              onClick={() => setTab('setup')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === 'setup'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              配置
            </button>
            <button
              onClick={() => setTab('usage')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === 'usage'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              用量
            </button>
          </div>
        </div>

        {tab === 'setup' && (
          <>
            {/* API Keys */}
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <span>🔑</span> API Keys
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">管理 MCP Server 的鉴权密钥。</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="密钥名称"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateApiKey()}
                    className="text-xs px-2 py-1.5 border border-gray-200 rounded-md w-28 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <button
                    onClick={handleCreateApiKey}
                    disabled={creatingKey || !newKeyName.trim() || !tenant}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-black rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
                  >
                    + 创建
                  </button>
                </div>
              </div>

              {localApiKeys.length > 0 ? (
                <table className="w-full mt-3 text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left py-2 font-normal">名称</th>
                      <th className="text-left py-2 font-normal">密钥</th>
                      <th className="text-left py-2 font-normal">创建时间</th>
                      <th className="text-right py-2 font-normal"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {localApiKeys.map((key) => (
                      <tr key={key.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 font-medium">{key.name}</td>
                        <td className="py-2 font-mono text-gray-500">
                          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                            {maskKey(key.key_prefix)}
                          </code>
                        </td>
                        <td className="py-2 text-gray-400">{formatDate(key.created_at)}</td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => handleRevokeKey(key.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors text-xs"
                          >
                            撤销
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-gray-400 mt-3">暂无密钥，创建一个开始使用。</p>
              )}
            </div>

            {/* Integrations */}
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                <span>⚡</span> 工具集成
              </h2>
              <p className="text-xs text-gray-400 mb-3">连接第三方服务，供 Agent 团队调用。</p>
              <div className="space-y-1">
                {INTEGRATIONS.map((integration) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm w-5 text-center text-gray-400">{integration.icon}</span>
                      <div>
                        <p className="text-xs font-medium">{integration.name}</p>
                        <p className="text-xs text-gray-400">{integration.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">未连接</span>
                      <button className="px-3 py-1 text-xs font-medium text-white bg-black rounded-md hover:bg-gray-800 transition-colors">
                        连接
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Projects */}
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <span>◈</span> Agent 项目
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">你的 Agent 团队项目。</p>
                </div>
              </div>
              {projects.length > 0 ? (
                <table className="w-full mt-3 text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left py-2 font-normal">项目</th>
                      <th className="text-left py-2 font-normal">状态</th>
                      <th className="text-left py-2 font-normal">创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr key={project.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 font-medium">{project.name}</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            project.status === 'active'
                              ? 'bg-green-50 text-green-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {project.status}
                          </span>
                        </td>
                        <td className="py-2 text-gray-400">{formatDate(project.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-gray-400 mt-3">暂无项目。Agent 团队上线后将在此显示。</p>
              )}
            </div>

            {/* Team */}
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <span>👥</span> 团队成员
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">管理成员与邀请。</p>
                </div>
                <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                  邀请成员
                </button>
              </div>
              <table className="w-full mt-3 text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left py-2 font-normal">成员</th>
                    <th className="text-left py-2 font-normal">邮箱</th>
                    <th className="text-left py-2 font-normal">角色</th>
                    <th className="text-left py-2 font-normal">加入时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 font-medium">{displayName} <span className="text-gray-400 font-normal">(你)</span></td>
                    <td className="py-2 text-gray-500">{user.email}</td>
                    <td className="py-2 text-gray-500">owner</td>
                    <td className="py-2 text-gray-400">{formatDate(user.created_at)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'usage' && (
          <>
            {/* Agent 活动 */}
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                <span>📊</span> Agent 活动
              </h2>
              <p className="text-xs text-gray-400 mb-4">Agent 团队的执行记录与用量统计。</p>

              {/* 统计卡片 */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: '本月执行次数', value: '—' },
                  { label: '活跃 Agent', value: '—' },
                  { label: '工具调用次数', value: '—' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gray-50 rounded-md px-3 py-3 text-center">
                    <p className="text-lg font-semibold">{stat.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* 活动记录表 */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left py-2 font-normal">活动</th>
                    <th className="text-left py-2 font-normal">Agent</th>
                    <th className="text-left py-2 font-normal">状态</th>
                    <th className="text-left py-2 font-normal">时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-400">
                      暂无活动记录。Agent 团队上线后将在此显示执行历史。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* API Key 创建成功弹窗 */}
      {showKeyModal && createdKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-md w-full">
            <h3 className="text-sm font-semibold mb-1">API Key 已创建</h3>
            <p className="text-xs text-gray-500 mb-3">
              请立即复制并保存，此后将无法再次查看完整密钥。
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 mb-3 flex items-center justify-between gap-2">
              <code className="text-xs font-mono text-gray-700 break-all">{createdKey}</code>
              <button
                onClick={handleCopy}
                className="shrink-0 text-xs px-2 py-1 bg-black text-white rounded hover:bg-gray-800 transition-colors"
              >
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <button
              onClick={() => { setShowKeyModal(false); setCreatedKey(null) }}
              className="w-full py-2 text-xs font-medium border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              我已保存，关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
