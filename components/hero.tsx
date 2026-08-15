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
    const targetCount = 1200
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

  const headline = hero?.hero_title || hero?.headline || 'AI Agent Platform for Team Automation'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'The no-code platform that lets you build collaborative AI agent teams in minutes. Automate email campaigns, CRM management, sales outreach, and customer support—without writing a single line of code. Your agents work together like real teammates, handling complex workflows 24/7 while you focus on growing your business.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Automating Today'
  const secondaryCtaText = hero?.secondaryCtaText || 'Browse Agent Templates'
  const eyebrow = hero?.eyebrow || 'No-Code AI Agent Teams That Work Like Your Best Employees'

  const defaultTrustIndicators = [
    { icon: 'network', text: 'Build agent teams that collaborate autonomously—no coding required' },
    { icon: 'zap', text: 'Deploy complete workflows in under 5 minutes with visual builder' },
    { icon: 'rocket', text: 'Connect to 50+ tools: Gmail, Salesforce, Slack, HubSpot, and more' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const displayToolCount = toolCount > 0 ? toolCount : 50
  const displayAgentCount = agentCount > 0 ? agentCount : 1200

  const trustStats = [
    { value: '5 min', label: 'To First Agent Team', Icon: Clock },
    { value: '0', label: 'Code Required', Icon: Code },
    { value: '24/7', label: 'Team Collaboration', Icon: Network },
  ]

  const feedHeader = demo?.feed_header || 'Live: Agent Teams Collaborating Right Now'
  const seedEvents = (demo?.seed_events ?? [
    { agent: 'Email-Outreach-Team', action: 'Agents collaborated: sent 47 emails, scheduled 12 follow-ups, updated CRM', status: 'done' as const, ts: '2m ago' },
    { agent: 'Sales-Automation-Team', action: 'Lead-qualifier passed 8 prospects to Meeting-scheduler agent', status: 'running' as const, ts: 'now' },
    { agent: 'CRM-Sync-Team', action: 'Data-enricher and CRM-updater synced 34 contacts across tools', status: 'done' as const, ts: '5m ago' },
    { agent: 'Support-Team', action: 'Triage-agent escalated 2 tickets to Follow-up-agent for resolution', status: 'done' as const, ts: '7m ago' },
    { agent: 'Outbound-Team', action: 'Prospector found leads, Writer personalized emails, Sender deployed campaign', status: 'running' as const, ts: 'now' },
  ]) as Omit<AgentEvent, 'id'>[]
  const rollingEvents = (demo?.rolling_events ?? [
    { agent: 'Email-Campaign-Team', action: 'Writer-agent creating content, Scheduler-agent timing sends', status: 'running' as const },
    { agent: 'Lead-Management-Team', action: 'Enricher passed data to Qualifier, who routed to Sales-agent', status: 'done' as const },
    { agent: 'Customer-Success-Team', action: 'Monitor-agent detected churn risk, alerted Outreach-agent', status: 'running' as const },
    { agent: 'Sales-Pipeline-Team', action: 'Multiple agents collaborating on deal progression and follow-up', status: 'done' as const },
    { agent: 'Onboarding-Team', action: 'Welcome-agent triggered, Scheduler-agent booking calls, CRM-agent logging', status: 'done' as const },
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
    { Icon: Network, label: 'Collaborative Agent Teams', description: 'Unlike single-task tools, ONIT agents share context and coordinate workflows—one agent enriches leads while another personalizes outreach and a third schedules meetings' },
    { Icon: Mail, label: 'Full Email Automation', description: 'Agent teams handle your entire email operation: drafting personalized messages, managing sequences, processing replies, and updating your CRM automatically' },
    { Icon: Database, label: 'Intelligent CRM Management', description: 'Multiple agents work together to keep customer data clean, enriched, and synchronized across all platforms—no more manual data entry or outdated records' },
  ]

  const trustBadges = [
    'Agent teams that truly collaborate',
    'No-code workflow automation',
    'Built for email, CRM, and sales teams',
    'Deploy in minutes, not months'
  ]

  const coreValueProps = [
    { Icon: Network, label: 'Agents That Actually Team Up', description: 'This isn\'t single-task automation. Your agents communicate, share data, and coordinate complex workflows just like your best employees—except they work 24/7 and never drop the ball' },
    { Icon: Mail, label: 'Built for Your Biggest Pain Points', description: 'Specifically designed to eliminate the busywork killing your team: email campaigns, CRM data entry, sales follow-ups, lead qualification, and customer support triage' },
    { Icon: Code, label: 'Zero Technical Skills Required', description: 'Founders and operators can build sophisticated agent teams without coding. Visual workflows, pre-built templates, and one-click integrations—just point, click, and deploy' },
  ]

  const technicalBenefits = [
    { Icon: Rocket, label: 'From Idea to Deployed Team in 5 Minutes', description: 'No development cycles, no API configuration, no complexity. Build multi-agent workflows faster than writing a project brief—then watch them execute flawlessly' },
    { Icon: Brain, label: 'True Multi-Agent Collaboration', description: 'The difference is real: while other tools run isolated scripts, ONIT agents pass context between each other, make coordinated decisions, and handle exceptions as a team' },
    { Icon: Database, label: 'Instant Tool Integration', description: 'One-click connections to Gmail, Salesforce, Slack, HubSpot, and 50+ platforms. Your agents start working with your existing tools immediately—no setup headaches' },
  ]

  const totalTasksAutomated = 10247
  const totalEarlyAdopters = 1200

  const keyIntegrations = [
    { Icon: Database, label: 'Salesforce', color: 'oklch(0.55 0.20 220)' },
    { Icon: Mail, label: 'Gmail', color: 'oklch(0.60 0.18 25)' },
    { Icon: Calendar, label: 'Google Calendar', color: 'oklch(0.58 0.15 145)'