import { createClient } from '@supabase/supabase-js'
import { Badge } from '@/components/ui/badge'
import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { getSiteConfig } from '@/lib/queries'

export const revalidate = 60

type ToolRow = {
  id: string
  tool_name: string
  description?: string
  category?: string
  annotations?: Record<string, string>
}

async function getCapabilityTools(): Promise<ToolRow[]> {
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

const CATEGORY_LABELS: Record<string, string> = {
  trigger: 'Trigger.dev',
  n8n_mcp: 'n8n',
}

function categoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat
}

// 只取描述的第一句话
function firstSentence(text: string): string {
  const line = text.split('\n')[0].trim()
  const match = line.match(/^[^。！？.!?]+[。！？.!?]?/)
  return match ? match[0].trim() : line.slice(0, 80)
}

const MCP_ENDPOINT = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mcp-server?agent=l1-operator-agent`

export default async function ToolsPage() {
  const [tools, siteConfig] = await Promise.all([
    getCapabilityTools(),
    getSiteConfig(),
  ])

  const p = siteConfig?.pages?.tools
  const emptyState = p?.empty_state || '注册表中暂无对外暴露的工具。'
  const mcpLabel = p?.mcp_label || 'MCP Server 端点'
  const mcpMethodsLabel = p?.mcp_methods_label || '支持 JSON-RPC 2.0：'
  const mcpMethods: string[] = p?.mcp_methods ?? ['initialize', 'tools/list', 'tools/call']

  const grouped = tools.reduce<Record<string, ToolRow[]>>((acc, tool) => {
    const cat = tool.category ?? 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tool)
    return acc
  }, {})
  const categories = Object.keys(grouped).sort()

  return (
    <div className="min-h-screen bg-background">
      <Navbar siteConfig={siteConfig} />

      <main className="max-w-4xl mx-auto px-4 pt-28 pb-16">

        {/* Header — 纯数字，无口号 */}
        <div className="mb-10 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Tools
          </h1>
          <span className="text-sm text-muted-foreground font-mono">
            {tools.length} tools · MCP
          </span>
        </div>

        {tools.length === 0 && (
          <p className="text-center text-muted-foreground py-20 text-sm font-mono">
            {emptyState}
          </p>
        )}

        {/* Tool list grouped by category */}
        <div className="space-y-8">
          {categories.map((cat) => (
            <section key={cat}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  {categoryLabel(cat)}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {grouped[cat].length}
                </span>
              </div>

              <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {grouped[cat].map((tool) => (
                  <div
                    key={tool.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-mono font-medium block truncate">
                        {tool.tool_name}
                      </span>
                      {tool.description && (
                        <span className="text-xs text-muted-foreground truncate block mt-0.5">
                          {firstSentence(tool.description)}
                        </span>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    >
                      External
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* MCP endpoint — compact */}
        {tools.length > 0 && (
          <div className="mt-10 flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/20">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                {mcpLabel}
              </p>
              <code className="text-xs font-mono text-foreground block truncate">
                {MCP_ENDPOINT}
              </code>
              <p className="text-xs text-muted-foreground mt-1">
                {mcpMethodsLabel}{' '}
                {mcpMethods.map((m, i) => (
                  <span key={m}>
                    <span className="font-mono">{m}</span>
                    {i < mcpMethods.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
            </div>
          </div>
        )}

      </main>

      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
    </div>
  )
}
