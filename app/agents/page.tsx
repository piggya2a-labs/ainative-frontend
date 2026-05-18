import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 60

async function getAgents() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase
    .from('agent_registry')
    .select('id, name, type, description, url, enabled, skills, tags, icon_url')
    .eq('type', 'agent')
    .eq('enabled', true)
    .order('id')

  if (error) return []
  return data ?? []
}

function isExternal(id: string) {
  return id.startsWith('ext-')
}

function getTier(id: string): string {
  if (id.startsWith('ext-')) return 'External'
  if (id.startsWith('l1-')) return 'Operator'
  if (id.startsWith('l2-')) return 'Architect'
  if (id.startsWith('l3-')) return 'Auditor'
  return 'Agent'
}

type AgentRow = {
  id: string
  name: string
  description: string
  url?: string
  skills?: Array<{ id: string; name: string; tags?: string[]; description?: string }>
  tags?: string[]
  icon_url?: string
}

function AgentCard({ agent }: { agent: AgentRow }) {
  const tier = getTier(agent.id)
  const isLive = agent.url && agent.url !== 'pending'
  const skills = agent.skills ?? []

  return (
    <div className="p-5 rounded-lg border border-border hover:border-foreground/20 transition-colors flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-snug">{agent.name}</span>
        <Badge
          variant="outline"
          className={`text-xs shrink-0 ${
            isLive
              ? 'bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.55_0.15_145)] border-[oklch(0.65_0.15_145)]/20'
              : 'bg-muted text-muted-foreground border-border'
          }`}
        >
          {isLive ? 'Live' : 'Pending'}
        </Badge>
      </div>

      {agent.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {agent.description}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-auto">
        <Badge variant="secondary" className="text-xs">{tier}</Badge>
        {skills.map((s) => (
          <Badge key={s.id} variant="outline" className="text-xs font-mono">
            {s.name}
          </Badge>
        ))}
      </div>
    </div>
  )
}

export default async function AgentsPage() {
  const agents = await getAgents()
  const coreAgents = agents.filter((a) => !isExternal(a.id))
  const externalAgents = agents.filter((a) => isExternal(a.id))

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 pt-28 pb-16">
        <div className="mb-12 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground mb-4">
            Agent Team
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            {agents.length} agents, always running
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Each agent has a defined role, a set of capabilities, and a live endpoint.
            New agents are discovered automatically from the backend registry.
          </p>
        </div>

        {coreAgents.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                Core — always loaded
              </h2>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{coreAgents.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {coreAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </section>
        )}

        {externalAgents.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                External — deferred, on-demand
              </h2>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{externalAgents.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {externalAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </section>
        )}

        {agents.length === 0 && (
          <p className="text-center text-muted-foreground py-20 text-sm font-mono">
            No agents found in registry.
          </p>
        )}
      </main>
      <CTASection />
      <Footer />
    </div>
  )
}
