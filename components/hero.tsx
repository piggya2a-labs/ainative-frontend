'use client'
import { Button } from '@/components/ui/button'
import { ArrowRight, Play, Shield, Zap, Rocket, CheckCircle2, Loader2, Clock, Network, Bot, Workflow, Database, Mail, MessageSquare, Calendar, Code, Sparkles, LayoutTemplate, Brain, Cpu, GitBranch, Link2, Cloud, Smartphone, FileText, DollarSign, Lock, Users, Activity } from 'lucide-react'
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

  const headline = hero?.hero_title || hero?.headline || 'Enterprise-Grade AI Agents Without Code'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Build intelligent agents with visual logic branching, real-time monitoring, and multi-team collaboration. Connect 200+ tools across your tech stack with enterprise security and governance—no developers required.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Building Agents'
  const secondaryCtaText = hero?.secondaryCtaText || 'See Enterprise Features'
  const eyebrow = hero?.eyebrow || 'Enterprise No-Code AI Platform'

  const defaultTrustIndicators = [
    { icon: 'bot', text: 'Visual Agent Builder' },
    { icon: 'workflow', text: 'Logic Branching & Loops' },
    { icon: 'network', text: 'Real-Time Monitoring' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const trustStats = [
    { value: toolCount > 0 ? `${toolCount}+` : '200+', label: demo?.tool_count_label || 'Connected Tools' },
    { value: agentCount > 0 ? `${agentCount}+` : '50+', label: demo?.agent_count_label || 'Agent Templates' },
    { value: demo?.sla_value || '99.9%', label: demo?.sla_label || 'Uptime SLA' },
  ]

  const feedHeader = demo?.feed_header || 'Live Agent Orchestration'
  const seedEvents = (demo?.seed_events ?? []) as Omit<AgentEvent, 'id'>[]
  const rollingEvents = (demo?.rolling_events ?? []) as Omit<AgentEvent, 'id' | 'ts'>[]

  const integrationCategories = [
    { Icon: Mail, label: 'Email & Communication', tools: ['Gmail', 'Outlook', 'Slack'], description: 'Email & chat platforms' },
    { Icon: Database, label: 'CRM & Sales', tools: ['Salesforce', 'HubSpot', 'Pipedrive'], description: 'Customer data systems' },
    { Icon: Calendar, label: 'Scheduling', tools: ['Google Cal', 'Calendly', 'Zoom'], description: 'Meeting & calendar tools' },
    { Icon: Cloud, label: 'Cloud Storage', tools: ['Drive', 'Dropbox', 'OneDrive'], description: 'File & document systems' },
    { Icon: Code, label: 'Dev Tools', tools: ['GitHub', 'Jira', 'REST APIs'], description: 'Development platforms' },
    { Icon: DollarSign, label: 'Finance', tools: ['Stripe', 'QuickBooks', 'Xero'], description: 'Payment & accounting' },
  ]

  const enterpriseFeatures = [
    { Icon: Lock, label: 'SOC 2 Compliant', description: 'Enterprise security' },
    { Icon: Users, label: 'Multi-Team', description: 'Collaboration tools' },
    { Icon: Activity, label: 'Real-Time', description: 'Monitoring & alerts' },
  ]

  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-24 sm:pt-20 pb-12 sm:pb-16 overflow-hidden" aria-label="Hero">
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle, oklch(0.30 0 0) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.35 }} />
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, var(--background) 0%, transparent 100%)' }} />
      
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-5 sm:gap-7 w-full">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-[oklch(0.65_0.15_145)]/30 bg-[oklch(0.65_0.15_145)]/5 backdrop-blur-sm">
          <Brain className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
          <span className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.18em] sm:tracking-[0.22em] text-[oklch(0.65_0.15_145)]">{eyebrow}</span>
        </div>

        <div className="flex flex-col items-center gap-4 sm:gap-5">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-[-0.03em] leading-[1.05] text-balance px-2 max-w-5xl">{headline}</h1>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4 py-3 sm:py-3.5 rounded-xl border-2 border-[oklch(0.65_0.15_145)]/40 bg-gradient-to-br from-[oklch(0.65_0.15_145)]/15 via-[oklch(0.65_0.15_145)]/8 to-transparent backdrop-blur-sm shadow-lg max-w-4xl">
            <div className="flex items-center gap-2">
              <Shield className="w-5 sm:w-6 h-5 sm:h-6 text-[oklch(0.65_0.15_145)] shrink-0" aria-hidden="true" />
              <span className="text-sm sm:text-base md:text-lg font-bold text-foreground tracking-tight leading-tight">Enterprise-Ready</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <Cpu className="w-5 sm:w-6 h-5 sm:h-6 text-[oklch(0.65_0.15_145)] shrink-0" aria-hidden="true" />
              <span className="text-sm sm:text-base md:text-lg font-bold text-foreground tracking-tight leading-tight">No Code Required</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <Network className="w-5 sm:w-6 h-5 sm:h-6 text-[oklch(0.65_0.15_145)] shrink-0" aria-hidden="true" />
              <span className="text-sm sm:text-base md:text-lg font-bold text-foreground tracking-tight leading-tight">200+ Integrations</span>
            </div>
          </div>
        </div>

        <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed text-pretty px-4 max-w-3xl">{subheadline}</p>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 px-4 pt-1">
          {trustIndicators.map((indicator, idx) => {
            const IconComponent = ICON_MAP[indicator.icon] || Bot
            return (
              <div key={idx} className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-muted/50 border border-border/60 backdrop-blur-sm">
                <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 text-[oklch(0.65_0.15_145)] shrink-0" aria-hidden="true" />
                <span className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap">{indicator.text}</span>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-4 px-4 pb-2">
          {enterpriseFeatures.map(({ Icon, label, description }, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-br from-[oklch(0.65_0.15_145)]/10 to-[oklch(0.65_0.15_145)]/5 border border-[oklch(0.65_0.15_145)]/30 backdrop-blur-sm">
              <Icon className="w-4 h-4 text-[oklch(0.65_0.15_145)] shrink-0" aria-hidden="true" />
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold text-foreground leading-tight">{label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{description}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="w-full max-w-5xl px-2 sm:px-4 pt-2 sm:pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            {integrationCategories.map(({ Icon, label, tools, description }) => (
              <div key={label} className="flex flex-col items-center gap-2 sm:gap-2.5 p-3 sm:p-4 rounded-xl bg-muted/40 border border-border/50 backdrop-blur-sm hover:bg-muted/60 hover:border-[oklch(0.65_0.15_145)]/40 hover:shadow-lg transition-all group cursor-pointer">
                <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-[oklch(0.65_0.15_145)]/20 to-[oklch(0.65_0.15_145)]/5 border border-[oklch(0.65_0.15_145)]/20 group-hover:border-[oklch(0.65_0.15_145)]/50 group-hover:shadow-md transition-all">