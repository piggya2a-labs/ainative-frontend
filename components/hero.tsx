'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Play, CheckCircle2, Loader2, Clock, Zap, Shield, Rocket } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentEvent {
  id: number
  agent: string
  action: string
  status: 'done' | 'running' | 'queued'
  ts: string
}

export interface HeroContent {
  headline?: string
  subheadline?: string
  ctaText?: string
  ctaHref?: string
  secondaryCta?: {
    text: string
    href?: string
  }
  badge?: string
  variant?: string
}

interface HeroProps {
  content?: HeroContent | null
  onCtaClick?: () => void
  onDemoClick?: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CONTENT: HeroContent = {
  headline: 'Build Autonomous AI Agents in Minutes, Not Months',
  subheadline:
    'Deploy AI agents that handle customer support, research, and operations automatically. Watch your support team handle 10x more tickets with zero manual work.',
  ctaText: 'Launch Your First Agent',
  ctaHref: '#',
  secondaryCta: {
    text: 'Watch 2-Minute Demo',
  },
  badge: 'AI-Native · No Code Required · Live in 5 Minutes',
}

const TRUST_STATS = [
  { value: '10,000+', label: 'tasks automated daily' },
  { value: '< 5 min', label: 'to first deployment' },
  { value: '99.9%', label: 'uptime SLA' },
]

const TRUST_INDICATORS = [
  { icon: Shield, text: 'No credit card required' },
  { icon: Zap, text: 'Used by 500+ teams' },
  { icon: Rocket, text: 'Deploy in <5 minutes' },
]

const SEED_EVENTS: Omit<AgentEvent, 'id'>[] = [
  { agent: 'support-agent-1', action: 'Resolved ticket #4821 — billing inquiry', status: 'done', ts: '0s ago' },
  { agent: 'research-agent-2', action: 'Summarised 14 competitor pages', status: 'done', ts: '3s ago' },
  { agent: 'ops-agent-1', action: 'Syncing CRM records with Salesforce', status: 'running', ts: 'now' },
  { agent: 'support-agent-2', action: 'Triaging #4822 — refund request', status: 'queued', ts: 'queued' },
]

const ROLLING_EVENTS: Omit<AgentEvent, 'id' | 'ts'>[] = [
  { agent: 'research-agent-1', action: 'Pulled 32 SEC filings for Q1 analysis', status: 'done' },
  { agent: 'ops-agent-2', action: 'Sent weekly digest to 1,203 subscribers', status: 'done' },
  { agent: 'support-agent-3', action: 'Classified 48 inbound emails', status: 'done' },
  { agent: 'monitor-agent-1', action: 'Detected price change on competitor site', status: 'done' },
  { agent: 'ops-agent-1', action: 'Updated inventory sheet from warehouse API', status: 'done' },
  { agent: 'research-agent-2', action: 'Generated executive brief on market trends', status: 'done' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: AgentEvent['status'] }) {
  if (status === 'done') {
    return <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
  }
  if (status === 'running') {
    return <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-foreground" aria-hidden="true" />
  }
  return <Clock className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
}

function LiveFeed() {
  const [events, setEvents] = useState<AgentEvent[]>(
    SEED_EVENTS.map((e, i) => ({ ...e, id: i }))
  )
  const counterRef = useRef(SEED_EVENTS.length)
  const rollingRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const next = ROLLING_EVENTS[rollingRef.current % ROLLING_EVENTS.length]
      rollingRef.current += 1
      const newEvent: AgentEvent = {
        ...next,
        id: counterRef.current++,
        ts: '0s ago',
      }
      setEvents((prev) => [newEvent, ...prev].slice(0, 6))
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="w-full max-w-2xl mx-auto rounded-xl border border-border bg-card overflow-hidden"
      role="log"
      aria-label="Live agent activity feed"
      aria-live="polite"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-[oklch(0.65_0.15_145)] animate-pulse"
            aria-hidden="true"
          />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Live agent activity
          </span>
        </div>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          {events.filter((e) => e.status !== 'queued').length} active
        </span>
      </div>

      {/* Event rows */}
      <ul className="divide-y divide-border">
        {events.slice(0, 5).map((event) => (
          <li
            key={event.id}
            className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
          >
            <StatusIcon status={event.status} />
            <span className="font-mono text-xs text-muted-foreground w-32 shrink-0 truncate">
              {event.agent}
            </span>
            <span className="flex-1 text-foreground truncate text-xs leading-relaxed">
              {event.action}
            </span>
            <span className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums">
              {event.ts}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function Hero({ content, onCtaClick, onDemoClick }: HeroProps) {
  const c = { ...DEFAULT_CONTENT, ...content }

  return (
    <section
      className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 overflow-hidden"
      aria-label="Hero"
    >
      {/* Dot-grid background */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle, oklch(0.30 0 0) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.35,
        }}
      />
      {/* Radial fade — punches a dark hole in the centre */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 45%, var(--background) 0%, transparent 100%)',
        }}
      />

      <div className="max-w-4xl mx-auto flex flex-col items-center gap-10">
        {/* Eyebrow */}
        <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
          {c.badge}
        </p>

        {/* Headline - Value-First Messaging */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.1] text-balance">
          {c.headline}
        </h1>

        {/* Subtitle - Benefit-Driven with Use Case */}
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed text-pretty">
          {c.subheadline}
        </p>

        {/* CTA row - Action-Oriented */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
          <Button
            size="lg"
            asChild={!!c.ctaHref && c.ctaHref !== '#'}
            className="h-12 px-8 text-base font-semibold tracking-tight transition-all hover:opacity-90 active:scale-[0.98] group"
            onClick={onCtaClick}
          >
            <a href={c.ctaHref ?? '#'}>
              {c.ctaText}
              <ArrowRight
                className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform"
                aria-hidden="true"
              />
            </a>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 px-7 text-base font-medium group"
            onClick={onDemoClick}
          >
            <Play
              className="w-4 h-4 mr-2 fill-current opacity-60 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            />
            {c.secondaryCta?.text || 'Watch Demo'}
          </Button>
        </div>

        {/* Trust Indicators - Lower Activation Barriers */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-6 w-full max-w-2xl">
          {TRUST_INDICATORS.map((indicator) => {
            const Icon = indicator.icon
            return (
              <div key={indicator.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="w-4 h-4 shrink-0 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
                <span>{indicator.text}</span>
              </div>
            )
          })}
        </div>

        {/* Trust stats */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-2 w-full max-w-md">
          {TRUST_STATS.map((stat, i) => (
            <div key={stat.label} className="flex flex-col items-center gap-0.5">
              {i > 0 && (
                <div className="hidden sm:block absolute" aria-hidden="true" />
              )}
              <span className="text-2xl font-bold tracking-tight tabular-nums">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Live agent feed */}
        <div className="w-full pt-4">
          <LiveFeed />
        </div>
      </div>
    </section>
  )
}