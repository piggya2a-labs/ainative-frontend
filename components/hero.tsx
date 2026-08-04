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

  const hero = siteConfig?.hero
  const demo = siteConfig?.hero_demo

  const headline = hero?.hero_title || hero?.headline || 'No-Code AI Agents That Actually Work for Your Team'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Stop wasting time on repetitive work. Our AI agents handle emails, schedule calls, and update your CRM automatically—no coding or technical skills needed. Just tell them what to do, and they'll do it.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Automating Free'
  const secondaryCtaText = hero?.secondaryCtaText || 'See Agent Templates'
  const eyebrow = hero?.eyebrow || 'Ship your first AI agent in minutes'

  const defaultTrustIndicators = [
    { icon: 'zap', text: 'Set up in 5 minutes' },
    { icon: 'workflow', text: 'Zero code required' },
    { icon: 'bot', text: 'Works 24/7 on autopilot' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const displayToolCount = toolCount > 0 ? toolCount : 50
  const displayAgentCount = agentCount > 0 ? agentCount : 1000

  const trustStats = [
    { value: '5 min', label: 'Setup Time', Icon: Clock },
    { value: '24/7', label: 'Autonomous', Icon: Bot },
    { value: '0', label: 'Code Needed', Icon: Zap },
  ]

  const feedHeader = demo?.feed_header || 'Live: AI Agents Working Right Now'
  const seedEvents = (demo?.seed_events ?? [
    { agent: 'Sales-Agent-47', action: 'Updated 12 CRM contacts in Salesforce', status: 'done' as const, ts: '2m ago' },
    { agent: 'Email-Agent-23', action: 'Sent 8 personalized follow-up emails', status: 'done' as const, ts: '5m ago' },
    { agent: 'Schedule-Agent-91', action: 'Booked 3 sales calls with prospects', status: 'running' as const, ts: 'now' },
    { agent: 'Lead-Agent-64', action: 'Enriched 15 leads from LinkedIn', status: 'done' as const, ts: '8m ago' },
    { agent: 'Outreach-Agent-12', action: 'Processing new inbound inquiries', status: 'running' as const, ts: 'now' },
  ]) as Omit<AgentEvent, 'id'>[]
  const rollingEvents = (demo?.rolling_events ?? [
    { agent: 'Email-Agent-45', action: 'Drafting personalized email campaigns', status: 'running' as const },
    { agent: 'CRM-Agent-78', action: 'Syncing deal stages across Salesforce', status: 'done' as const },
    { agent: 'Follow-up-Agent-33', action: 'Scheduling callback reminders', status: 'done' as const },
    { agent: 'Data-Agent-56', action: 'Enriching contact information', status: 'running' as const },
    { agent: 'Meeting-Agent-89', action: 'Coordinating team calendars', status: 'done' as const },
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
    { Icon: Lock, label: 'Enterprise Security', description: 'SOC 2 Type II certified' },
    { Icon: Users, label: 'Team Collaboration', description: 'Multi-agent workspaces' },
    { Icon: Activity, label: 'Real-Time Execution', description: 'Live autonomous operations' },
  ]

  const trustBadges = [
    'No technical skills needed',
    'Set up in minutes',
    'Works around the clock',
    'Enterprise-grade security'
  ]

  const coreValueProps = [
    { Icon: Mail, label: 'Automated Email & Outreach', description: 'AI agents write personalized emails, follow up with leads, and manage your inbox—completely hands-off' },
    { Icon: Database, label: 'Smart CRM Updates', description: 'Keep Salesforce, HubSpot, or Pipedrive fresh automatically—contacts enriched, deals synced, data always current' },
    { Icon: Calendar, label: 'Intelligent Scheduling', description: 'Agents coordinate meetings, send invites, and handle rescheduling across your team without lifting a finger' },
  ]

  const technicalBenefits = [
    { Icon: Zap, label: 'No Code, No Problem', description: 'Simple drag-and-drop builder anyone can use—zero developers, zero training, zero headaches' },
    { Icon: Bot, label: 'True Autopilot', description: 'Set it once and agents handle everything—complete workflows from start to finish, 24/7 without babysitting' },
    { Icon: Workflow, label: 'Plugs Into Everything', description: 'Works with Gmail, Salesforce, Slack, Google Calendar, and 50+ tools you already use daily' },
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
    { Icon: Zap, label: 'Actually No-Code', description: 'Anyone on your team can build agents—seriously, no coding or technical background required', color: 'oklch(0.58_0.15_145)' },
    { Icon: Bot, label: 'Full Task Automation', description: 'Agents run entire workflows start-to-finish autonomously without needing your input', color: 'oklch(0.60_0.18_25)' },
    { Icon: Brain, label: 'Smart Decision-Making', description: 'AI adapts to context, prioritizes actions, and handles complex business logic automatically', color: 'oklch(0.65_0.15_270)' },
  ]

  const automationUseCases = [
    { icon: Mail, text: 'Send Personalized Emails' },
    { icon: Database, text: 'Update CRM Automatically' },
    { icon: MessageSquare, text: 'Follow Up With Leads' },
    { icon: Calendar, text: 'Schedule Meetings' }
  ]

  const platformCapabilities = [
    { Icon: Zap, label: 'Ship in Minutes', description: 'Create your first agent in 5 minutes—no complex setup, no learning curve, just instant results', color: 'oklch(0.65_0.15_270)' },
    { Icon: Bot, label: 'Fully Hands-Off', description: 'Agents work 24/7 handling repetitive tasks, making decisions, and running workflows on autopilot', color: 'oklch(0.60_0.18_25)' },
    { Icon: Shield, label: 'Enterprise Security', description: 'SOC 2 Type II certified infrastructure—trusted by teams who care about data security', color: 'oklch(0.58_0.15_145)' },
  ]

  const realWorldUseCases = [
    { Icon: Mail, label: 'Email Management', description: 'Auto-reply to inquiries, draft personalized outreach, manage inbox triage automatically' },
    { Icon: Calendar,