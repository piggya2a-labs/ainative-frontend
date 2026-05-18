'use client'

import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'
import { AgentTool } from '@/lib/sanity-schema'

interface ToolsGridProps {
  tools?: AgentTool[]
}

const defaultTools = [
  { _id: '1', name: 'Web Search', category: 'Research', status: 'active' as const, description: 'Search and extract from the web' },
  { _id: '2', name: 'Code Executor', category: 'Dev', status: 'active' as const, description: 'Run and test code in sandboxed env' },
  { _id: '3', name: 'Email Sender', category: 'Comms', status: 'active' as const, description: 'Draft and send emails autonomously' },
  { _id: '4', name: 'Data Analyzer', category: 'Analytics', status: 'active' as const, description: 'Process and visualize structured data' },
  { _id: '5', name: 'Image Generator', category: 'Creative', status: 'beta' as const, description: 'Generate images from text prompts' },
  { _id: '6', name: 'Calendar Manager', category: 'Productivity', status: 'active' as const, description: 'Schedule and manage events' },
  { _id: '7', name: 'Database Query', category: 'Dev', status: 'active' as const, description: 'Query SQL and NoSQL databases' },
  { _id: '8', name: 'Browser Control', category: 'Automation', status: 'active' as const, description: 'Navigate and interact with websites' },
  { _id: '9', name: 'Voice Transcription', category: 'Media', status: 'beta' as const, description: 'Convert speech to structured text' },
  { _id: '10', name: 'PDF Processor', category: 'Documents', status: 'active' as const, description: 'Extract and analyze PDF content' },
  { _id: '11', name: 'Social Publisher', category: 'Comms', status: 'coming_soon' as const, description: 'Post across social platforms' },
  { _id: '12', name: 'Market Data', category: 'Finance', status: 'coming_soon' as const, description: 'Real-time financial data access' },
]

const statusConfig = {
  active: { label: 'Active', variant: 'default' as const },
  beta: { label: 'Beta', variant: 'secondary' as const },
  coming_soon: { label: 'Soon', variant: 'outline' as const },
}

export function ToolsGrid({ tools }: ToolsGridProps) {
  const posthog = usePostHog()
  const displayTools = tools && tools.length > 0 ? tools : defaultTools

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            100+ tools, ready to use
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            Agents come pre-equipped with the tools they need. Connect your own via API.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {displayTools.map((tool) => {
            const status = statusConfig[tool.status]
            return (
              <div
                key={tool._id}
                className="bg-background border border-border/60 rounded-lg p-4 hover:border-border transition-colors cursor-default"
                onClick={() => posthog?.capture('tool_card_click', { name: tool.name, category: tool.category })}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-medium leading-tight">{tool.name}</span>
                  <Badge variant={status.variant} className="text-[10px] px-1.5 py-0 shrink-0">
                    {status.label}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{tool.description}</p>
                <div className="mt-2">
                  <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                    {tool.category}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
