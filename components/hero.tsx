'use client'
import { Button } from '@/components/ui/button'
import { ArrowRight, Play, Shield, Zap, Rocket, CheckCircle2, Loader2, Clock, Network, Bot, Workflow, Database, Mail, MessageSquare, Calendar, Code, Sparkles, LayoutTemplate, Brain, Cpu, GitBranch, Link2, Cloud, Smartphone, FileText, DollarSign, Lock, Users, Activity, Award, Star, TrendingUp } from 'lucide-react'
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

  const headline = hero?.hero_title || hero?.headline || 'Build AI Agents Without Code'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Automate emails, CRM updates, sales outreach, and data entry tasks. Deploy intelligent AI agents in minutes—no technical skills required.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Automating Today - Free'
  const secondaryCtaText = hero?.secondaryCtaText || 'Watch Demo'
  const eyebrow = hero?.eyebrow || 'No-Code AI Agent Platform'

  const defaultTrustIndicators = [
    { icon: 'network', text: '100+ Tool Integrations' },
    { icon: 'bot', text: 'Memory-Enabled Agents' },
    { icon: 'workflow', text: 'Multi-Agent Orchestration' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const displayToolCount = toolCount > 0 ? toolCount : 100
  const displayAgentCount = agentCount > 0 ? agentCount : 2847

  const trustStats = [
    { value: '20hrs', label: 'Saved Per Week Per User', Icon: Clock },
    { value: '5min', label: 'To Deploy First Agent', Icon: Zap },
    { value: '100+', label: 'Tools & Integrations', Icon: Network },
  ]

  const feedHeader = demo?.feed_header || 'Live: Your AI Agents Working Now'
  const seedEvents = (demo?.seed_events ?? []) as Omit<AgentEvent, 'id'>[]
  const rollingEvents = (demo?.rolling_events ?? []) as Omit<AgentEvent, 'id' | 'ts'>[]

  const integrationCategories = [
    { Icon: Database, label: 'CRM & Sales', tools: ['Salesforce', 'HubSpot', 'Pipedrive'], description: 'Customer relationship systems' },
    { Icon: Mail, label: 'Email & Communication', tools: ['Gmail', 'Outlook', 'Slack'], description: 'Email & messaging platforms' },
    { Icon: Calendar, label: 'Scheduling & Meetings', tools: ['Google Cal', 'Calendly', 'Zoom'], description: 'Calendar & meeting tools' },
    { Icon: Cloud, label: 'Cloud Storage', tools: ['Drive', 'Dropbox', 'OneDrive'], description: 'Document management' },
    { Icon: Code, label: 'Dev & Project Tools', tools: ['GitHub', 'Jira', 'REST APIs'], description: 'Development platforms' },
    { Icon: DollarSign, label: 'Finance & Payments', tools: ['Stripe', 'QuickBooks', 'Xero'], description: 'Accounting & billing' },
  ]

  const enterpriseFeatures = [
    { Icon: Lock, label: 'SOC 2 Type II', description: 'Enterprise security certified' },
    { Icon: Users, label: 'Team Workspaces', description: 'Multi-tenant collaboration' },
    { Icon: Activity, label: 'Real-Time Monitoring', description: 'Live agent activity tracking' },
  ]

  const trustBadges = [
    'No credit card required',
    'Free to start',
    'No coding skills needed',
    'Cancel anytime'
  ]

  const coreValueProps = [
    { Icon: Mail, label: 'Email Autopilot', description: 'AI agents read, prioritize, and respond to emails based on your style' },
    { Icon: Calendar, label: 'Smart Scheduling', description: 'Book meetings, send reminders, and handle calendar conflicts automatically' },
    { Icon: Database, label: 'CRM on Autopilot', description: 'Update contacts, log interactions, and sync data across your sales stack' },
  ]

  const technicalBenefits = [
    { Icon: Bot, label: 'Outbound Sales', description: 'Research leads, personalize outreach, and follow up intelligently' },
    { Icon: MessageSquare, label: 'Customer Support', description: 'Answer common questions and escalate complex issues to your team' },
    { Icon: FileText, label: 'Data Entry', description: 'Extract info from emails, docs, and forms into your systems automatically' },
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

  const keyDifferentiators = [
    { Icon: Zap, label: 'Zero Code Required', description: 'Build powerful agents without writing a single line of code', color: 'oklch(0.65_0.15_145)' },
    { Icon: Brain, label: 'Learns Your Style', description: 'Agents adapt to your preferences and improve over time', color: 'oklch(0.60_0.18_25)' },
    { Icon: Network, label: 'Works Everywhere', description: 'Connect to 100+ tools across your entire workflow', color: 'oklch(0.58_0.15_145)' },
  ]

  const automationUseCases = [
    { icon: Mail, text: 'Email Automation' },
    { icon: Database, text: 'CRM Updates' },
    { icon: Calendar, text: 'Meeting Scheduling' },
    { icon: Bot, text: 'Sales Outreach' }
  ]

  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-20 sm:pt-24 pb-12 sm:pb-20 overflow-hidden" aria-label="Hero">
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle, oklch(0.30 0 0) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.35 }} />
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, var(--background) 0%, transparent 100%)' }} />
      
      <div className={`max-w-7xl mx-auto flex flex-col items-center gap-8 sm:gap-12 w-full transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="flex flex-col items-center gap-6 sm:gap-8 max-w-5xl">
          <div className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border border-[oklch(0.65_0.15_145)]/30 bg-[oklch(0.65_0.15_145)]/5 backdrop-blur-sm transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <Sparkles className="w-4 sm:w-4.5 h-4 sm:h-4.5 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[oklch(0.65_0.15_145)]">{eyebrow}</span>
          </div>

          <div className={`flex flex-col items-center gap-6 sm:gap-7 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h1 className="text-[2.5rem] leading-[1.1] sm:text-6xl sm:leading-[1.08] md:text-7xl lg:text-[5.5rem] xl:text-[6.5rem] font-bold tracking-tight px-2">
              <span className="bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                {headline}
              </span>
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl leading-relaxed sm:leading-relaxed px-2 sm:px-4">
              {subheadline}
            </p>
          </div>

          <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[oklch(0.65_0.15_145)]/10 border border-[oklch(0.65_0.15_145)]/20 transition-all duration-700 delay-250 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <Activity className="w-4 h-4 text-[oklch(0.65_0.15_145)]" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">
              <span className="text-[oklch(0.65_0.15_145)] font-bold">{displayAgentCount.toLocaleString()}</span> agents actively automating tasks right now
            </span>
          </div>

          <div className={`flex flex-