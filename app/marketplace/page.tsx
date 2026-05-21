import { createClient } from '@supabase/supabase-js'
import { getSiteConfig } from '@/lib/queries'
import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { MarketplaceClient } from './marketplace-client'
import type { MarketplaceAgentItem } from '@/lib/database.types'
import type { Metadata } from 'next'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'AI Agent Marketplace — MCP & A2A Agents | ONIT',
  description: 'Browse 40+ pre-built AI agents with MCP and A2A support. Connect GitHub, Slack, Notion, Supabase and more to your AI team in one click.',
  openGraph: {
    title: 'AI Agent Marketplace | ONIT',
    description: 'Browse 40+ pre-built AI agents. MCP & A2A native. Connect to Claude, ChatGPT, Cursor in minutes.',
    type: 'website',
  },
}

async function getMarketplaceAgents(): Promise<MarketplaceAgentItem[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data, error } = await supabase
      .from('agent_registry')
      .select('id, name, description, provider, skills, mcp_url, tags, updated_at, icon_url, documentation_url, connector_type, oauth_config')
      .is('langsmith_handle', null)
      .eq('enabled', true)
      .order('updated_at', { ascending: false })
    if (error) return []
    return (data ?? []) as MarketplaceAgentItem[]
  } catch {
    return []
  }
}

export default async function MarketplacePage() {
  const [agents, siteConfig] = await Promise.all([
    getMarketplaceAgents(),
    getSiteConfig(),
  ])

  const p = siteConfig?.pages?.marketplace
  const eyebrow = p?.eyebrow || 'AGENT MARKET'
  const headingTemplate = p?.heading || '{count} 个外部 Agent，随时可接入'
  const description = p?.description || '把任意 API 或 MCP 翻译成标准 A2A Agent，加入你的团队。点开任意 Agent 查看它的工具清单。'
  const groupLabel = p?.group_label || '外部 Agent'
  const emptyState = p?.empty_state || '还没有外部 Agent。添加第一个开始组建团队。'
  const addButton = p?.add_button || '添加 Agent'
  const heading = headingTemplate.replace('{count}', String(agents.length))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar siteConfig={siteConfig} />
      <main className="max-w-4xl mx-auto px-4 pt-28 pb-16">
        {/* Header — 对齐 /agents 风格 */}
        <div className="mb-10 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground mb-4">
            {eyebrow}
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            {heading}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* 客户端交互部分：搜索、Connect/Disconnect、添加 */}
        <MarketplaceClient
          initialAgents={agents}
          groupLabel={groupLabel}
          emptyState={emptyState}
          addButton={addButton}
        />
      </main>
      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
    </div>
  )
}
