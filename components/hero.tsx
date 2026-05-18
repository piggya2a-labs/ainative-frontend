'use client'
import { Button } from '@/components/ui/button'
import { ArrowRight, Play, CheckCircle2, Loader2, Clock, Shield, Zap, Rocket } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SiteConfig } from '@/lib/sanity-schema'

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Constants ────────────────────────────────────────────────────────────────
const TRUST_INDICATORS = [
  { icon: Shield, text: '无需信用卡' },
  { icon: Zap, text: '5 分钟内上线' },
  { icon: Rocket, text: 'Agent 团队 24/7 在线' },
]

const SEED_EVENTS: Omit<AgentEvent, 'id'>[] = [
  { agent: 'l1-orchestrator', action: '拆解任务：季度竞品分析报告', status: 'done', ts: '0s ago' },
  { agent: 'l2-research', action: '抓取 14 个竞品页面并结构化', status: 'done', ts: '3s ago' },
  { agent: 'l2-writer', action: '生成执行摘要草稿', status: 'running', ts: 'now' },
  { agent: 'l3-reviewer', action: '等待审核：draft_v1.md', status: 'queued', ts: 'queued' },
]

const ROLLING_EVENTS: Omit<AgentEvent, 'id' | 'ts'>[] = [
  { agent: 'l2-analyst', action: '处理 32 份 SEC 文件', status: 'done' },
  { agent: 'l2-ops', action: '向 1,203 名订阅者发送周报', status: 'done' },
  { agent: 'l3-classifier', action: '分类 48 封入站邮件', status: 'done' },
  { agent: 'l2-monitor', action: '检测到竞品价格变动', status: 'done' },
  { agent: 'l2-ops', action: '从仓库 API 更新库存表', status: 'done' },
  { agent: 'l1-orchestrator', action: '生成市场趋势执行简报', status: 'done' },
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
        ts: 'just now',
      }
      setEvents((prev) => [newEvent, ...prev].slice(0, 5))
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  const activeCount = events.filter((e) => e.status === 'running').length

  return (
    <div className="w-full rounded-xl border border-border/60 bg-background/60 backdrop-blur-sm overflow-hidden text-left">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/30">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          agent activity
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[oklch(0.65_0.15_145)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.15_145)] animate-pulse" />
          {activeCount} active
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
export function Hero({ siteConfig, agentCount = 0, toolCount = 0, onCtaClick, onDemoClick }: HeroProps) {
  const hero = siteConfig?.hero

  const headline = hero?.hero_title || hero?.headline || 'AI Agent 团队 24/7 为你的业务工作'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'ONIT 让复杂业务流程自动化。无需编码，无需管理，Agent 团队独立完成从分析到执行的全链路工作。'
  const ctaText = hero?.ctaText || hero?.hero_cta || '开始使用'
  const secondaryCtaText = hero?.secondaryCtaText || '了解更多'

  // 真实数字：从 Supabase 读取
  const trustStats = [
    { value: agentCount > 0 ? `${agentCount}` : '—', label: '个 Agent 在线' },
    { value: toolCount > 0 ? `${toolCount}` : '—', label: '个 Capability 工具' },
    { value: '99.9%', label: '可用性 SLA' },
  ]

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
      {/* Radial fade */}
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
          AI Native · 无需编码 · 5 分钟上线
        </p>
        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.1] text-balance">
          {headline}
        </h1>
        {/* Subtitle */}
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed text-pretty">
          {subheadline}
        </p>
        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
          <Button
            size="lg"
            className="h-12 px-8 text-base font-semibold tracking-tight transition-all hover:opacity-90 active:scale-[0.98] group"
            onClick={onCtaClick}
          >
            {ctaText}
            <ArrowRight
              className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform"
              aria-hidden="true"
            />
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
            {secondaryCtaText}
          </Button>
        </div>
        {/* Trust Indicators */}
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
        {/* Trust stats — 真实数字 */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-2 w-full max-w-md">
          {trustStats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-0.5">
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
