'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'
import { HeroContent } from '@/lib/sanity-schema'

interface HeroProps {
  content?: HeroContent | null
}

const defaultContent = {
  headline: 'Your AI Agent Team,\nReady to Work',
  subheadline: 'Delegate complex tasks to specialized AI agents. They coordinate, execute, and iterate — so you can focus on what matters.',
  ctaText: 'Start for free',
  ctaHref: '#',
  badge: 'Now in Beta',
}

export function Hero({ content }: HeroProps) {
  const posthog = usePostHog()
  const c = content || defaultContent

  const handleCTA = () => {
    posthog?.capture('hero_cta_click', {
      headline: c.headline,
      variant: (content as HeroContent)?.variant || 'default',
    })
  }

  return (
    <section className="relative min-h-[85vh] flex flex-col items-center justify-center text-center px-4 pt-14">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        {c.badge && (
          <Badge variant="outline" className="text-xs px-3 py-1 rounded-full">
            {c.badge}
          </Badge>
        )}

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight whitespace-pre-line">
          {c.headline}
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          {c.subheadline}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            size="lg"
            className="text-sm px-8"
            onClick={handleCTA}
          >
            {c.ctaText}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-sm px-8"
            onClick={() => posthog?.capture('hero_secondary_cta_click')}
          >
            See how it works
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          No credit card required · Free tier available
        </p>
      </div>
    </section>
  )
}
