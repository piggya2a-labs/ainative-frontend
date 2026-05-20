import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { Features } from '@/components/features'
import { ToolsGrid } from '@/components/tools-grid'
import { CTASection, Footer } from '@/components/cta-footer'
import { getSiteConfig } from '@/lib/queries'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 60 // ISR: 每 60 秒重新验证

async function getSupabaseCounts() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const [{ count: agentCount }, { count: toolCount }] = await Promise.all([
      supabase
        .from('agent_registry')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'system')
        .eq('enabled', true),
      supabase
        .from('agent_registry')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'infrastructure')
        .eq('enabled', true),
    ])
    return { agentCount: agentCount ?? 0, toolCount: toolCount ?? 0 }
  } catch {
    return { agentCount: 0, toolCount: 0 }
  }
}

export default async function Home() {
  const [siteConfig, { agentCount, toolCount }] = await Promise.all([
    getSiteConfig(),
    getSupabaseCounts(),
  ])

  return (
    <main className="min-h-screen">
      <Navbar siteConfig={siteConfig} />
      <Hero siteConfig={siteConfig} agentCount={agentCount} toolCount={toolCount} />
      <Features siteConfig={siteConfig} />
      <ToolsGrid siteConfig={siteConfig} />
      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
    </main>
  )
}
