import { createClient } from '@supabase/supabase-js'
import { Badge } from '@/components/ui/badge'
import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { getSiteConfig } from '@/lib/queries'

// ─── Data ─────────────────────────────────────────────────────────────────────

type ToolRow = {
  id: string
  tool_name: string
  description?: string
  category?: string
  annotations?: Record<string, unknown>
}

async function getAllTools(): Promise<ToolRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase
    .from('tool_registry')
    .select('id, tool_name, description, category, annotations')
    .eq('enabled', true)
    .order('tool_name')
  if (error) return []
  return data ?? []
}

// ─── Layer classification ─────────────────────────────────────────────────────

type Layer = 'infrastructure' | 'system' | 'capability' | 'mcp_external'

const INFRASTRUCTURE_CATS = new Set(['sprite', 'steel', 'composio_mcp', 'supabase', 'store'])
const SYSTEM_CATS = new Set([
  'memory', 'memory_tool', 'self_healing', 'admin',
  'orchestration', 'reflection', 'utility', 'a2a',
  'langsmith', 'langsmith_runs', 'langsmith_eval', 'langgraph',
  'claude_cli', 'project',
])
const EXTERNAL_CATS = new Set(['n8n_mcp', 'trigger'])
const CAPABILITY_CATS = new Set(['search', 'code', 'research', 'uncategorized'])

function getLayer(tool: ToolRow): Layer {
  const cat = tool.category ?? ''
  const ann = tool.annotations as Record<string, string> | null
  const vis = ann?.visibility

  if (vis === 'external' || EXTERNAL_CATS.has(cat)) return 'mcp_external'
  if (tool.tool_name.startsWith('cap_') || CAPABILITY_CATS.has(cat)) return 'capability'
  if (INFRASTRUCTURE_CATS.has(cat)) return 'infrastructure'
  if (SYSTEM_CATS.has(cat)) return 'system'
  return 'system'
}

// ─── Layer metadata ───────────────────────────────────────────────────────────

const LAYER_META = {
  infrastructure: {
    label: 'Infrastructure',
    subtitle: '管道层 — 始终加载',
    desc: '执行环境、浏览器自动化、数据库访问、对象存储。这些是 Agent 团队运转的基础管道，任何任务都依赖它们。',
    badge: 'Core',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    dot: 'bg-blue-500',
  },
  system: {
    label: 'System',
    subtitle: '自治层 — 始终加载',
    desc: '记忆、编排、自我修复、审计、反思。这些是 Agent 团队自我管理的能力，让 Agent 能持续学习、协作和自我优化。',
    badge: 'Core',
    badgeClass: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
    dot: 'bg-violet-500',
  },
  capability: {
    label: 'Capability',
    subtitle: '专业技能层 — 按需加载',
    desc: '搜索、研究、代码、合规、趋势追踪。任何外部能力接入后都成为 Agent 团队的专业技能，由 Agent 按任务需要自主调用。',
    badge: 'Deferred',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  mcp_external: {
    label: 'MCP Interface',
    subtitle: '对外暴露的 MCP 接口',
    desc: '通过标准 MCP 协议对外暴露的工具接口，供外部 Agent 或客户端直接调用。这是 ONIT 与外部世界互通的标准入口。',
    badge: 'External',
    badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    dot: 'bg-amber-500',
  },
}

const CAT_LABELS: Record<string, string> = {
  sprite: 'Sprite 沙箱',
  steel: 'Steel 浏览器',
  composio_mcp: 'Composio',
  supabase: 'Supabase',
  store: 'KV Store',
  memory: 'Memory',
  memory_tool: 'Memory Editor',
  self_healing: 'Self-Healing',
  admin: 'Admin',
  orchestration: 'Orchestration',
  reflection: 'Reflection',
  utility: 'Utility',
  a2a: 'A2A 协议',
  langsmith: 'LangSmith',
  langsmith_runs: 'LangSmith Runs',
  langsmith_eval: 'LangSmith Eval',
  langgraph: 'LangGraph',
  claude_cli: 'Claude Code',
  project: 'Projects',
  search: 'Search & Research',
  code: 'Code Intelligence',
  research: 'Research',
  uncategorized: 'Other',
  n8n_mcp: 'n8n MCP',
  trigger: 'Trigger.dev',
}

function catLabel(cat: string) {
  return CAT_LABELS[cat] ?? cat
}

function toolDisplayName(name: string): string {
  return name
    .replace(/^cap_/, '')
    .replace(/_mcp$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const LAYER_ORDER: Layer[] = ['infrastructure', 'system', 'capability', 'mcp_external']

export const revalidate = 60

export default async function ToolsPage() {
  const [tools, siteConfig] = await Promise.all([getAllTools(), getSiteConfig()])

  const byLayer: Record<Layer, ToolRow[]> = {
    infrastructure: [],
    system: [],
    capability: [],
    mcp_external: [],
  }
  for (const t of tools) {
    byLayer[getLayer(t)].push(t)
  }

  const totalCount = tools.length
  const mcpCount = byLayer.mcp_external.length

  return (
    <div className="min-h-screen bg-background">
      <Navbar siteConfig={siteConfig} />

      <main className="max-w-5xl mx-auto px-4 pt-28 pb-20">

        {/* Header */}
        <div className="mb-16 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground mb-4">
            Agent Tool Stack
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">
            {totalCount} tools, 3 layers
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed text-base">
            ONIT 的工具体系分三层：<strong>Infrastructure</strong>（管道）和{' '}
            <strong>System</strong>（自治）是 Core Tools，始终加载；
            <strong> Capability</strong>（专业技能）是 Deferred Tools，Agent 按需调用。
            任何外部能力接入后都成为有身份、有职能的 Agent 团队成员。
          </p>

          {/* Layer summary pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {LAYER_ORDER.map((layer) => {
              const meta = LAYER_META[layer]
              const count = byLayer[layer].length
              return (
                <a
                  key={layer}
                  href={`#${layer}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-border hover:border-foreground/30 transition-colors text-sm"
                >
                  <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                  <span className="font-medium">{meta.label}</span>
                  <span className="text-muted-foreground font-mono">{count}</span>
                </a>
              )
            })}
          </div>
        </div>

        {/* Layers */}
        <div className="space-y-16">
          {LAYER_ORDER.map((layer) => {
            const meta = LAYER_META[layer]
            const layerTools = byLayer[layer]
            if (layerTools.length === 0) return null

            const byCat: Record<string, ToolRow[]> = {}
            for (const t of layerTools) {
              const cat = t.category ?? 'uncategorized'
              if (!byCat[cat]) byCat[cat] = []
              byCat[cat].push(t)
            }
            const cats = Object.keys(byCat).sort()

            return (
              <section key={layer} id={layer}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                      <h2 className="text-xl font-semibold">{meta.label}</h2>
                      <Badge variant="outline" className={`text-xs ${meta.badgeClass}`}>
                        {meta.badge}
                      </Badge>
                      <span className="text-sm text-muted-foreground font-mono">
                        {layerTools.length} tools
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-5">{meta.subtitle}</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-6 ml-5 max-w-2xl leading-relaxed">
                  {meta.desc}
                </p>

                <div className="space-y-6 ml-5">
                  {cats.map((cat) => {
                    const catTools = byCat[cat]
                    return (
                      <div key={cat}>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                            {catLabel(cat)}
                          </span>
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-xs text-muted-foreground">{catTools.length}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {catTools.map((tool) => (
                            <div
                              key={tool.id}
                              className="p-3.5 rounded-lg border border-border hover:border-foreground/20 transition-colors bg-background"
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <span className="text-xs font-mono font-medium leading-snug text-foreground">
                                  {layer === 'capability'
                                    ? toolDisplayName(tool.tool_name)
                                    : tool.tool_name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] shrink-0 ${meta.badgeClass}`}
                                >
                                  {meta.badge}
                                </Badge>
                              </div>
                              {tool.description && (
                                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                                  {tool.description.split('\n')[0]}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        {/* MCP Endpoint */}
        {mcpCount > 0 && (
          <div className="mt-16 p-6 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                MCP Server 端点
              </p>
            </div>
            <code className="text-sm font-mono text-foreground block mb-2">
              {process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mcp-server
            </code>
            <p className="text-xs text-muted-foreground">
              支持 JSON-RPC 2.0：
              {' '}<span className="font-mono">initialize</span>、
              <span className="font-mono">tools/list</span>、
              <span className="font-mono">tools/call</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              当前对外暴露 <strong>{mcpCount}</strong> 个工具，其余{' '}
              <strong>{totalCount - mcpCount}</strong> 个为内部工具，仅供 Agent 团队调用。
            </p>
          </div>
        )}

        {/* Philosophy callout */}
        <div className="mt-12 p-6 rounded-xl border border-border/50 bg-muted/20 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
            ONIT 不是工具集合，而是 <strong>Agent 雇主平台</strong>。
            任何外部能力接入后，都会成为有身份、有职能、可被派活的 Agent 团队成员，
            整个过程以用户定义的成功标准为终点，形成闭环。
          </p>
        </div>

      </main>

      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
    </div>
  )
}
