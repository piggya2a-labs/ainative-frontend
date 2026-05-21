import { createClient } from '@supabase/supabase-js'
import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { getSiteConfig } from '@/lib/queries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ExternalLink, Zap, ArrowLeft } from 'lucide-react'

export const revalidate = 3600

type Props = { params: Promise<{ id: string }> }

interface AgentSkill {
  id: string
  name?: string
  description?: string
  tags?: string[]
}

interface AgentRow {
  id: string
  name: string
  description?: string | null
  provider?: string | { name?: string } | null
  skills?: AgentSkill[] | null
  mcp_url?: string | null
  icon_url?: string | null
  documentation_url?: string | null
  connector_type?: string | null
  tags?: string[] | null
  updated_at?: string | null
}

function providerLabel(provider: string | { name?: string } | null | undefined): string | null {
  if (!provider) return null
  if (typeof provider === 'string') return provider
  if (typeof provider === 'object') return provider.name ?? null
  return null
}

async function getAgent(id: string): Promise<AgentRow | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data, error } = await supabase
      .from('agent_registry')
      .select('id, name, description, provider, skills, mcp_url, icon_url, documentation_url, connector_type, tags, updated_at')
      .eq('id', id)
      .eq('enabled', true)
      .single()
    if (error || !data) return null
    return data as AgentRow
  } catch {
    return null
  }
}

async function getAllAgentIds(): Promise<string[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('agent_registry')
      .select('id')
      .eq('enabled', true)
    return (data ?? []).map((r: { id: string }) => r.id)
  } catch {
    return []
  }
}

export async function generateStaticParams() {
  const ids = await getAllAgentIds()
  return ids.map((id) => ({ id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const agent = await getAgent(id)
  if (!agent) return {}
  const name = agent.name
  const desc = agent.description ?? `Connect ${name} as an A2A Agent in your ONIT team.`
  const skillCount = Array.isArray(agent.skills) ? agent.skills.length : 0
  return {
    title: `${name} MCP Agent for AI Teams | ONIT`,
    description: `${desc} ${skillCount > 0 ? `${skillCount} tools available.` : ''} Connect via MCP or A2A protocol.`,
    openGraph: {
      title: `${name} | ONIT Agent Platform`,
      description: desc,
      type: 'website',
    },
  }
}

function connectorBadge(type: string | null | undefined) {
  const map: Record<string, string> = {
    mcp: 'MCP',
    a2a: 'A2A',
    openapi: 'OpenAPI',
    native: 'Native',
    browser: 'Browser',
    cli: 'CLI',
    webhook: 'Webhook',
  }
  return map[type ?? ''] ?? (type ?? 'Custom')
}

export default async function AgentDetailPage({ params }: Props) {
  const { id } = await params
  const [agent, siteConfig] = await Promise.all([
    getAgent(id),
    getSiteConfig(),
  ])
  if (!agent) notFound()

  const skills: AgentSkill[] = Array.isArray(agent.skills) ? agent.skills : []
  const tags: string[] = Array.isArray(agent.tags) ? agent.tags : []

  // JSON-LD structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: agent.name,
    description: agent.description ?? '',
    applicationCategory: 'AI Agent',
    operatingSystem: 'Web',
    url: `https://ainative-frontend.vercel.app/marketplace/${agent.id}`,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar siteConfig={siteConfig} />
      <main className="max-w-3xl mx-auto px-4 pt-28 pb-16">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
          >
            <ArrowLeft className="w-3 h-3" />
            Agent Market
          </Link>
        </div>

        {/* Hero */}
        <div className="flex items-start gap-4 mb-8">
          {agent.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agent.icon_url}
              alt={agent.name}
              className="w-14 h-14 rounded-xl object-cover border border-border shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-muted-foreground">
                {agent.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
              <Badge variant="outline" className="text-[10px] font-mono">
                {connectorBadge(agent.connector_type)}
              </Badge>
            </div>
            {providerLabel(agent.provider) && (
              <p className="text-xs text-muted-foreground font-mono mb-2">{providerLabel(agent.provider)}</p>
            )}
            {agent.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{agent.description}</p>
            )}
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-8">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-10">
          <Link href="/dashboard">
            <Button size="sm" className="gap-2">
              <Zap className="w-3.5 h-3.5" />
              在 Dashboard 接入
            </Button>
          </Link>
          {agent.documentation_url && (
            <a href={agent.documentation_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="w-3.5 h-3.5" />
                文档
              </Button>
            </a>
          )}
          {agent.mcp_url && (
            <a href={agent.mcp_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2 font-mono text-[10px]">
                MCP URL
              </Button>
            </a>
          )}
        </div>

        {/* Skills / Tools */}
        {skills.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
              工具清单 · {skills.length} tools
            </h2>
            <div className="border border-border rounded-lg divide-y divide-border">
              {skills.map((skill) => (
                <div key={skill.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium font-mono truncate">{skill.name ?? skill.id}</p>
                      {skill.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {skill.description}
                        </p>
                      )}
                    </div>
                    {skill.tags && skill.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 shrink-0">
                        {skill.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[9px] h-4 px-1">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* How to connect */}
        <section className="mb-10">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            接入方式
          </h2>
          <div className="border border-border rounded-lg p-4 space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              在 ONIT Dashboard 中点击「连接」，{agent.name} 将自动加入你的 Agent 团队。
              连接后可通过 ONIT MCP URL 在 Claude Desktop、Cursor 等 AI 客户端中直接调用。
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-mono text-muted-foreground">
              <span className="bg-muted px-2 py-1 rounded">MCP 原生</span>
              <span className="bg-muted px-2 py-1 rounded">A2A 兼容</span>
              <span className="bg-muted px-2 py-1 rounded">Claude Desktop</span>
              <span className="bg-muted px-2 py-1 rounded">Cursor</span>
              <span className="bg-muted px-2 py-1 rounded">ChatGPT</span>
            </div>
          </div>
        </section>

        {/* Back link */}
        <div className="border-t border-border pt-6">
          <Link
            href="/marketplace"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3 h-3" />
            查看全部 Agent
          </Link>
        </div>
      </main>
      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
    </div>
  )
}
