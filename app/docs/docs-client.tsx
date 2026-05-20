'use client'
import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useState } from 'react'
import { SiteConfig } from '@/lib/sanity-schema'
import { DocsConfig } from './page'

const COMPOSIO_STEPS = [
  {
    step: '01',
    title: '打开 Dashboard，找到 Composio 那行',
    description: '登录 ONIT 之后，在 Dashboard 顶部可以看到 Telegram 和 Composio 并排的两行。点击 Composio 那行右侧的「连接 →」按钮。',
    note: 'ONIT 不会存储你的任何 API Key，所有工具授权全部由 Composio 托管。',
  },
  {
    step: '02',
    title: '选择你的 Composio 组织',
    description: '点击「连接 →」后，浏览器会跳转到 Composio 的授权页面，显示你的组织列表（例如 piggya2aforu_workspace）。选择你要授权的组织，点击「Continue」。',
    note: '如果你还没有 Composio 账号，可以在这一步免费注册。',
  },
  {
    step: '03',
    title: '授权 ONIT 访问你的 Composio 账号',
    description: 'Composio 会显示授权确认页：「Give access to your Composio account — This will allow the application to use Composio tools on your behalf.」点击「Authorize」完成授权。',
    note: '这和你在 Claude Desktop、ChatGPT 里连接 Composio 是完全一样的体验。',
  },
  {
    step: '04',
    title: '自动飞回 ONIT，所有工具立即可用',
    description: '授权完成后，页面自动跳回 ONIT Dashboard，Composio 那行显示「已连接 ✓」。你在 Composio 里已经授权的所有工具（GitHub、Gmail、Slack、Notion 等）现在都可以被 ONIT 的 Agent 直接调用。',
    note: '授权是永久有效的，以后 ONIT 上线新的 Agent，只要你的 Composio 账号里有对应工具，Agent 会自动继承，无需重新授权。',
  },
]

const COMPOSIO_FAQ = [
  {
    q: 'ONIT 会存储我的 API Key 吗？',
    a: '不会。ONIT 只存储 Composio 颁发的 OAuth access token，你的 GitHub Token、Gmail 密码等敏感凭证全部由 Composio 托管，ONIT 无法访问。',
  },
  {
    q: '我在 Composio 里连了哪些工具，Agent 都能用吗？',
    a: '是的。只要你的 Composio 账号里有 ACTIVE 状态的连接（GitHub、Resend、Vapi、E2B 等），ONIT 的 Agent 都可以按需调用。Agent 会在需要某个工具时自动使用，不需要你手动配置。',
  },
  {
    q: '如果我想断开授权怎么办？',
    a: '你可以随时在 Composio Dashboard（platform.composio.dev）里撤销对 ONIT 的授权。撤销后，ONIT 的 Agent 将无法再调用你的工具。',
  },
  {
    q: '为什么 ONIT 选择 Composio 而不是自己管理工具授权？',
    a: 'Composio 是目前最成熟的 Agent 工具授权平台，支持 250+ 工具的 OAuth 托管。ONIT 专注于 Agent 的雇佣和调度，把工具授权外包给专业的 Composio，让整个系统更安全、更可靠。',
  },
]

export function DocsClient({ siteConfig }: { siteConfig: SiteConfig | null }) {
  const posthog = usePostHog()
  const docs = siteConfig?.docs as DocsConfig | undefined
  const sections = docs?.sections ?? []

  // 固定侧边栏：Sanity 的 sections + 我们硬编码的 composio section
  const allSidebarItems = [
    ...sections.map(s => ({ id: s.id, title: s.title })),
    { id: 'composio', title: 'Composio 授权' },
  ]

  const [activeSection, setActiveSection] = useState(allSidebarItems[0]?.id ?? 'getting-started')

  const version = docs?.version ?? ''
  const pageTitle = docs?.page_title ?? 'ONIT 文档'
  const pageDescription = docs?.page_description ?? ''

  const gettingStarted = sections.find(s => s.id === 'getting-started')
  const mcpSection = sections.find(s => s.id === 'mcp')
  const archSection = sections.find(s => s.id === 'architecture')

  useEffect(() => {
    posthog?.capture('page_view', { page: 'docs' })
  }, [posthog])

  return (
    <main className="flex-1 max-w-6xl mx-auto px-4 pt-24 pb-16 w-full">
      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden md:block w-48 shrink-0">
          <div className="sticky top-24 space-y-1">
            {allSidebarItems.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSection(s.id)
                  posthog?.capture('docs_section_click', { section: s.id })
                }}
                className={`block w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  activeSection === s.id
                    ? 'bg-foreground text-background font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="mb-10">
            {version && <Badge variant="secondary" className="font-mono text-xs mb-4">{version}</Badge>}
            <h1 className="text-4xl font-bold tracking-tight mb-3">{pageTitle}</h1>
            <p className="text-muted-foreground leading-relaxed">{pageDescription}</p>
          </div>

          {/* Getting Started */}
          {activeSection === 'getting-started' && gettingStarted && (
            <div className="space-y-10">
              <h2 className="text-2xl font-semibold">{gettingStarted.title}</h2>
              {(gettingStarted.steps ?? []).map((item) => (
                <div key={item.step} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">{item.step}</span>
                    <h3 className="text-base font-semibold">{item.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed pl-8">{item.description}</p>
                  <pre className="ml-8 p-4 rounded-lg bg-muted border border-border text-xs font-mono overflow-x-auto leading-relaxed">
                    <code>{item.code ?? ''}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* MCP Server */}
          {activeSection === 'mcp' && mcpSection && (
            <div className="space-y-8">
              <h2 className="text-2xl font-semibold">{mcpSection.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{mcpSection.description}</p>
              <div>
                <pre className="p-4 rounded-lg bg-muted border border-border text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{mcpSection.mcp_config ?? ''}</code>
                </pre>
              </div>
              {(mcpSection.tools ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">{mcpSection.tools_label ?? ''}</p>
                  <div className="space-y-2">
                    {(mcpSection.tools ?? []).map((tool) => (
                      <div key={tool.name} className="flex items-start gap-4 p-3 rounded-lg border border-border">
                        <code className="text-xs font-mono text-foreground shrink-0">{tool.name}</code>
                        <span className="text-xs text-muted-foreground">{tool.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Architecture */}
          {activeSection === 'architecture' && archSection && (
            <div className="space-y-8">
              <h2 className="text-2xl font-semibold">{archSection.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{archSection.description}</p>
              <div className="space-y-3">
                {(archSection.layers ?? []).map((layer) => (
                  <div key={layer.name} className="flex items-start gap-4 p-4 rounded-lg border border-border">
                    <div className="shrink-0">
                      <code className="text-xs font-mono text-foreground font-semibold">{layer.name}</code>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{layer.prefix}</div>
                    </div>
                    <span className="text-xs text-muted-foreground leading-relaxed">{layer.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Composio 授权 */}
          {activeSection === 'composio' && (
            <div className="space-y-12">
              {/* Header */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="font-mono text-xs">Composio</Badge>
                  <Badge variant="outline" className="font-mono text-xs">MCP OAuth 2.1</Badge>
                </div>
                <h2 className="text-2xl font-semibold">连接 Composio，解锁 250+ 工具</h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  ONIT 通过 Composio 托管所有工具授权。你只需要授权一次 Composio 账号，
                  ONIT 的 Agent 就能按需调用你已连接的所有工具——GitHub、Gmail、Slack、Notion、Linear……
                  整个过程和在 Claude Desktop 或 ChatGPT 里连接 Composio 完全一样。
                </p>
              </div>

              {/* 流程步骤 */}
              <div className="space-y-8">
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">授权流程 · 4 步完成</p>
                {COMPOSIO_STEPS.map((item, i) => (
                  <div key={item.step} className="relative">
                    {/* 连接线 */}
                    {i < COMPOSIO_STEPS.length - 1 && (
                      <div className="absolute left-[19px] top-10 bottom-[-24px] w-px bg-border" />
                    )}
                    <div className="flex gap-5">
                      {/* 步骤圆圈 */}
                      <div className="shrink-0 w-10 h-10 rounded-full border-2 border-foreground bg-background flex items-center justify-center">
                        <span className="text-xs font-mono font-bold">{item.step}</span>
                      </div>
                      <div className="flex-1 pb-8 space-y-2">
                        <h3 className="text-base font-semibold leading-tight">{item.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                        <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-muted border border-border">
                          <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5">NOTE</span>
                          <span className="text-xs text-muted-foreground leading-relaxed">{item.note}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 架构说明 */}
              <div className="space-y-4">
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">工具授权架构</p>
                <div className="space-y-2">
                  {[
                    { label: 'ONIT', role: 'Agent 雇主平台，负责 Agent 的调度和任务管理，不存储任何工具 Key' },
                    { label: 'Composio', role: '工具授权托管层，管理 250+ 工具的 OAuth 连接，ONIT 通过 MCP 协议调用' },
                    { label: 'Agent', role: '执行层，按需通过 Composio MCP 调用用户已授权的工具完成任务' },
                    { label: 'User', role: '只需授权一次 Composio 账号，之后所有 Agent 自动继承工具访问权限' },
                  ].map(row => (
                    <div key={row.label} className="flex items-start gap-4 p-4 rounded-lg border border-border">
                      <code className="text-xs font-mono font-semibold shrink-0 w-20">{row.label}</code>
                      <span className="text-xs text-muted-foreground leading-relaxed">{row.role}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQ */}
              <div className="space-y-4">
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">常见问题</p>
                <div className="space-y-3">
                  {COMPOSIO_FAQ.map((faq, i) => (
                    <div key={i} className="p-4 rounded-lg border border-border space-y-2">
                      <p className="text-sm font-medium">{faq.q}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="p-6 rounded-xl border border-border bg-muted/30 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">准备好了吗？</p>
                  <p className="text-xs text-muted-foreground">登录 ONIT，在 Dashboard 点「连接 →」，30 秒完成授权。</p>
                </div>
                <a
                  href="/dashboard"
                  className="shrink-0 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  去 Dashboard →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
