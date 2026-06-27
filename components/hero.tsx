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
  const [isVisible, setIsVisible] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    
    const handleScroll = () => {
      if (window.scrollY > 50 && !hasScrolled) {
        setHasScrolled(true)
      }
    }
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [hasScrolled])

  const hero = siteConfig?.hero
  const demo = siteConfig?.hero_demo

  const headline = hero?.hero_title || hero?.headline || 'AI Agents That Work Across Your Entire Tech Stack'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Deploy intelligent agents with persistent memory, multi-agent collaboration, and seamless integration across 100+ tools—Gmail, Salesforce, Slack, GitHub, and your entire ecosystem. No custom API development required.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Deploy Your First Integrated Agent'
  const secondaryCtaText = hero?.secondaryCtaText || 'See Multi-Agent Workflows'
  const eyebrow = hero?.eyebrow || 'Enterprise AI Agent Platform'

  const defaultTrustIndicators = [
    { icon: 'network', text: 'Seamless Tool Integration' },
    { icon: 'bot', text: 'Memory & Context Retention' },
    { icon: 'workflow', text: 'Multi-Agent Collaboration' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const displayToolCount = toolCount > 0 ? toolCount : 100

  const trustStats = [
    { value: `${displayToolCount}+`, label: demo?.tool_count_label || 'Tool Integrations' },
    { value: agentCount > 0 ? `${agentCount}+` : '50+', label: demo?.agent_count_label || 'Pre-Built Agents' },
    { value: demo?.sla_value || '99.9%', label: demo?.sla_label || 'Uptime SLA' },
  ]

  const feedHeader = demo?.feed_header || 'Live Agent Activity'
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

  const trustBadges = [
    'No credit card required',
    'Setup in under 5 minutes',
    'Zero custom API coding',
    'SOC 2 Type II certified'
  ]

  const coreValueProps = [
    { Icon: Link2, label: '100+ Native Integrations', description: 'CRM, email, calendar, databases—all connected out of the box' },
    { Icon: Brain, label: 'Persistent Memory', description: 'Agents remember context across conversations and sessions' },
    { Icon: Workflow, label: 'Multi-Agent Teams', description: 'Orchestrate specialized agents that collaborate in real-time' },
  ]

  const technicalBenefits = [
    { Icon: Code, label: 'Zero API Development', description: 'Pre-built connectors for Salesforce, Gmail, Slack, GitHub' },
    { Icon: Database, label: 'Stateful Context', description: 'Conversation history and user preferences persist automatically' },
    { Icon: GitBranch, label: 'Agent Orchestration', description: 'Coordinate multiple agents with shared memory and workflows' },
  ]

  const totalTasksAutomated = 10247
  const totalEarlyAdopters = 1247

  const keyIntegrations = [
    { Icon: Database, label: 'Salesforce', color: 'oklch(0.55 0.20 220)' },
    { Icon: Mail, label: 'Gmail', color: 'oklch(0.60 0.18 25)' },
    { Icon: Calendar, label: 'Google Calendar', color: 'oklch(0.58 0.15 145)' },
    { Icon: MessageSquare, label: 'Slack', color: 'oklch(0.52 0.22 285)' },
    { Icon: Code, label: 'GitHub', color: 'oklch(0.35 0.02 270)' },
    { Icon: Cloud, label: 'Drive', color: 'oklch(0.62 0.16 50)' },
  ]

  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-3 sm:px-6 pt-20 sm:pt-20 pb-10 sm:pb-16 overflow-hidden" aria-label="Hero">
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle, oklch(0.30 0 0) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.35 }} />
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, var(--background) 0%, transparent 100%)' }} />
      
      <div className={`max-w-7xl mx-auto flex flex-col items-center gap-5 sm:gap-8 w-full transition-all duration-1000 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <div className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-[oklch(0.65_0.15_145)]/30 bg-[oklch(0.65_0.15_145)]/5 backdrop-blur-sm transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <Network className="w-3 sm:w-4 h-3 sm:h-4 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
            <span className="text-[9px] sm:text-xs font-mono uppercase tracking-[0.15em] sm:tracking-[0.22em] text-[oklch(0.65_0.15_145)]">{eyebrow}</span>
          </div>

          <div className={`flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border border-[oklch(0.65_0.15_145)]/20 bg-gradient-to-r from-[oklch(0.65_0.15_145)]/5 to-transparent backdrop-blur-md transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <div className="flex items-center gap-1.5">
              <Link2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">100+ integrations</span>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <Brain className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">Persistent memory</span>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <Workflow className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">Multi-agent orchestration</span>
            </div>
          </div>
        </div>

        <div className={`flex flex-col items-center gap-4 sm:gap-6 transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-[2rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-[-0.03em] sm:leading-[1.05] text-balance px-1 sm:px-2 max-w-5xl">
            {headline}
          </h1>
          
          <div className={`flex flex-col items-center gap-4 sm:gap-5 transition-all duration-1000 delay-600 ${isVisible ? 'opacity-