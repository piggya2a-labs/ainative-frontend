'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'
import { HeroContent } from '@/lib/sanity-schema'

interface HeroProps {
  content?: HeroContent | null
}

const defaultContent = {
  headline: 'Stop Managing Tasks.\nLet AI Agents Do It.',
  subheadline: 'Upload a doc, describe a goal, or paste a link — your AI team researches, writes, analyzes, and delivers results in minutes.',
  ctaText: 'Try it free — no signup',
  ctaHref: '#',
  badge: '✨ Beta · 500+ tasks completed',
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
          <Badge variant="outline" className="text-xs px-3 py-1.5 rounded-full border-primary/20 bg-primary/5">
            {c.badge}
          </Badge>
        )}

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] whitespace-pre-line">
          {c.headline}
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {c.subheadline}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button
            size="lg"
            className="text-sm px-8 h-12 font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
            onClick={handleCTA}
          >
            {c.ctaText}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-sm px-8 h-12"
            onClick={() => posthog?.capture('hero_secondary_cta_click')}
          >
            Watch 2-min demo
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          No credit card · No account needed · See results in 60 seconds
        </p>
      </div>
    </section>
  )
}