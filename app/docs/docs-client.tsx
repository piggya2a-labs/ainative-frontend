'use client'
import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useState } from 'react'
import { SiteConfig } from '@/lib/sanity-schema'
import { DocsConfig } from './page'

type Section = NonNullable<NonNullable<SiteConfig['docs']>['sections']>[number]

export function DocsClient({ siteConfig }: { siteConfig: SiteConfig | null }) {
  const posthog = usePostHog()
  const docs = siteConfig?.docs as DocsConfig | undefined
  const sections: Section[] = docs?.sections ?? []

  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? 'getting-started')

  const version = docs?.version ?? ''
  const pageTitle = docs?.page_title ?? 'ONIT 文档'
  const pageDescription = docs?.page_description ?? ''

  const activeData = sections.find(s => s.id === activeSection)

  useEffect(() => {
    posthog?.capture('page_view', { page: 'docs' })
  }, [posthog])

  return (
    <main className="flex-1 max-w-6xl mx-auto px-4 pt-24 pb-16 w-full">
      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden md:block w-48 shrink-0">
          <div className="sticky top-24 space-y-1">
            {sections.map((s) => (
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

          {activeData && (
            <>
              {/* Getting Started — steps with code blocks */}
              {activeSection === 'getting-started' && (
                <div className="space-y-10">
                  <h2 className="text-2xl font-semibold">{activeData.title}</h2>
                  {(activeData.steps ?? []).map((item) => (
                    <div key={item.step} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground">{item.step}</span>
                        <h3 className="text-base font-semibold">{item.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed pl-8">{item.description}</p>
                      {item.code && (
                        <pre className="ml-8 p-4 rounded-lg bg-muted border border-border text-xs font-mono overflow-x-auto leading-relaxed">
                          <code>{item.code}</code>
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* MCP Server — config + tools list */}
              {activeSection === 'mcp' && (
                <div className="space-y-8">
                  <h2 className="text-2xl font-semibold">{activeData.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{activeData.description}</p>
                  {activeData.mcp_config && (
                    <pre className="p-4 rounded-lg bg-muted border border-border text-xs font-mono overflow-x-auto leading-relaxed">
                      <code>{activeData.mcp_config}</code>
                    </pre>
                  )}
                  {(activeData.tools ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">{activeData.tools_label ?? ''}</p>
                      <div className="space-y-2">
                        {(activeData.tools ?? []).map((tool) => (
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

              {/* Architecture — layers */}
              {activeSection === 'architecture' && (
                <div className="space-y-8">
                  <h2 className="text-2xl font-semibold">{activeData.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{activeData.description}</p>
                  <div className="space-y-3">
                    {(activeData.layers ?? []).map((layer) => (
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

              {/* Composio 授权 — rich tutorial UI */}
              {activeSection === 'composio' && (
                <div className="space-y-12">
                  {/* Header */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="font-mono text-xs">Composio</Badge>
                      <Badge variant="outline" className="font-mono text-xs">MCP OAuth 2.1</Badge>
                    </div>
                    <h2 className="text-2xl font-semibold">{activeData.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{activeData.description}</p>
                  </div>

                  {/* 流程步骤 */}
                  {(activeData.steps ?? []).length > 0 && (
                    <div className="space-y-8">
                      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        授权流程 · {activeData.steps!.length} 步完成
                      </p>
                      {activeData.steps!.map((item, i) => (
                        <div key={item.step} className="relative">
                          {i < activeData.steps!.length - 1 && (
                            <div className="absolute left-[19px] top-10 bottom-[-24px] w-px bg-border" />
                          )}
                          <div className="flex gap-5">
                            <div className="shrink-0 w-10 h-10 rounded-full border-2 border-foreground bg-background flex items-center justify-center">
                              <span className="text-xs font-mono font-bold">{item.step}</span>
                            </div>
                            <div className="flex-1 pb-8 space-y-2">
                              <h3 className="text-base font-semibold leading-tight">{item.title}</h3>
                              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                              {item.code && (
                                <pre className="mt-3 p-3 rounded-lg bg-muted border border-border text-xs font-mono overflow-x-auto leading-relaxed">
                                  <code>{item.code}</code>
                                </pre>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 支持的工具 */}
                  {(activeData.tools ?? []).length > 0 && (
                    <div className="space-y-4">
                      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        {activeData.tools_label ?? '支持的工具'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(activeData.tools ?? []).map((tool) => (
                          <div key={tool.name} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                            <code className="text-xs font-mono font-semibold shrink-0 w-28">{tool.name}</code>
                            <span className="text-xs text-muted-foreground leading-relaxed">{tool.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="p-6 rounded-xl border border-border bg-muted/30 flex items-center justify-between gap-4">
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
            </>
          )}
        </div>
      </div>
    </main>
  )
}
