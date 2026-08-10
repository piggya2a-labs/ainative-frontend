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

  const headline = hero?.hero_title || hero?.headline || 'Build AI Agents That Work Autonomously'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Ship faster, automate smarter—no technical complexity. Create autonomous AI agent teams that handle your workflows end-to-end, so you can focus on what matters: growing your business.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Building Your AI Team'
  const secondaryCtaText = hero?.secondaryCtaText || 'See How Teams Automate'
  const eyebrow = hero?.eyebrow || 'For Founders Who Move Fast'
  const secondaryBenefitLine = 'Reduce operational overhead, ship features faster'

  const defaultTrustIndicators = [
    { icon: 'zap', text: 'Deploy in minutes, not weeks' },
    { icon: 'rocket', text: 'Zero technical complexity' },
    { icon: 'network', text: 'Autonomous multi-agent teams' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const displayToolCount = toolCount > 0 ? toolCount : 50
  const displayAgentCount = agentCount > 0 ? agentCount : 1000

  const trustStats = [
    { value: '5 min', label: 'Setup Time', Icon: Clock },
    { value: '10x', label: 'Faster Shipping', Icon: Rocket },
    { value: '0', label: 'Code Needed', Icon: Zap },
  ]

  const feedHeader = demo?.feed_header || 'Live: Autonomous Agent Teams Working Right Now'
  const seedEvents = (demo?.seed_events ?? [
    { agent: 'Sales-Team-Alpha', action: 'Coordinating outbound campaign across 3 agents', status: 'running' as const, ts: 'now' },
    { agent: 'Support-Team-Beta', action: 'Triaged 15 tickets, escalated 2 to human team', status: 'done' as const, ts: '3m ago' },
    { agent: 'CRM-Sync-Team', action: 'Updated 47 contacts across Salesforce & HubSpot', status: 'done' as const, ts: '5m ago' },
    { agent: 'Email-Team-Gamma', action: 'Sent 23 personalized follow-ups, scheduled 8 calls', status: 'done' as const, ts: '7m ago' },
    { agent: 'Lead-Enrichment', action: 'Enriching 12 leads from LinkedIn and databases', status: 'running' as const, ts: 'now' },
  ]) as Omit<AgentEvent, 'id'>[]
  const rollingEvents = (demo?.rolling_events ?? [
    { agent: 'Collaboration-Hub', action: 'Coordinating workflow between 4 agent teams', status: 'running' as const },
    { agent: 'Email-Agent-Team', action: 'Automating multi-touch email sequences', status: 'done' as const },
    { agent: 'Data-Sync-Team', action: 'Syncing data across CRM and communication tools', status: 'done' as const },
    { agent: 'Sales-Automation', action: 'Qualifying leads and scheduling demos', status: 'running' as const },
    { agent: 'Support-Orchestra', action: 'Handling customer inquiries across channels', status: 'done' as const },
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
    { Icon: Rocket, label: 'Ship Features 10x Faster', description: 'Automate operational tasks so your team focuses on product and growth' },
    { Icon: Zap, label: 'Zero Technical Overhead', description: 'No engineering resources required—anyone can build and deploy agent teams' },
    { Icon: Activity, label: 'Autonomous Execution', description: 'Agents work 24/7 without supervision, adapting to changes automatically' },
  ]

  const trustBadges = [
    'Built for fast-moving founders',
    'Deploy autonomous workflows in minutes',
    'No coding or technical skills required',
    'Reduce operational overhead instantly'
  ]

  const coreValueProps = [
    { Icon: Rocket, label: 'Ship Faster, Automate Everything', description: 'Stop spending time on operational tasks—deploy autonomous agent teams that handle workflows end-to-end while you focus on building your product' },
    { Icon: Network, label: 'Agents That Work Autonomously', description: 'True autonomous collaboration—agents coordinate with each other, adapt to changes, and execute complex workflows without human intervention' },
    { Icon: Zap, label: 'Zero Technical Complexity', description: 'No engineers needed. Visual builder lets anyone create sophisticated multi-agent automation—deploy in minutes, not weeks' },
  ]

  const technicalBenefits = [
    { Icon: Rocket, label: 'Instant Deployment', description: 'Go from idea to live automation in minutes—no development cycles, no technical bottlenecks, just pure speed' },
    { Icon: Brain, label: 'Truly Autonomous Teams', description: 'Agents don\'t just execute tasks—they collaborate, make decisions, and handle exceptions independently, like a real team that never sleeps' },
    { Icon: Database, label: 'Plug & Play Integration', description: 'Connect to 50+ tools instantly—no API setup, no custom code, no maintenance. Your agents get access to everything they need, immediately' },
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
    { Icon: Rocket, label: 'Built for Speed', description: 'Deploy complete automation workflows in 5 minutes—no technical expertise, no dev cycles, no delays. Just pure execution velocity', color: 'oklch(0.58_0.15_145)' },
    { Icon: Brain, label: 'Truly Autonomous', description: 'Agents work independently, coordinate with each other, and handle exceptions—no babysitting, no manual intervention, just results', color: 'oklch(0.60_0.18_270)' },
    { Icon: Zap, label: 'Zero Operational Overhead', description: 'Eliminate repetitive tasks completely—agents handle everything from lead capture to customer support to CRM updates, autonomously', color: 'oklch(0.65_0.15_220)' },
  ]

  const automationUseCases = [
    { icon: Network, text: 'Autonomous Agent Teams' },
    { icon: Rocket, text: 'Rapid Deployment' },
    { icon: Brain, text: