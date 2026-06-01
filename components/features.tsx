'use client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { usePostHog } from 'posthog-js/react'
import { SiteConfig } from '@/lib/sanity-schema'
import { T } from 'gt-next'

interface FeaturesProps {
  siteConfig?: SiteConfig | null
}

const ICON_MAP: Record<string, string> = {
  users: '👥',
  message: '💬',
  brain: '🧠',
  tool: '🔧',
  shield: '🛡️',
  refresh: '🔄',
  autonomous: '🤖',
  healing: '🔧',
  composable: '🧩',
}

const DEFAULT_FEATURES = [
  {
    _key: 'autonomous',
    icon: 'autonomous',
    title: 'Autonomous Execution',
    description: 'Deploy agents that run 24/7 without human supervision. Handle tasks while you sleep, scale operations without adding headcount, and maintain consistent performance across time zones.',
  },
  {
    _key: 'healing',
    icon: 'healing',
    title: 'Self-Healing',
    description: 'Agents automatically detect errors, retry failed operations, and adapt to API changes. Reduce downtime from hours to seconds with built-in recovery mechanisms that fix issues before they impact users.',
  },
  {
    _key: 'composable',
    icon: 'composable',
    title: 'Composable Workflows',
    description: 'Mix and match agents like building blocks. Connect data analysis agents with notification agents, chain research agents with content creators, or build custom pipelines for any business process.',
  },
]

export function Features({ siteConfig }: FeaturesProps) {
  const posthog = usePostHog()
  const features = siteConfig?.features && siteConfig.features.length > 0 
    ? siteConfig.features 
    : DEFAULT_FEATURES

  return (
    <section className="py-20 px-4" id="features">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {siteConfig?.features_section?.title || <T id="features.title">AI-Native Agent Capabilities</T>}
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            {siteConfig?.features_section?.subtitle || <T id="features.subtitle">Built for agents that actually do the work, not just talk about it.</T>}
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