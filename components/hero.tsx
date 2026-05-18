'use client'
import { Button } from '@/components/ui/button'
import { ArrowRight, Play, Shield, Zap, Rocket, CheckCircle2, Loader2, Clock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SiteConfig } from '@/lib/sanity-schema'

interface AgentEvent {
  id: number
  agent: string
  action: string
  status: 'done' | 'running' | 'queued'
  ts: string
}

interface HeroProps {
  siteConfig?: SiteConfig | null
  agentCount?: number
  toolCount?: number
  onCtaClick?: () => void
  onDemoClick?: () => void
}

const ICON_MAP: Record<string, React.ElementType> = {
  shield: Shield,
  zap: Zap,
  rocket: Rocket,
}

function StatusIcon({ status }: { status: AgentEvent['status'] }) {
  if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-foreground" aria-hidden="true" />
  return <Clock className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
}

interface LiveFeedProps {
  feedHeader: string
  seedEvents: Omit<AgentEvent, 'id'>[]
  rollingEvents: Omit<AgentEvent, 'id' | 'ts'>[]
}

function LiveFeed({ feedHeader, seedEvents, rollingEvents }: LiveFeedProps) {
  const [events, setEvents] = useState<AgentEvent[]>(
    seedEvents.map((e, i) => ({ ...e, id: i }))
  )
  const counterRef = useRef(seedEvents.length)
  const rollingRef = useRef(0)

  useEffect(() => {
    if (!rollingEvents.length) return
    const interval = setInterval(() => {
      const next = rollingEvents[rollingRef.current % rollingEvents.length]
      rollingRef.current += 1
      setEvents((prev) => [{ ...next, id: counterRef.current++, ts: 'just now' }, ...prev].slice(0, 5))
    }, 2800)
    return () => clearInterval(interval)
  }, [rollingEvents])

  const activeCount = events.filter((e) => e.status === 'running').length

  return (
    <div className="w-full rounded-xl border border-border/60 bg-background/60 backdrop-blur-sm overflow-hidden text-left">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/30">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{feedHeader}</span>
        <span className="flex items-center gap-1.5 text-xs text-[oklch(0.65_0.15_145)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.15_145)] animate-pulse" />
          {activeCount} active
        </span>
      </div>
      <ul className="divide-y divide-border">
        {events.slice(0, 5).map((event) => (
          <li key={event.id} className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors">
            <StatusIcon status={event.status} />
            <span className="font-mono text-xs text-muted-foreground w-32 shrink-0 truncate">{event.agent}</span>
            <span className="flex-1 text-foreground truncate text-xs leading-relaxed">{event.action}</span>
            <span className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums">{event.ts}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Hero({ siteConfig, agentCount = 0, toolCount = 0, onCtaClick, onDemoClick }: HeroProps) {
  const hero = siteConfig?.hero
  const demo = siteConfig?.hero_demo

  const headline = hero?.hero_title || hero?.headline || 'AI Agents That Actually Work - Deploy in Minutes, Not Months'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Automate 80% of repetitive tasks with intelligent agents that learn from your workflow. Start seeing results in your first hour.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Building Free'
  const secondaryCtaText = hero?.secondaryCtaText || 'See It In Action'
  const eyebrow = hero?.eyebrow

  const trustIndicators = demo?.trust_indicators ?? []
  const trustStats = [
    { value: agentCount > 0 ? `${agentCount}` : '—', label: demo?.agent_count_label ?? '' },
    { value: toolCount > 0 ? `${toolCount}` : '—', label: demo?.tool_count_label ?? '' },
    { value: demo?.sla_value ?? '', label: demo?.sla_label ?? '' },
  ]

  const feedHeader = demo?.feed_header ?? ''
  const seedEvents = (demo?.seed_events ?? []) as Omit<AgentEvent, 'id'>[]
  const rollingEvents = (demo?.rolling_events ?? []) as Omit<AgentEvent, 'id' | 'ts'>[]

  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 overflow-hidden" aria-label="Hero">
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle, oklch(0.30 0 0) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.35 }} />
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, var(--background) 0%, transparent 100%)' }} />
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-10">
        {eyebrow && (
          <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.1] text-balance">{headline}</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed text-pretty">{subheadline}</p>
        <div className="flex flex-col items-center gap-4 pt-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button size="lg" className="h-12 px-8 text-base font-semibold tracking-tight transition-all hover:opacity-90 active:scale-[0.98] group" onClick={onCtaClick}>
              {ctaText}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-7 text-base font-medium group" onClick={onDemoClick}>
              <Play className="w-4 h-4 mr-2 fill-current opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
              {secondaryCtaText}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
            No credit card required • 5-minute setup
          </p>
        </div>
        {trustIndicators.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-6 w-full max-w-2xl">
            {trustIndicators.map((indicator) => {
              const Icon = ICON_MAP[indicator.icon] ?? Shield
              return (
                <div key={indicator.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="w-4 h-4 shrink-0 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
                  <span>{indicator.text}</span>
                </div>
              )
            })}
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-2 w-full max-w-md">
          {trustStats.filter(s => s.label).map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-bold tracking-tight tabular-nums">{stat.value}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
        {seedEvents.length > 0 && (
          <div className="w-full pt-4">
            <LiveFeed feedHeader={feedHeader} seedEvents={seedEvents} rollingEvents={rollingEvents} />
          </div>
        )}
      </div>
    </section>
  )
}