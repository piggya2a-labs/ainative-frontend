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

  const headline = hero?.hero_title || hero?.headline || 'Build AI Agents Without Code — Automate Your Team\'s Workflow in Minutes'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'The no-code platform that lets you build AI agents to handle email campaigns, CRM updates, customer support, sales outreach, and data entry. Deploy intelligent automation in minutes—no developers, no complexity, no coding required. Let AI handle the busywork while your team focuses on high-impact work.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Automating Free'
  const secondaryCtaText = hero?.secondaryCtaText || 'Browse Agent Templates'
  const eyebrow = hero?.eyebrow || 'No-Code AI Automation for Teams'

  const defaultTrustIndicators = [
    { icon: 'network', text: 'Automate email, CRM, support, and sales workflows without code' },
    { icon: 'zap', text: 'Deploy working AI agents in under 5 minutes with visual builder' },
    { icon: 'rocket', text: 'Connect to Gmail, Salesforce, Slack, HubSpot, and 50+ tools instantly' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const displayToolCount = toolCount > 0 ? toolCount : 50
  const displayAgentCount = agentCount > 0 ? agentCount : 10000

  const trustStats = [
    { value: '5 min', label: 'To First Agent', Icon: Clock },
    { value: '0', label: 'Code Required', Icon: Code },
    { value: '24/7', label: 'Automation', Icon: Network },
  ]

  const feedHeader = demo?.feed_header || 'Live: Teams Automating Work Right Now'
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
    { Icon: Network, label: 'Email Campaign Automation', description: 'Let AI agents handle your entire email workflow—from drafting personalized messages to managing sequences, processing replies, and updating your CRM automatically' },
    { Icon: Mail, label: 'CRM Data Management', description: 'Stop manual data entry forever. AI agents keep customer records clean, enriched, and synchronized across all platforms—automatically updating fields, enriching leads, and maintaining data quality' },
    { Icon: Database, label: 'Customer Support Automation', description: 'AI agents triage support tickets, auto-resolve common issues, route complex cases to the right team member, and keep your helpdesk running 24/7 without human intervention' },
  ]

  const trustBadges = [
    'No-code automation platform',
    'Deploy agents in minutes',
    'Built for email, CRM & support',
    '10,000+ teams automating daily'
  ]

  const coreValueProps = [
    { Icon: Network, label: 'Zero Code, Maximum Automation', description: 'Build sophisticated AI agents with a visual workflow builder. No programming skills required—just point, click, and watch your busywork disappear. Perfect for founders, operators, and teams who want results without hiring developers' },
    { Icon: Mail, label: 'Built for Your Daily Grind', description: 'Specifically designed to eliminate time-consuming tasks: email campaigns, CRM updates, lead qualification, customer support triage, meeting scheduling, and data entry. The boring work that\'s crushing your team\'s productivity' },
    { Icon: Code, label: 'Ready-to-Use Agent Templates', description: 'Start with pre-built agents for common workflows: sales outreach, customer onboarding, support automation, lead nurturing. Customize them to your needs in minutes, or build custom agents from scratch with our visual builder' },
  ]

  const technicalBenefits = [
    { Icon: Rocket, label: 'From Zero to Automated in 5 Minutes', description: 'No setup complexity, no API configuration, no learning curve. Choose a template or build from scratch, connect your tools with one click, and deploy working AI agents faster than writing a project brief' },
    { Icon: Brain, label: 'AI That Actually Gets Work Done', description: 'Not just chatbots or simple scripts—these are intelligent agents that understand context, make decisions, handle exceptions, and execute multi-step workflows. They work like your best employee, but 24/7 without breaks' },
    { Icon: Database, label: 'One-Click Tool Connections', description: 'Instant integration with Gmail, Salesforce, Slack, HubSpot, Google Calendar, and 50+ platforms. Your agents start working with your existing tools immediately—no technical setup, no IT team required' },
  ]

  const totalTasksAutomated = 10247
  const totalEarlyAdopters = 10000

  const keyIntegrations = [
    { Icon: Database, label: 'Salesforce', color: 'oklch(0.55 0.20 220)'