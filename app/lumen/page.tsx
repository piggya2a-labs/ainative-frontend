import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { getSiteConfig } from '@/lib/queries'
import { LumenClient } from './lumen-client'

export const revalidate = 60

export default async function LumenPage() {
  const siteConfig = await getSiteConfig()
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar siteConfig={siteConfig} />
      <LumenClient />
      <Footer siteConfig={siteConfig} />
    </div>
  )
}
