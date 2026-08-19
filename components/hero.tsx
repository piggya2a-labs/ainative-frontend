'use client'
import { Button } from '@/components/ui/button'
import { ArrowRight, Play, Shield, Zap, Rocket, CheckCircle2, Loader2, Clock, Network, Bot, Workflow, Database, Mail, MessageSquare, Calendar, Code, Sparkles, LayoutTemplate, Brain, Cpu, GitBranch, Link2, Cloud, Smartphone, FileText, DollarSign, Lock, Users, Activity, Award, Star, TrendingUp, CreditCard, Store } from 'lucide-react'
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

  const headline = hero?.hero_title || hero?.headline || 'Build AI Agents That Work Together — No Code Required'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Move faster, ship more, scale operations without scaling headcount. Deploy AI agents in minutes to automate email campaigns, CRM updates, customer support, and repetitive workflows. Your team delegates work, agents execute 24/7. Built for founders who need rapid execution without technical overhead.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Deploy Your First Agent Free'
  const secondaryCtaText = hero?.secondaryCtaText || 'Explore Agent Marketplace'
  const eyebrow = hero?.eyebrow || 'Fast-Moving Teams Choose No-Code Automation'

  const defaultTrustIndicators = [
    { icon: 'rocket', text: 'Deploy working AI agents in 5 minutes — faster than hiring' },
    { icon: 'network', text: 'Agents collaborate across email, CRM, Slack, and 50+ tools' },
    { icon: 'zap', text: 'Zero code, zero setup complexity — just point, click, automate' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const displayToolCount = toolCount > 0 ? toolCount : 50
  const displayAgentCount = agentCount > 0 ? agentCount : 10000

  const trustStats = [
    { value: '5 min', label: 'To First Agent', Icon: Rocket },
    { value: '0', label: 'Code Required', Icon: Code },
    { value: '24/7', label: 'Team Execution', Icon: Users },
  ]

  const feedHeader = demo?.feed_header || 'Live: AI Agent Teams Executing Work Right Now'
  const seedEvents = (demo?.seed_events ?? [
    { agent: 'Sales-Outreach-Team', action: 'Sent 89 personalized emails, scheduled 23 follow-ups, synced to CRM', status: 'done' as const, ts: '1m ago' },
    { agent: 'Lead-Qualification-Agent', action: 'Scored 34 new leads, routed 12 hot prospects to sales team', status: 'running' as const, ts: 'now' },
    { agent: 'Customer-Support-Team', action: 'Triaged 47 tickets, auto-resolved 31, escalated 16 to human team', status: 'done' as const, ts: '3m ago' },
    { agent: 'CRM-Data-Sync-Agent', action: 'Updated 156 contacts across Salesforce and HubSpot, enriched with LinkedIn', status: 'done' as const, ts: '4m ago' },
    { agent: 'Meeting-Coordinator-Agent', action: 'Booked 8 demos, sent calendar invites, prepared meeting briefs', status: 'running' as const, ts: 'now' },
  ]) as Omit<AgentEvent, 'id'>[]
  const rollingEvents = (demo?.rolling_events ?? [
    { agent: 'Email-Campaign-Agent', action: 'Drafting personalized sequences for 67 prospects', status: 'running' as const },
    { agent: 'Onboarding-Automation-Team', action: 'Welcomed 9 new customers, scheduled kickoff calls, sent resources', status: 'done' as const },
    { agent: 'Data-Entry-Agent', action: 'Synced 203 records across CRM, updated deal stages, logged activities', status: 'running' as const },
    { agent: 'Follow-Up-Scheduler-Agent', action: 'Sent reminders to 41 prospects, logged responses in CRM', status: 'done' as const },
    { agent: 'Report-Generation-Agent', action: 'Compiled weekly metrics dashboard, sent to leadership team', status: 'done' as const },
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
    { Icon: Users, label: 'AI Agent Teams That Collaborate', description: 'Deploy multiple agents that work together like a real team—one handles email outreach, another qualifies leads, a third updates your CRM. They coordinate automatically, share context, and execute complex multi-step workflows without human intervention' },
    { Icon: Rocket, label: 'From Zero to Automated in Minutes', description: 'No weeks of setup, no developer dependency, no IT tickets. Choose a pre-built agent template or build custom workflows with drag-and-drop simplicity. Connect your tools with one click, deploy instantly, and start automating work faster than you can schedule a meeting' },
    { Icon: Brain, label: 'Intelligent Execution, Not Just Scripts', description: 'These aren\'t simple bots—they\'re AI teammates that understand context, make decisions, handle exceptions, and learn from your workflows. They execute work with the judgment of your best team member, but 24/7 without breaks, burnout, or vacation days' },
  ]

  const trustBadges = [
    'Trusted by 10,000+ fast-moving teams',
    'Deploy automation in 5 minutes',
    'No-code AI for real work delegation',
    'Built for founders who ship fast'
  ]

  const coreValueProps = [
    { Icon: Zap, label: 'Ship Faster Without Scaling Headcount', description: 'Stop waiting on hiring, onboarding, and training. Deploy AI agent teams that execute work immediately—handling email campaigns, lead qualification, customer support, CRM updates, and data entry. Scale your operations at the speed of clicking "deploy," not the speed of recruiting' },
    { Icon: Network, label: 'Agents That Work Like Your Team', description: 'Not chatbots or simple automation—these are intelligent agents that collaborate, share context, and execute multi-step workflows across your entire tech stack. They handle the repetitive work that slows your team down, so humans focus on strategy, relationships, and high-value decisions' },
    { Icon: Code, label: 'Zero Technical Overhead', description: 'No API configuration, no code, no developer time. Visual workflow builder lets anyone on your team create and deploy AI agents. Pre-built templates for common workflows get you started in seconds. Connect Gmail, Salesforce, Slack, and 50+ tools with one click—no IT team required' },
  ]

  const technicalBenefits = [
    { Icon: Rocket, label: 'Rapid Deployment for Rapid Execution', description: 'Founders move fast—your automation should too. Deploy working AI agents in 5 minutes, not 5 weeks. Choose from ready-to-use templates or build custom workflows with drag-and-drop simplicity. Start delegating work immediately, iterate as you grow, scale without friction' },
    { Icon: Users, label: 'Built for Team Collaboration', description: 'Multiple agents work together across departments—sales agents coordinate with support agents, onboarding agents sync with CRM agents. Everyone on your team can create,