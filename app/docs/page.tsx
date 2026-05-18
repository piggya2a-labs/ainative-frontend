import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { getSiteConfig } from '@/lib/queries'
import { SiteConfig } from '@/lib/sanity-schema'
import { DocsClient } from './docs-client'

export const revalidate = 60

// docs 页面从 siteConfig.docs 读取所有内容
export type DocsConfig = {
  version?: string
  page_title?: string
  page_description?: string
  mcp_server_url?: string
  supabase_rest_url?: string
  sections?: Array<{
    id: string
    title: string
    steps?: Array<{ step: string; title: string; description: string; code?: string; code_comment?: string }>
    description?: string
    tools?: Array<{ name: string; description: string }>
    tools_label?: string
    layers?: Array<{ name: string; prefix: string; role: string }>
    mcp_config?: string
  }>
}

// 外层 server component：fetch siteConfig，传给内层 client component
export default async function DocsPage() {
  const siteConfig = await getSiteConfig()

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar siteConfig={siteConfig} />
      <DocsClient siteConfig={siteConfig} />
      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
    </div>
  )
}
