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

// siteConfig 的真实结构（Sanity 中实际存储的格式）
export interface SiteConfig {
  _id: string
  _type: 'siteConfig'
  hero: {
    hero_title: string
    hero_subtitle: string
    headline: string
    subheadline: string
    ctaText: string
    ctaUrl: string
    secondaryCtaText: string
    secondaryCtaUrl: string
    hero_cta: string
  }
  features: Array<{
    _key: string
    title: string
    description: string
    icon: string
  }>
  nav: {
    logo: string
    links: Array<{
      _key: string
      label: string
      url: string
    }>
    ctaText: string
    ctaUrl: string
  }
  tools: Array<{
    _key: string
    name: string
    category: string
  }>
  meta: {
    title: string
    description: string
    version: number
    lastUpdatedAt: string
    lastUpdatedBy: string
  }
  cta?: {
    headline?: string
    description?: string
    buttonText?: string
    buttonUrl?: string
    cta_subtitle?: string
    hero_cta?: string
  }
  pages?: SiteConfigPages
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

// pages 字段：各页面文案（Sanity siteConfig.pages）
export interface SiteConfigPages {
  agents?: {
    eyebrow?: string
    headline_suffix?: string
    description?: string
    core_label?: string
    external_label?: string
    empty_state?: string
  }
  tools?: {
    eyebrow?: string
    headline_suffix?: string
    description?: string
    empty_state?: string
    mcp_label?: string
  }
  cta?: {
    headline?: string
    description?: string
    button_text?: string
    subtitle?: string
    success_message?: string
    no_spam?: string
  }
  footer?: {
    tagline?: string
    links?: string[]
  }
}
