import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 60

async function getCapabilityTools() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase
    .from('tool_registry')
    .select('id, tool_name, description, category, annotations, owner_agent')
    .eq('owner_agent', 'platform')
    .eq('enabled', true)
    .filter('annotations->>visibility', 'eq', 'external')
    .order('category')
    .order('tool_name')

  if (error) return []
  return data ?? []
}

// Map category to a human-readable label
const CATEGORY_LABELS: Record<string, string> = {
  trigger: 'Trigger.dev',
  n8n_mcp: 'n8n',
}

function categoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat
}

type ToolRow = {
  id: string
  tool_name: string
  description?: string
  category?: string
  annotations?: Record<string, string>
}

export default async function ToolsPage() {
  const tools = await getCapabilityTools()

  // Group by category
  const grouped = tools.reduce<Record<string, ToolRow[]>>((acc, tool) => {
    const cat = tool.category ?? 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tool)
    return acc
  }, {})

  const categories = Object.keys(grouped).sort()

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground mb-4">
            Capability Tools
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            {tools.length} tools available via MCP
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            These are the external-facing Capability tools exposed through the MCP server.
            Infrastructure and system tools are internal and not listed here.
          </p>
        </div>

        {tools.length === 0 && (
          <p className="text-center text-muted-foreground py-20 text-sm font-mono">
            No capability tools found in registry.
          </p>
        )}

        {/* Grouped by category */}
        <div className="space-y-10">
          {categories.map((cat) => (
            <section key={cat}>
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                  {categoryLabel(cat)}
                </h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{grouped[cat].length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped[cat].map((tool) => (
                  <div
                    key={tool.id}
                    className="p-4 rounded-lg border border-border hover:border-foreground/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-sm font-mono font-medium leading-snug">
                        {tool.tool_name}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.55_0.15_145)] border-[oklch(0.65_0.15_145)]/20"
                      >
                        External
                      </Badge>
                    </div>
                    {tool.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {tool.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* MCP endpoint info */}
        {tools.length > 0 && (
          <div className="mt-14 p-5 rounded-lg border border-border bg-muted/30">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              MCP Server Endpoint
            </p>
            <code className="text-xs font-mono text-foreground block mb-2">
              https://bgzrcrftjkcfdszumywd.supabase.co/functions/v1/mcp-server?agent=l1-operator-agent
            </code>
            <p className="text-xs text-muted-foreground">
              Supports JSON-RPC 2.0: <span className="font-mono">initialize</span>,{' '}
              <span className="font-mono">tools/list</span>,{' '}
              <span className="font-mono">tools/call</span>
            </p>
          </div>
        )}
      </main>
      <CTASection />
      <Footer />
    </div>
  )
}
