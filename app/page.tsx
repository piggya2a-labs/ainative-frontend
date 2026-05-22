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
    // 拉取所有 enabled agents 的 skills 字段，算总数和 skills 总数
    const { data: agents, count: agentCount } = await supabase
      .from('agent_registry')
      .select('skills', { count: 'exact' })
      .eq('enabled', true)
    const toolCount = (agents ?? []).reduce(
      (sum: number, a: { skills?: unknown[] }) =>
        sum + (Array.isArray(a.skills) ? a.skills.length : 0),
      0
    )
    return { agentCount: agentCount ?? 0, toolCount }
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
