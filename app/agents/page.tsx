'use client'

import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'

const AGENTS = [
  {
    name: 'Support Agent',
    description: 'Handles inbound tickets, classifies intent, drafts replies, and escalates when needed. Integrates with Zendesk, Intercom, and email.',
    status: 'Active',
    category: 'Support',
    stats: '10,000+ tickets/month',
  },
  {
    name: 'Research Agent',
    description: 'Searches the web, reads documents, summarises findings, and delivers structured briefs. Runs in parallel across multiple sources.',
    status: 'Active',
    category: 'Research',
    stats: '50+ sources per run',
  },
  {
    name: 'Ops Agent',
    description: 'Automates repetitive workflows — CRM updates, data sync, report generation, and scheduled tasks. Connects to your existing tools via API.',
    status: 'Active',
    category: 'Operations',
    stats: '24/7 execution',
  },
  {
    name: 'Monitor Agent',
    description: 'Watches websites, APIs, and data feeds for changes. Triggers alerts or downstream actions when conditions are met.',
    status: 'Active',
    category: 'Monitoring',
    stats: 'Real-time detection',
  },
  {
    name: 'Code Agent',
    description: 'Reviews pull requests, runs tests, fixes lint errors, and suggests improvements. Works directly with your GitHub repository.',
    status: 'Beta',
    category: 'Dev',
    stats: 'GitHub native',
  },
  {
    name: 'Analytics Agent',
    description: 'Queries your data warehouse, builds dashboards, and surfaces anomalies. Speaks SQL and natural language equally well.',
    status: 'Beta',
    category: 'Analytics',
    stats: 'SQL + NL queries',
  },
  {
    name: 'Outreach Agent',
    description: 'Personalises and sends emails at scale. Tracks opens, replies, and follow-ups. Human-in-the-loop approval before sending.',
    status: 'Active',
    category: 'Comms',
    stats: '34% reply rate avg',
  },
  {
    name: 'Content Agent',
    description: 'Drafts blog posts, social updates, and product copy from a brief. Maintains brand voice using your style guide.',
    status: 'Soon',
    category: 'Creative',
    stats: 'Brand-aware',
  },
]

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.55_0.15_145)] border-[oklch(0.65_0.15_145)]/20',
  Beta: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Soon: 'bg-muted text-muted-foreground border-border',
}

export default function AgentsPage() {
  const posthog = usePostHog()

  useEffect(() => {
    posthog?.capture('page_view', { page: 'agents' })
  }, [posthog])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground mb-4">
            Agent Catalogue
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Your AI workforce
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Pre-built agents ready to deploy in minutes. Each one is purpose-built, tool-equipped, and designed to run autonomously.
          </p>
        </div>

        {/* Agent grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map((agent) => (
            <Card
              key={agent.name}
              className="border border-border hover:border-foreground/20 transition-colors cursor-pointer group"
              onClick={() => posthog?.capture('agent_card_click', { agent: agent.name })}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold">{agent.name}</CardTitle>
                  <Badge
                    variant="outline"
                    className={`text-xs shrink-0 ${STATUS_COLORS[agent.status] ?? ''}`}
                  >
                    {agent.status}
                  </Badge>
                </div>
                <Badge variant="secondary" className="w-fit text-xs mt-1">
                  {agent.category}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {agent.description}
                </p>
                <p className="text-xs font-mono text-foreground/60">
                  {agent.stats}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <CTASection />
      <Footer />
    </div>
  )
}
