// Sanity Schema 类型定义
// Agent 通过 Sanity API 写入这些结构，前端直接渲染

export interface HeroContent {
  _id: string
  _type: 'heroContent'
  headline: string
  subheadline: string
  ctaText: string
  ctaHref: string
  badge?: string
  variant?: 'default' | 'experiment_a' | 'experiment_b'
  updatedAt?: string
}

export interface FeatureCard {
  _id: string
  _type: 'featureCard'
  title: string
  description: string
  icon: string
  order: number
  visible: boolean
}

export interface AgentTool {
  _id: string
  _type: 'agentTool'
  name: string
  description: string
  category: string
  status: 'active' | 'beta' | 'coming_soon'
  order: number
}

export interface SiteConfig {
  _id: string
  _type: 'siteConfig'
  siteName: string
  tagline: string
  navItems: Array<{ label: string; href: string }>
  footerText: string
  announcementBar?: string
  showAnnouncementBar: boolean
}

export interface ABTest {
  _id: string
  _type: 'abTest'
  name: string
  targetComponent: string
  variants: Array<{
    key: string
    weight: number
    content: Record<string, string>
  }>
  active: boolean
}
