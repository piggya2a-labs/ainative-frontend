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

  const headline = hero?.hero_title || hero?.headline || 'Build Enterprise-Grade AI Agents Without Code'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Create sophisticated AI agents with complex workflows, conditional logic, and branching. Real-time monitoring, multi-team collaboration, and enterprise-grade security—no programming required. Deploy intelligent automation across your entire business system.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Building Agents'
  const secondaryCtaText = hero?.secondaryCtaText || 'Watch Demo'
  const eyebrow = hero?.eyebrow || 'No-Code AI Agent Platform'

  const defaultTrustIndicators = [
    { icon: 'network', text: 'Multi-Agent Collaboration' },
    { icon: 'workflow', text: 'Cross-Platform Context' },
    { icon: 'bot', text: '50+ Tool Integrations' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const trustStats = [
    { value: toolCount > 0 ? `${toolCount}+` : '50+', label: demo?.tool_count_label || 'Tool Integrations' },
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
    'Join 1000+ early adopters',
    'No credit card required',
    'Setup in under 5 minutes',
    'Enterprise-grade security'
  ]

  const coreValueProps = [
    { Icon: GitBranch, label: 'Complex Workflows with Logic & Branching', description: 'Build sophisticated automation with conditional paths, loops, and decision trees—no coding required' },
    { Icon: Activity, label: 'Real-Time Monitoring & Multi-Team Collaboration', description: 'Track agent performance live, share workflows across teams, and collaborate on automation at scale' },
    { Icon: Shield, label: 'Enterprise-Grade Security & Compliance', description: 'SOC 2 compliant platform with role-based access, audit logs, and industry-leading data protection' },
  ]

  const totalTasksAutomated = 10247
  const totalEarlyAdopters = 1247

  const keyIntegrations = [
    { Icon: Database, label: 'CRM' },
    { Icon: Mail, label: 'Email' },
    { Icon: Calendar, label: 'Calendar' },
    { Icon: Cloud, label: 'Database' },
  ]

  const displayToolCount = toolCount > 0 ? toolCount : 50

  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-3 sm:px-6 pt-20 sm:pt-20 pb-10 sm:pb-16 overflow-hidden" aria-label="Hero">
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle, oklch(0.30 0 0) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.35 }} />
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, var(--background) 0%, transparent 100%)' }} />
      
      <div className={`max-w-6xl mx-auto flex flex-col items-center gap-5 sm:gap-8 w-full transition-all duration-1000 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <div className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-[oklch(0.65_0.15_145)]/30 bg-[oklch(0.65_0.15_145)]/5 backdrop-blur-sm transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <Code className="w-3 sm:w-4 h-3 sm:h-4 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
            <span className="text-[9px] sm:text-xs font-mono uppercase tracking-[0.15em] sm:tracking-[0.22em] text-[oklch(0.65_0.15_145)]">{eyebrow}</span>
          </div>

          <div className={`flex items-center gap-2 sm:gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border-2 border-[oklch(0.65_0.15_145)]/50 bg-gradient-to-r from-[oklch(0.65_0.15_145)]/20 via-[oklch(0.65_0.15_145)]/10 to-transparent backdrop-blur-md shadow-lg transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <Shield className="w-4 sm:w-5 h-4 sm:h-5 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
            <span className="text-xs sm:text-sm font-bold text-foreground tracking-tight">Enterprise-Grade</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">SOC 2 Compliant</span>
            <span className="hidden sm:inline text-xs text-muted-foreground">•</span>
            <span className="hidden sm:inline text-xs text-muted-foreground">No Code Required</span>
          </div>
        </div>

        <div className={`flex flex-col items-center gap-4 sm:gap-6 transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-[2rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-[-0.03em] sm:leading-[1.05] text-balance px-1 sm:px-2 max-w-5xl">
            {headline}
          </h1>
          
          <p className="text-sm leading-relaxed sm:text-lg md:text-xl text-muted-foreground sm:leading-relaxed text-pretty px-3 sm:px-4 max-w-3xl font-medium">
            {subheadline}
          </p>

          <div className={`grid grid-cols-1 gap-3 sm:gap-3.5 px-3 sm:px-4 py-4 sm:py-5 rounded-xl border-2 border-[oklch(0.65_0.15_145)]/40 bg-gradient-to-br from-[oklch(0.65_0.15_145)]/15 via-[oklch(0.65_0.15_145)]/8 to-transparent backdrop-blur-sm shadow-lg max-w-4xl w-full transition-all duration-1000 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {coreValueProps.map(({ Icon, label, description }, idx) => (
              <div 
                key={idx} 
                className={`flex items-start gap-3 sm:gap-3.5 py-1 sm:py-0 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                style={{ transitionDelay: `${800 + idx * 150}ms` }}
              >
                <div className="shrink-0 mt-0.5">
                  <Icon className="w-6 sm:w-7 h-6 sm:h-7 text-[oklch(0