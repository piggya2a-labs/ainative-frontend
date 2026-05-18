'use client'
import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useState } from 'react'
import { getSiteConfig } from '@/lib/queries'
import { SiteConfig } from '@/lib/sanity-schema'

// docs 页面从 siteConfig.docs 读取所有内容
type DocsConfig = {
  version?: string
  page_title?: string
  page_description?: string
  mcp_server_url?: string
  supabase_rest_url?: string
  sections?: Array<{
    id: string
    title: string
    steps?: Array<{ step: string; title: string; description: string; code?: string; code_comment?: string }>
    description?: string
    tools?: Array<{ name: string; description: string }>
    tools_label?: string
    layers?: Array<{ name: string; prefix: string; role: string }>
    mcp_config?: string
  }>
}

// 客户端组件，接收 siteConfig 作为 prop
function DocsClient({ siteConfig }: { siteConfig: SiteConfig | null }) {
  const posthog = usePostHog()
  const docs = siteConfig?.docs as DocsConfig | undefined
  const sections = docs?.sections ?? []
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? 'getting-started')

  const version = docs?.version ?? ''
  const pageTitle = docs?.page_title ?? ''
  const pageDescription = docs?.page_description ?? ''

  const gettingStarted = sections.find(s => s.id === 'getting-started')
  const mcpSection = sections.find(s => s.id === 'mcp')
  const archSection = sections.find(s => s.id === 'architecture')

  useEffect(() => {
    posthog?.capture('page_view', { page: 'docs' })
  }, [posthog])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar siteConfig={siteConfig} />
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
            {/* Getting Started */}
            {activeSection === 'getting-started' && gettingStarted && (
              <div className="space-y-10">
                <h2 className="text-2xl font-semibold">{gettingStarted.title}</h2>
                {(gettingStarted.steps ?? []).map((item, idx) => (
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
                    <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">{mcpSection.tools_label ?? '可用工具'}</p>
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
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">前缀: {layer.prefix}</div>
                      </div>
                      <span className="text-xs text-muted-foreground leading-relaxed">{layer.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
    </div>
  )
}

// docs/page.tsx 是 'use client'，需要在客户端 fetch siteConfig
// 改为在 useEffect 中加载
export default function DocsPage() {
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null)

  useEffect(() => {
    getSiteConfig().then(setSiteConfig)
  }, [])

  return <DocsClient siteConfig={siteConfig} />
}
