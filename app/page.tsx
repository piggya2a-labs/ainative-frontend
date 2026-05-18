import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { Features } from '@/components/features'
import { ToolsGrid } from '@/components/tools-grid'
import { CTASection, Footer } from '@/components/cta-footer'
import { getHeroContent, getFeatureCards, getAgentTools } from '@/lib/queries'

export const revalidate = 60 // ISR: 每 60 秒重新验证

export default async function Home() {
  const [heroContent, featureCards, agentTools] = await Promise.all([
    getHeroContent(),
    getFeatureCards(),
    getAgentTools(),
  ])

  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero content={heroContent} />
      <Features cards={featureCards} />
      <ToolsGrid tools={agentTools} />
      <CTASection />
      <Footer />
    </main>
  )
}
