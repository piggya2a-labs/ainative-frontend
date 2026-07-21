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
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border/40 bg-muted/30">
        <span className="text-[10px] sm:text-xs font-mono text-muted-foreground uppercase tracking-wider">{feedHeader}</span>
        <span className="flex items-center gap-1.5 text-[10px] sm:text-xs text-[oklch(0.65_0.15_145)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.15_145)] animate-pulse" />
          {activeCount} active
        </span>
      </div>
      <ul className="divide-y divide-border">
        {events.slice(0, 5).map((event) => (
          <li key={event.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-sm transition-colors">
            <StatusIcon status={event.status} />
            <span className="font-mono text-[10px] sm:text-xs text-muted-foreground w-20 sm:w-32 shrink-0 truncate">{event.agent}</span>
            <span className="flex-1 text-foreground truncate text-[10px] sm:text-xs leading-relaxed">{event.action}</span>
            <span className="text-[10px] sm:text-xs font-mono text-muted-foreground shrink-0 tabular-nums hidden sm:inline">{event.ts}</span>
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

  const headline = hero?.hero_title || hero?.headline || 'AI Agents That Work For Your Team'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Delegate repetitive tasks to intelligent AI agents. Automate email outreach, CRM updates, outbound sales, and customer follow-ups—without writing a single line of code.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Automating Now'
  const secondaryCtaText = hero?.secondaryCtaText || 'Watch Demo'
  const eyebrow = hero?.eyebrow || 'No-Code AI Agent Platform'

  const defaultTrustIndicators = [
    { icon: 'bot', text: 'Delegate Tasks to AI' },
    { icon: 'network', text: 'Zero Coding Required' },
    { icon: 'shield', text: 'Enterprise-Ready Platform' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const displayToolCount = toolCount > 0 ? toolCount : 50
  const displayAgentCount = agentCount > 0 ? agentCount : 10000

  const trustStats = [
    { value: '5min', label: 'To Delegate Your First Task', Icon: Zap },
    { value: '20hrs', label: 'Saved Per Week Per Team', Icon: Clock },
    { value: '50+', label: 'Built-In Integrations', Icon: Network },
  ]

  const feedHeader = demo?.feed_header || 'Live: Your AI Team in Action'
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
    'Zero coding required',
    'Cancel anytime'
  ]

  const coreValueProps = [
    { Icon: Mail, label: 'Email Delegation', description: 'AI agents compose, personalize, and send emails on your behalf automatically' },
    { Icon: Database, label: 'CRM Automation', description: 'Delegate contact updates, activity logging, and data entry to AI workers' },
    { Icon: Bot, label: 'Outbound Sales', description: 'AI agents research leads, craft messages, and execute follow-up sequences for you' },
  ]

  const technicalBenefits = [
    { Icon: MessageSquare, label: 'Support Automation', description: 'AI handles ticket routing, FAQs, and escalation decisions automatically' },
    { Icon: Calendar, label: 'Meeting Management', description: 'Agents schedule meetings, send reminders, and log call notes without your input' },
    { Icon: FileText, label: 'Data Processing', description: 'Extract and organize information from emails, PDFs, and forms into your systems' },
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
    { Icon: Bot, label: 'No-Code Delegation', description: 'Point, click, and delegate—build AI agents that handle tasks without technical skills', color: 'oklch(0.58_0.15_145)' },
    { Icon: Workflow, label: 'Multi-Agent Teams', description: 'AI agents collaborate and divide complex workflows automatically', color: 'oklch(0.60_0.18_25)' },
    { Icon: Network, label: 'Universal Connections', description: 'Connect to any tool instantly with 50+ pre-built integrations', color: 'oklch(0.65_0.15_145)' },
  ]

  const automationUseCases = [
    { icon: Mail, text: 'Delegate Emails' },
    { icon: Database, text: 'Automate CRM' },
    { icon: Calendar, text: 'Schedule Meetings' },
    { icon: Bot, text: 'Run Outreach' }
  ]

  const platformCapabilities = [
    { Icon: Bot, label: 'Autonomous Agents', description: 'Deploy AI workers that execute tasks independently', color: 'oklch(0.65_0.15_270)' },
    { Icon: Workflow, label: 'Visual Workflow Builder', description: 'Drag-and-drop task delegation—no coding required', color: 'oklch(0.60_0.18_25)' },
    { Icon: Network, label: 'Deep Integrations', description: 'Native connections to CRM, email, and productivity tools', color: 'oklch(0.58_0.15_145)' },
  ]

  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-16 sm:pt-20 md:pt-24 pb-8 sm:pb-12 md:pb-20 overflow-hidden" aria-label="Hero">
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle, oklch(0.30 0 0) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.35 }} />
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, oklch(0.30 0.08 270) 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 50% 60%, oklch(0.25 0.10 250) 0%, transparent 60%)' }} />
      
      <div className={`max-w-7xl mx-auto flex flex-col items-center gap-6 sm:gap-8 md:gap-10 w-full transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="flex flex-col items-center gap-4 sm:gap-6 md:gap-7 max-w-5xl w-full">
          <div className={`flex items-center gap-2 px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 backdrop-blur-sm transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <Bot className="w-3.5 sm:w-4 md:w-4.5 h-3.5 sm:h-4 md:h-4.5 text-purple-400" aria-hidden="true" />
            <span className="text-[10px] sm:text-xs md:text-sm font-semibold uppercase tracking-[0.15em] sm:tracking-[0.18em] md:tracking-[0.2em] bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">{eyebrow}</span>
          </div>

          <div className={`flex flex-col items-center gap-4 sm:gap-5 md:gap-6 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h1 className="text-[2.25rem] leading-[1.1] sm:text-5xl sm:leading-[1.08] md:text-6xl md: