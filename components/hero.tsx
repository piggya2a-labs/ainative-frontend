'use client'

import { Button } from '@/components/ui/button'
import { usePostHog } from 'posthog-js/react'
import { HeroContent } from '@/lib/sanity-schema'
import { ArrowRight, Play } from 'lucide-react'

interface HeroProps {
  content?: HeroContent | null
}

const defaultContent = {
  headline: 'Your AI workforce,\nrunning 24/7.',
  subheadline:
    'Deploy autonomous agents that handle support, research, and operations — without writing a single line of code. Go live in under 5 minutes.',
  ctaText: 'Start for free',
  ctaHref: '#',
  badge: 'AI-Native · No code required · Live in 5 min',
}

const TRUST_STATS = [
  { value: '10,000+', label: 'tasks automated daily' },
  { value: '< 5 min', label: 'to first deployment' },
  { value: '99.9%', label: 'uptime SLA' },
]

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
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 pt-16 pb-20">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          opacity: 0.4,
        }}
      />
      {/* Fade vignette over grid */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, transparent 30%, var(--color-background) 100%)',
        }}
      />

      <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
        {/* Eyebrow label */}
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {c.badge}
        </p>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] text-balance whitespace-pre-line">
          {c.headline}
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed text-pretty">
          {c.subheadline}
        </p>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Button
            size="lg"
            className="h-12 px-8 text-base font-semibold tracking-tight transition-all hover:opacity-90 active:scale-[0.98] group"
            onClick={handleCTA}
          >
            {c.ctaText}
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 px-6 text-base font-medium group"
            onClick={() => posthog?.capture('hero_demo_cta_click')}
          >
            <Play className="w-4 h-4 mr-2 fill-current opacity-70 group-hover:opacity-100 transition-opacity" />
            Watch demo
          </Button>
        </div>

        {/* Trust stats */}
        <div className="flex flex-col sm:flex-row items-center gap-8 pt-6 border-t border-border w-full max-w-lg">
          {TRUST_STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
