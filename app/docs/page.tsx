'use client'

import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useState } from 'react'

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    content: [
      {
        step: '01',
        title: 'Get your API key',
        description: 'Sign up and copy your API key from the dashboard. One key works across all agents and tools.',
        code: `curl https://api.ainative.dev/v1/ping \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      },
      {
        step: '02',
        title: 'Run your first agent',
        description: 'Send a task to any agent with a single POST request. The agent runs asynchronously and returns a run ID.',
        code: `curl -X POST https://api.ainative.dev/v1/runs \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent": "support-agent",
    "task": "Summarise the last 10 support tickets",
    "tools": ["database-query", "email-sender"]
  }'`,
      },
      {
        step: '03',
        title: 'Poll for results',
        description: 'Check the run status and retrieve the output when complete. Webhook callbacks are also supported.',
        code: `curl https://api.ainative.dev/v1/runs/run_abc123 \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Response
{
  "id": "run_abc123",
  "status": "completed",
  "output": "Summarised 10 tickets: ...",
  "usage": { "tokens": 1240, "tools": 3 }
}`,
      },
    ],
  },
  {
    id: 'mcp',
    title: 'MCP Server',
    content: null,
    mcp: {
      description: 'Connect any MCP-compatible client (Claude Desktop, Cursor, Continue) to access all agents and tools directly.',
      config: `{
  "mcpServers": {
    "ainative": {
      "command": "npx",
      "args": ["-y", "@ainative/mcp-server"],
      "env": {
        "AINATIVE_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}`,
      tools: [
        { name: 'run_agent', description: 'Execute any agent with a task description' },
        { name: 'list_agents', description: 'List all available agents and their capabilities' },
        { name: 'get_run', description: 'Retrieve the output of a completed run' },
        { name: 'list_tools', description: 'List all tools available to agents' },
      ],
    },
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    content: null,
    webhook: {
      description: 'Receive real-time notifications when runs complete, fail, or require human approval.',
      code: `// Express.js example
app.post('/webhook', (req, res) => {
  const { event, run } = req.body

  if (event === 'run.completed') {
    console.log('Run output:', run.output)
  }

  if (event === 'run.approval_required') {
    // Human-in-the-loop: approve or reject
    await approveRun(run.id)
  }

  res.sendStatus(200)
})`,
    },
  },
]

export default function DocsPage() {
  const posthog = usePostHog()
  const [activeSection, setActiveSection] = useState('getting-started')

  useEffect(() => {
    posthog?.capture('page_view', { page: 'docs' })
  }, [posthog])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 pt-28 pb-16">
        <div className="flex gap-12">
          {/* Sidebar */}
          <aside className="hidden lg:block w-48 shrink-0">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Documentation
              </p>
              {SECTIONS.map((s) => (
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
            {/* Header */}
            <div className="mb-10">
              <Badge variant="secondary" className="font-mono text-xs mb-4">v1.0</Badge>
              <h1 className="text-4xl font-bold tracking-tight mb-3">Documentation</h1>
              <p className="text-muted-foreground leading-relaxed">
                Everything you need to deploy and manage AI agents in production.
              </p>
            </div>

            {/* Getting Started */}
            {activeSection === 'getting-started' && (
              <div className="space-y-10">
                <h2 className="text-2xl font-semibold">Getting Started</h2>
                {SECTIONS[0].content?.map((item) => (
                  <div key={item.step} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground">{item.step}</span>
                      <h3 className="text-base font-semibold">{item.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-8">
                      {item.description}
                    </p>
                    <pre className="ml-8 p-4 rounded-lg bg-muted border border-border text-xs font-mono overflow-x-auto leading-relaxed">
                      <code>{item.code}</code>
                    </pre>
                  </div>
                ))}
              </div>
            )}

            {/* MCP Server */}
            {activeSection === 'mcp' && SECTIONS[1].mcp && (
              <div className="space-y-8">
                <h2 className="text-2xl font-semibold">MCP Server</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {SECTIONS[1].mcp.description}
                </p>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                    Claude Desktop config (~/.claude/claude_desktop_config.json)
                  </p>
                  <pre className="p-4 rounded-lg bg-muted border border-border text-xs font-mono overflow-x-auto leading-relaxed">
                    <code>{SECTIONS[1].mcp.config}</code>
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                    Available tools
                  </p>
                  <div className="space-y-2">
                    {SECTIONS[1].mcp.tools.map((tool) => (
                      <div key={tool.name} className="flex items-start gap-4 p-3 rounded-lg border border-border">
                        <code className="text-xs font-mono text-foreground shrink-0">{tool.name}</code>
                        <span className="text-xs text-muted-foreground">{tool.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Webhooks */}
            {activeSection === 'webhooks' && SECTIONS[2].webhook && (
              <div className="space-y-8">
                <h2 className="text-2xl font-semibold">Webhooks</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {SECTIONS[2].webhook.description}
                </p>
                <pre className="p-4 rounded-lg bg-muted border border-border text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{SECTIONS[2].webhook.code}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </main>
      <CTASection />
      <Footer />
    </div>
  )
}
