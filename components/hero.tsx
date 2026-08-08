'use client'
import { Button } from '@/components/ui/button'
import { ArrowRight, Play, Shield, Zap, Rocket, CheckCircle2, Loader2, Clock, Network, Bot, Workflow, Database, Mail, MessageSquare, Calendar, Code, Sparkles, LayoutTemplate, Brain, Cpu, GitBranch, Link2, Cloud, Smartphone, FileText, DollarSign, Lock, Users, Activity, Award, Star, TrendingUp, CreditCard } from 'lucide-react'
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
    <div className="w-full rounded-xl border border-border/60 bg-background/60 backdrop-blur-sm overflow-hidden text-left shadow-lg shadow-purple-500/5 hover:shadow-purple-500/10 transition-shadow duration-300">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border/40 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-purple-500/5">
        <span className="text-[10px] sm:text-xs font-mono text-muted-foreground uppercase tracking-wider">{feedHeader}</span>
        <span className="flex items-center gap-1.5 text-[10px] sm:text-xs text-[oklch(0.65_0.15_145)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.15_145)] animate-pulse" />
          {activeCount} active
        </span>
      </div>
      <ul className="divide-y divide-border">
        {events.slice(0, 5).map((event) => (
          <li key={event.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-sm transition-all duration-200 hover:bg-muted/30">
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
  const [socialProofCount, setSocialProofCount] = useState(0)
  const [automatedHours, setAutomatedHours] = useState(0)
  
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

  useEffect(() => {
    const targetCount = 1000
    const duration = 2000
    const steps = 60
    const increment = targetCount / steps
    const stepDuration = duration / steps
    
    let currentStep = 0
    const interval = setInterval(() => {
      currentStep++
      setSocialProofCount(Math.min(Math.floor(increment * currentStep), targetCount))
      if (currentStep >= steps) {
        clearInterval(interval)
      }
    }, stepDuration)
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const targetHours = 127
    const duration = 2500
    const steps = 50
    const increment = targetHours / steps
    const stepDuration = duration / steps
    
    let currentStep = 0
    const interval = setInterval(() => {
      currentStep++
      setAutomatedHours(Math.min(Math.floor(increment * currentStep), targetHours))
      if (currentStep >= steps) {
        clearInterval(interval)
      }
    }, stepDuration)
    
    return () => clearInterval(interval)
  }, [])

  const hero = siteConfig?.hero
  const demo = siteConfig?.hero_demo

  const headline = hero?.hero_title || hero?.headline || 'No-Code AI Agent Platform for Team Automation'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Automate emails, calls, CRM updates, and outbound sales without writing code. Visual workflow builder lets anyone create AI agents that handle repetitive tasks 24/7.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Automating Free'
  const secondaryCtaText = hero?.secondaryCtaText || 'Browse Pre-Built Agents'
  const eyebrow = hero?.eyebrow || 'No-Code AI Automation Platform'
  const secondaryBenefitLine = 'Join teams automating workflows in minutes'

  const defaultTrustIndicators = [
    { icon: 'zap', text: 'Visual workflow builder—no coding' },
    { icon: 'workflow', text: '50+ pre-built AI agents ready' },
    { icon: 'shield', text: 'SOC 2 Type II certified security' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const displayToolCount = toolCount > 0 ? toolCount : 50
  const displayAgentCount = agentCount > 0 ? agentCount : 1000

  const trustStats = [
    { value: '5 min', label: 'Setup Time', Icon: Clock },
    { value: 'SOC 2', label: 'Certified', Icon: Shield },
    { value: '0', label: 'Code Needed', Icon: Zap },
  ]

  const feedHeader = demo?.feed_header || 'Live: AI Agents Automating Work Right Now'
  const seedEvents = (demo?.seed_events ?? [
    { agent: 'Email-Agent-23', action: 'Sent 8 personalized outbound sales emails', status: 'done' as const, ts: '2m ago' },
    { agent: 'CRM-Agent-47', action: 'Updated 12 Salesforce contacts automatically', status: 'done' as const, ts: '5m ago' },
    { agent: 'Support-Agent-91', action: 'Responding to 3 customer support tickets', status: 'running' as const, ts: 'now' },
    { agent: 'Lead-Agent-64', action: 'Enriched 15 leads from LinkedIn', status: 'done' as const, ts: '8m ago' },
    { agent: 'Outreach-Agent-12', action: 'Processing new inbound inquiries', status: 'running' as const, ts: 'now' },
  ]) as Omit<AgentEvent, 'id'>[]
  const rollingEvents = (demo?.rolling_events ?? [
    { agent: 'Email-Agent-45', action: 'Automating email follow-up sequences', status: 'running' as const },
    { agent: 'CRM-Agent-78', action: 'Syncing deal stages across CRM systems', status: 'done' as const },
    { agent: 'Sales-Agent-33', action: 'Qualifying outbound sales leads', status: 'done' as const },
    { agent: 'Support-Agent-56', action: 'Triaging customer support requests', status: 'running' as const },
    { agent: 'Data-Agent-89', action: 'Enriching contact information automatically', status: 'done' as const },
  ]) as Omit<AgentEvent, 'id' | 'ts'>[]

  const integrationCategories = [
    { Icon: Database, label: 'CRM & Sales', tools: ['Salesforce', 'HubSpot', 'Pipedrive'], description: 'Customer relationship systems' },
    { Icon: Mail, label: 'Email & Communication', tools: ['Gmail', 'Outlook', 'Slack'], description: 'Email & messaging platforms' },
    { Icon: Calendar, label: 'Scheduling & Meetings', tools: ['Google Cal', 'Calendly', 'Zoom'], description: 'Calendar & meeting tools' },
    { Icon: Cloud, label: 'Cloud Storage', tools: ['Drive', 'Dropbox', 'OneDrive'], description: 'Document management' },
    { Icon: Code, label: 'Dev & Project Tools', tools: ['GitHub', 'Jira', 'REST APIs'], description: 'Development platforms' },
    { Icon: DollarSign, label: 'Finance & Payments', tools: ['Stripe', 'QuickBooks', 'Xero'], description: 'Accounting & billing' },
  ]

  const enterpriseFeatures = [
    { Icon: Shield, label: 'Enterprise-Grade Security', description: 'SOC 2 Type II certified infrastructure' },
    { Icon: Users, label: 'Team Collaboration', description: 'Multi-agent workspaces for teams' },
    { Icon: Activity, label: 'Real-Time Automation', description: 'Live autonomous task execution' },
  ]

  const trustBadges = [
    'SOC 2 Type II certified',
    'Visual workflow builder',
    'Pre-built AI agents included',
    'No coding skills required'
  ]

  const coreValueProps = [
    { Icon: Mail, label: 'Email Automation & Outreach', description: 'AI agents write personalized emails, automate follow-ups, and manage outbound sales campaigns—completely hands-off' },
    { Icon: Database, label: 'Automated CRM Updates', description: 'Keep Salesforce, HubSpot, or Pipedrive synced automatically—contacts enriched, deals updated, data always current' },
    { Icon: MessageSquare, label: 'Customer Support Automation', description: 'Agents handle ticket triage, respond to FAQs, and escalate complex issues—24/7 support without hiring more staff' },
  ]

  const technicalBenefits = [
    { Icon: LayoutTemplate, label: 'Visual Workflow Builder', description: 'Drag-and-drop interface anyone can use—build complex automations without writing code or technical training' },
    { Icon: Bot, label: 'Pre-Built AI Agents Ready', description: 'Start with battle-tested agent templates for common tasks—customize them in minutes or use them as-is' },
    { Icon: Workflow, label: 'Works With Your Tools', description: 'Integrates with Gmail, Salesforce, Slack, Google Calendar, and 50+ tools your team already uses daily' },
  ]

  const totalTasksAutomated = 10247
  const totalEarlyAdopters = 1000

  const keyIntegrations = [
    { Icon: Database, label: 'Salesforce', color: 'oklch(0.55 0.20 220)' },
    { Icon: Mail, label: 'Gmail', color: 'oklch(0.60 0.18 25)' },
    { Icon: Calendar, label: 'Google Calendar', color: 'oklch(0.58 0.15 145)' },
    { Icon: MessageSquare, label: 'Slack', color: 'oklch(0.52 0.22 285)' },
    { Icon: Code, label: 'GitHub', color: 'oklch(0.35 0.02 270)' },
    { Icon: Cloud, label: 'Drive', color: 'oklch(0.62 0.16 50)' },
  ]

  const keyDifferentiators = [
    { Icon: LayoutTemplate, label: 'True No-Code Platform', description: 'Visual workflow builder makes AI agent creation accessible to everyone—no developers, no coding, no complexity', color: 'oklch(0.58_0.15_145)' },
    { Icon: Bot, label: 'Pre-Built Agent Library', description: 'Start with ready-made AI agents for email, CRM, sales, and support—customize or deploy in minutes', color: 'oklch(0.60_0.18_25)' },
    { Icon: Shield, label: 'Enterprise Security Built-In', description: 'SOC 2 Type II certified infrastructure ensures your data is protected with enterprise-grade security', color: 'oklch(0.65_0.15_270)' },
  ]

  const automationUseCases = [
    { icon: Mail, text: 'Email Automation' },
    { icon: Database, text: 'CRM Updates' },
    { icon: Rocket, text: 'Outbound Sales' },
    { icon: MessageSquare, text: 'Customer Support' }
  ]

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg