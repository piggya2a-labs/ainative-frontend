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
  const [tasksAutomated, setTasksAutomated] = useState(0)
  
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
    const targetCount = 10000
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

  useEffect(() => {
    const targetTasks = 1247
    const duration = 2200
    const steps = 55
    const increment = targetTasks / steps
    const stepDuration = duration / steps
    
    let currentStep = 0
    const interval = setInterval(() => {
      currentStep++
      setTasksAutomated(Math.min(Math.floor(increment * currentStep), targetTasks))
      if (currentStep >= steps) {
        clearInterval(interval)
      }
    }, stepDuration)
    
    return () => clearInterval(interval)
  }, [])

  const hero = siteConfig?.hero
  const demo = siteConfig?.hero_demo

  const headline = hero?.hero_title || hero?.headline || 'No-Code AI Agents for Team Automation'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Move faster without the technical barriers. Automate repetitive tasks like email campaigns, follow-up calls, and CRM updates with AI agents that work 24/7. No coding required—just point, click, and delegate work that slows your team down. Built for teams who need to scale operations without scaling headcount.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Automating Free'
  const secondaryCtaText = hero?.secondaryCtaText || 'See How It Works'
  const eyebrow = hero?.eyebrow || 'Trusted by Fast-Moving Teams'

  const defaultTrustIndicators = [
    { icon: 'network', text: 'Automate emails, calls, and CRM updates without writing code' },
    { icon: 'zap', text: 'Deploy AI agents in minutes with visual workflow builder' },
    { icon: 'rocket', text: 'Connect Gmail, Salesforce, Slack, and 50+ tools instantly' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const displayToolCount = toolCount > 0 ? toolCount : 50
  const displayAgentCount = agentCount > 0 ? agentCount : 10000

  const trustStats = [
    { value: '5 min', label: 'To First Agent', Icon: Clock },
    { value: '0', label: 'Code Required', Icon: Code },
    { value: '24/7', label: 'Automation', Icon: Network },
  ]

  const feedHeader = demo?.feed_header || 'Live: AI Agents Working for Teams Right Now'
  const seedEvents = (demo?.seed_events ?? [
    { agent: 'Email-Campaign-Agent', action: 'Drafted and sent 47 personalized emails, scheduled 12 follow-ups', status: 'done' as const, ts: '2m ago' },
    { agent: 'CRM-Sync-Agent', action: 'Updated 34 contacts in Salesforce, enriched with LinkedIn data', status: 'running' as const, ts: 'now' },
    { agent: 'Lead-Qualifier-Agent', action: 'Scored 18 new leads, routed 8 hot prospects to sales team', status: 'done' as const, ts: '5m ago' },
    { agent: 'Support-Triage-Agent', action: 'Processed 23 tickets, auto-resolved 15, escalated 8 to team', status: 'done' as const, ts: '7m ago' },
    { agent: 'Meeting-Scheduler-Agent', action: 'Booked 6 demos, sent calendar invites, updated CRM records', status: 'running' as const, ts: 'now' },
  ]) as Omit<AgentEvent, 'id'>[]
  const rollingEvents = (demo?.rolling_events ?? [
    { agent: 'Outreach-Agent', action: 'Personalizing email sequences for 42 prospects', status: 'running' as const },
    { agent: 'Data-Entry-Agent', action: 'Synced 156 records across Salesforce and HubSpot', status: 'done' as const },
    { agent: 'Follow-Up-Agent', action: 'Sent reminders to 28 prospects, logged responses', status: 'running' as const },
    { agent: 'Onboarding-Agent', action: 'Welcomed 5 new customers, scheduled kickoff calls', status: 'done' as const },
    { agent: 'Report-Generator-Agent', action: 'Compiled weekly metrics, sent dashboard to leadership', status: 'done' as const },
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
    { Icon: Network, label: 'AI Teammates for Email Campaigns', description: 'Delegate your entire email workflow to AI agents that draft personalized messages, manage sequences, process replies, and update your CRM automatically—like having a tireless marketing associate working 24/7' },
    { Icon: Mail, label: 'Intelligent CRM Data Management', description: 'Stop manual data entry forever. AI agents keep customer records clean, enriched, and synchronized across all platforms—automatically updating fields, enriching leads, and maintaining data quality while you focus on closing deals' },
    { Icon: Database, label: 'Always-On Customer Support', description: 'AI agents triage support tickets, auto-resolve common issues, route complex cases to the right team member, and keep your helpdesk running 24/7—giving your team superhuman support capacity without burning out' },
  ]

  const trustBadges = [
    'Trusted by fast-moving teams',
    'No-code automation in minutes',
    'Built for email, CRM & support',
    '10,000+ teams automating work'
  ]

  const coreValueProps = [
    { Icon: Network, label: 'Zero Code, Real Work Delegation', description: 'Build AI agents that handle actual work with a visual workflow builder. No programming skills required—just point, click, and delegate tasks that used to consume your team\'s time. Perfect for founders and operators who need to move faster without hiring' },
    { Icon: Mail, label: 'Built for Your Operational Bottlenecks', description: 'Specifically designed to eliminate time-consuming tasks that slow down fast-moving teams: email campaigns, CRM updates, lead qualification, customer support triage, meeting scheduling, and data entry. Delegate the grind, focus on growth' },
    { Icon: Code, label: 'Pre-Built Agents, Custom Workflows', description: 'Start with ready-to-use agents for common workflows: sales outreach, customer onboarding, support automation, lead nurturing. Customize them to your needs in minutes, or build custom AI teammates from scratch with our visual builder—no technical skills needed' },
  ]

  const technicalBenefits = [
    { Icon: Rocket, label: 'From Idea to Automated in 5 Minutes', description: 'No setup complexity, no API configuration, no learning curve. Choose a template or build from scratch, connect your tools with one click, and deploy working AI agents faster than scheduling a meeting. Start delegating work immediately' },
    { Icon: Brain, label: 'AI Teammates That Execute Work', description: 'Not just chatbots or simple scripts—these are intelligent agents that understand context, make decisions, handle exceptions, and execute multi-step workflows. They work like your best team member, but 24/7 without breaks, vacation, or burnout' },
    { Icon: Database, label: 'Instant Tool Connections', description: 'One-click integration with Gmail, Salesforce, Slack, HubSpot, Google Calendar, and 50+ platforms your team already uses. Your AI agents start working with your existing tools immediately—no technical setup, no IT team, no waiting' },
  ]

  return (