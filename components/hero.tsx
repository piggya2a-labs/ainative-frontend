'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'
import { HeroContent } from '@/lib/sanity-schema'
import { Sparkles, Zap, Bot, ArrowRight, Play } from 'lucide-react'

interface HeroProps {
  content?: HeroContent | null
}

const defaultContent = {
  headline: 'Build Autonomous AI Agents That Work 24/7 Without Code',
  subheadline: 'Automate customer support, data analysis, or content creation in minutes — not months. Watch your AI agent handle repetitive tasks while you focus on growth.',
  ctaText: 'Launch Your First Agent Free',
  ctaHref: '#',
  badge: '⚡ No coding required · Live in under 5 minutes',
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
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-[250px] h-[250px] rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        {c.badge && (
          <Badge variant="outline" className="text-xs px-3 py-1.5 rounded-full border-primary/20 bg-primary/5 inline-flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            {c.badge}
          </Badge>
        )}

        <div className="flex justify-center gap-4 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10 text-blue-500">
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/10 text-purple-500">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
          {c.headline}
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {c.subheadline}
        </p>

        <div className="flex flex-col items-center gap-4 pt-4">
          <Button
            size="lg"
            className="text-sm px-8 h-12 font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all group"
            onClick={handleCTA}
          >
            <Zap className="w-4 h-4 mr-2" />
            {c.ctaText}
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="text-sm px-6 h-10 text-muted-foreground hover:text-foreground group"
            onClick={() => posthog?.capture('hero_demo_cta_click')}
          >
            <Play className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
            Watch 2-Min Demo
          </Button>
        </div>

        <div className="flex items-center justify-center gap-6 pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Free to start
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            No coding skills needed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Deploy in 5 minutes
          </span>
        </div>
      </div>
    </section>
  )
}