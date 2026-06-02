'use client'
import { Button } from '@/components/ui/button'
import { ArrowRight, Play, Shield, Zap, Rocket, CheckCircle2, Loader2, Clock, Network, Bot, Workflow, Database, Mail, MessageSquare, Calendar, Code, Sparkles, LayoutTemplate, Brain, Cpu } from 'lucide-react'
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
  onTemplatesClick?: () => void
}

const ICON_MAP: Record<string, React.ElementType> = {
  shield: Shield,
  zap: Zap,
  rocket: Rocket,
  network: Network,
  bot: Bot,
  workflow: Workflow,
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

export function Hero({ siteConfig, agentCount = 0, toolCount = 0, onCtaClick, onDemoClick, onTemplatesClick }: HeroProps) {
  const hero = siteConfig?.hero
  const demo = siteConfig?.hero_demo

  const headline = hero?.hero_title || hero?.headline || 'Build AI Agents with No Code—Automate Your Business in Minutes'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Automate emails, calls, CRM updates, and 200+ workflows without coding. Create intelligent AI agents with persistent memory that integrate seamlessly with your entire tech stack.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Automating Free'
  const secondaryCtaText = hero?.secondaryCtaText || 'Browse Agent Templates'
  const eyebrow = hero?.eyebrow || 'No-Code AI Automation Platform'

  const defaultTrustIndicators = [
    { icon: 'bot', text: 'Task-Specific Agent Templates' },
    { icon: 'workflow', text: 'No-Code Workflow Builder' },
    { icon: 'network', text: '200+ Pre-Built Integrations' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const trustStats = [
    { value: toolCount > 0 ? `${toolCount}+` : '200+', label: demo?.tool_count_label || 'Connected Tools' },
    { value: agentCount > 0 ? `${agentCount}+` : '50+', label: demo?.agent_count_label || 'Active Agents' },
    { value: demo?.sla_value || '99.9%', label: demo?.sla_label || 'Uptime SLA' },
  ]

  const feedHeader = demo?.feed_header || 'Live Agent Automation'
  const seedEvents = (demo?.seed_events ?? []) as Omit<AgentEvent, 'id'>[]
  const rollingEvents = (demo?.rolling_events ?? []) as Omit<AgentEvent, 'id' | 'ts'>[]

  const automationUseCases = [
    { Icon: Mail, label: 'Email Automation' },
    { Icon: MessageSquare, label: 'Sales Outreach' },
    { Icon: Database, label: 'CRM Updates' },
    { Icon: Calendar, label: 'Meeting Scheduling' },
    { Icon: Code, label: 'Custom Workflows' },
  ]

  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-24 sm:pt-20 pb-12 sm:pb-16 overflow-hidden" aria-label="Hero">
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle, oklch(0.30 0 0) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.35 }} />
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, var(--background) 0%, transparent 100%)' }} />
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-8 sm:gap-10 w-full">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-[oklch(0.65_0.15_145)]/30 bg-[oklch(0.65_0.15_145)]/5 backdrop-blur-sm">
          <Sparkles className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
          <span className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.18em] sm:tracking-[0.22em] text-[oklch(0.65_0.15_145)]">{eyebrow}</span>
        </div>
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-[oklch(0.65_0.15_145)]/40 bg-gradient-to-r from-[oklch(0.65_0.15_145)]/10 to-[oklch(0.65_0.15_145)]/5 backdrop-blur-sm">
            <Brain className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
            <span className="text-[10px] sm:text-xs font-semibold text-[oklch(0.65_0.15_145)]">Multi-Agent Collaboration</span>
            <Cpu className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-[-0.03em] leading-[1.1] text-balance px-2">{headline}</h1>
        </div>
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <p className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground/90 tracking-tight px-4">Automate Emails, Calls, CRM Updates—Without Writing Code</p>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed text-pretty px-4">{subheadline}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-2 px-2">
          {automationUseCases.map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-muted/50 border border-border/40 backdrop-blur-sm hover:bg-muted/70 hover:border-border/60 transition-all">
              <Icon className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
              <span className="text-xs sm:text-sm font-medium text-foreground/80">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-3 sm:gap-4 pt-2 sm:pt-4 w-full px-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <Button size="lg" className="h-14 sm:h-12 px-8 sm:px-8 text-base sm:text-base font-semibold tracking-tight transition-all hover:opacity-90 active:scale-[0.98] group shadow-lg w-full sm:w-auto min-h-[3.5rem] sm:min-h-0" onClick={onCtaClick}>
              {ctaText}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 sm:h-12 px-7 text-base sm:text-base font-medium group w-full sm:w-auto min-h-[3.5rem] sm:min-h-0" onClick={onTemplatesClick || onDemoClick}>
              <LayoutTemplate className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" aria-hidden="true" />
              {secondaryCtaText}
            </Button>
          </div>
          <div className="flex flex-col items-center gap-2 sm:gap-1">
            <p className="text-sm sm:text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
              No credit card required • No coding skills needed
            </p>
            <p className="text-sm sm:text-sm font-semibold text-[oklch(0.65_0.15_145)] flex items-center gap-2">
              <Zap className="w-4 h-4" aria-hidden="true" />
              Setup in 5 minutes • Deploy instantly
            </p>
          </div>
          <p className="text-sm sm:text-sm font-medium text-foreground/80 pt-1 sm:pt-2 px-2">
            Agents that remember context, coordinate tasks, and integrate with your entire stack
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 md:gap-6 pt-4 sm:pt-6 w-full max-w-2xl px-4">
          {trustIndicators.map((indicator) => {
            const Icon = ICON_MAP[indicator.icon] ?? Shield
            return (
              <div key={indicator.text} className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Icon className="w-4 h-4 shrink-0 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
                <span className="font-medium">{indicator.text}</span>
              </div>
            )
          })}
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 pt-2 w-full max-w-md px-4">
          {trustStats.filter(s => s.label).map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-0.5">
              <span className="text-2xl sm:text-2xl font-bold tracking-tight tabular-nums">{stat.value}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
        {seedEvents.length > 0 && (
          <div className="w-full pt-2 sm:pt-4 px-4 sm:px-0">
            <LiveFeed feedHeader={feedHeader} seedEvents={seedEvents} rollingEvents={rollingEvents