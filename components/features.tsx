'use client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { usePostHog } from 'posthog-js/react'
import { SiteConfig } from '@/lib/sanity-schema'
import { T } from 'gt-next'

interface FeaturesProps {
  siteConfig?: SiteConfig | null
}

// icon 映射：Sanity 里存的是字符串 key，这里映射到 emoji
const ICON_MAP: Record<string, string> = {
  users: '👥',
  message: '💬',
  brain: '🧠',
  tool: '🔧',
  shield: '🛡️',
  refresh: '🔄',
}

export function Features({ siteConfig }: FeaturesProps) {
  const posthog = usePostHog()
  const features = siteConfig?.features

  if (!features || features.length === 0) {
    return null
  }

  return (
    <section className="py-20 px-4" id="features">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {siteConfig?.features_section?.title || <T id="features.title">为 Agent 真实工作方式而生</T>}
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            {siteConfig?.features_section?.subtitle || <T id="features.subtitle">不是聊天机器人包装。是让 AI Agent 真正完成工作的执行环境。</T>}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <Card
              key={feature._key}
              className="border border-border/60 hover:border-border transition-colors cursor-default"
              onMouseEnter={() => posthog?.capture('feature_card_hover', { title: feature.title })}
            >
              <CardHeader className="pb-2">
                <div className="text-2xl mb-2">
                  {ICON_MAP[feature.icon] || '✦'}
                </div>
                <h3 className="font-semibold text-sm">{feature.title}</h3>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
