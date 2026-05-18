'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { usePostHog } from 'posthog-js/react'
import { FeatureCard } from '@/lib/sanity-schema'

interface FeaturesProps {
  cards?: FeatureCard[]
}

const defaultCards = [
  {
    _id: '1',
    title: 'Multi-Agent Coordination',
    description: 'Specialized agents work in parallel, handing off tasks seamlessly. No bottlenecks, no context loss.',
    icon: '⚡',
  },
  {
    _id: '2',
    title: 'Natural Language Interface',
    description: 'Describe what you need in plain language. Agents interpret intent, not just instructions.',
    icon: '💬',
  },
  {
    _id: '3',
    title: 'Self-Improving Loop',
    description: 'Every interaction feeds back into the system. Agents learn from outcomes and refine their approach.',
    icon: '🔄',
  },
  {
    _id: '4',
    title: 'Tool-Native Execution',
    description: 'Agents connect to your existing tools — APIs, databases, browsers — and act, not just advise.',
    icon: '🔧',
  },
  {
    _id: '5',
    title: 'Transparent Audit Trail',
    description: 'Every decision, action, and result is logged. Full visibility into what your agents are doing.',
    icon: '📋',
  },
  {
    _id: '6',
    title: 'Human-in-the-Loop',
    description: 'Set approval gates for sensitive actions. Agents ask when they should, act when they can.',
    icon: '🎯',
  },
]

export function Features({ cards }: FeaturesProps) {
  const posthog = usePostHog()
  const displayCards = cards && cards.length > 0 ? cards : defaultCards

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Built for how agents actually work
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            Not a chatbot wrapper. A real execution environment for AI agents that get things done.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayCards.map((card) => (
            <Card
              key={card._id}
              className="border border-border/60 hover:border-border transition-colors cursor-default"
              onMouseEnter={() => posthog?.capture('feature_card_hover', { title: card.title })}
            >
              <CardHeader className="pb-2">
                <div className="text-2xl mb-2">{card.icon}</div>
                <h3 className="font-semibold text-sm">{card.title}</h3>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
