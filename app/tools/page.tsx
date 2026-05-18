'use client'

import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'

const TOOLS = [
  { name: 'Web Search', category: 'Research', status: 'Active', description: 'Search and extract content from the web in real time.' },
  { name: 'Code Executor', category: 'Dev', status: 'Active', description: 'Run and test code in a sandboxed environment.' },
  { name: 'Email Sender', category: 'Comms', status: 'Active', description: 'Draft and send emails autonomously with approval gates.' },
  { name: 'Data Analyzer', category: 'Analytics', status: 'Active', description: 'Process, transform, and visualise structured data.' },
  { name: 'Image Generator', category: 'Creative', status: 'Beta', description: 'Generate images from text prompts using diffusion models.' },
  { name: 'Calendar Manager', category: 'Productivity', status: 'Active', description: 'Schedule, update, and manage calendar events.' },
  { name: 'Database Query', category: 'Dev', status: 'Active', description: 'Query SQL and NoSQL databases with natural language.' },
  { name: 'Browser Control', category: 'Automation', status: 'Active', description: 'Navigate and interact with websites programmatically.' },
  { name: 'Voice Transcription', category: 'Media', status: 'Beta', description: 'Convert speech to structured text with speaker diarisation.' },
  { name: 'PDF Processor', category: 'Documents', status: 'Active', description: 'Extract, parse, and analyse PDF content at scale.' },
  { name: 'Social Publisher', category: 'Comms', status: 'Soon', description: 'Post and schedule content across social platforms.' },
  { name: 'Market Data', category: 'Finance', status: 'Soon', description: 'Access real-time financial data and price feeds.' },
  { name: 'Slack Messenger', category: 'Comms', status: 'Active', description: 'Send messages and read channels in Slack workspaces.' },
  { name: 'GitHub Actions', category: 'Dev', status: 'Active', description: 'Trigger workflows, read issues, and commit code to GitHub.' },
  { name: 'Notion Writer', category: 'Productivity', status: 'Beta', description: 'Create and update Notion pages and databases.' },
  { name: 'Webhook Caller', category: 'Automation', status: 'Active', description: 'Send HTTP requests to any API or webhook endpoint.' },
]

const ALL_CATEGORIES = ['All', ...Array.from(new Set(TOOLS.map((t) => t.category))).sort()]

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.55_0.15_145)] border-[oklch(0.65_0.15_145)]/20',
  Beta: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Soon: 'bg-muted text-muted-foreground border-border',
}

export default function ToolsPage() {
  const posthog = usePostHog()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => {
    posthog?.capture('page_view', { page: 'tools' })
  }, [posthog])

  const filtered = TOOLS.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || t.category === category
    return matchSearch && matchCat
  })

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <div className="mb-10 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground mb-4">
            Tool Library
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            100+ tools, ready to use
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Agents come pre-equipped with the tools they need. Connect your own via API.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tools..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                posthog?.capture('tools_search', { query: e.target.value })
              }}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategory(cat)
                  posthog?.capture('tools_filter', { category: cat })
                }}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  category === cat
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Tools grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((tool) => (
            <div
              key={tool.name}
              className="p-4 rounded-lg border border-border hover:border-foreground/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-sm font-medium">{tool.name}</span>
                <Badge
                  variant="outline"
                  className={`text-xs shrink-0 ${STATUS_COLORS[tool.status] ?? ''}`}
                >
                  {tool.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                {tool.description}
              </p>
              <Badge variant="secondary" className="text-xs">
                {tool.category}
              </Badge>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">
            No tools found for &ldquo;{search}&rdquo;
          </p>
        )}
      </main>
      <CTASection />
      <Footer />
    </div>
  )
}
