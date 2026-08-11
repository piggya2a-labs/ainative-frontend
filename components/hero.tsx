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

  const headline = hero?.hero_title || hero?.headline || 'Build AI Agents Without Code'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Automate email outreach, CRM updates, sales follow-ups, and customer support—all without technical skills. Create autonomous AI agent teams that work together to handle your workflows end-to-end.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Automating Free'
  const secondaryCtaText = hero?.secondaryCtaText || 'Watch AI Teams in Action'
  const eyebrow = hero?.eyebrow || 'No-Code AI Automation Platform'
  const secondaryBenefitLine = 'Teams collaborate better when AI handles the busywork'

  const defaultTrustIndicators = [
    { icon: 'zap', text: 'Setup in 5 minutes—no coding required' },
    { icon: 'network', text: 'Agents collaborate autonomously 24/7' },
    { icon: 'rocket', text: 'Automate email, CRM, sales & support' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const displayToolCount = toolCount > 0 ? toolCount : 50
  const displayAgentCount = agentCount > 0 ? agentCount : 1000

  const trustStats = [
    { value: '5 min', label: 'To First Agent', Icon: Clock },
    { value: '0', label: 'Code Required', Icon: Code },
    { value: '24/7', label: 'Autonomous Work', Icon: Bot },
  ]

  const feedHeader = demo?.feed_header || 'Live: AI Agent Teams Automating Workflows Right Now'
  const seedEvents = (demo?.seed_events ?? [
    { agent: 'Email-Outreach-Team', action: 'Sent 47 personalized emails, scheduled 12 follow-ups', status: 'done' as const, ts: '2m ago' },
    { agent: 'CRM-Sync-Agent', action: 'Updating 34 contacts across Salesforce and HubSpot', status: 'running' as const, ts: 'now' },
    { agent: 'Sales-Follow-Up', action: 'Qualified 8 leads, booked 3 discovery calls', status: 'done' as const, ts: '5m ago' },
    { agent: 'Support-Automation', action: 'Triaged 23 tickets, escalated 2 to human team', status: 'done' as const, ts: '7m ago' },
    { agent: 'Lead-Enrichment', action: 'Enriching 15 new leads from LinkedIn and databases', status: 'running' as const, ts: 'now' },
  ]) as Omit<AgentEvent, 'id'>[]
  const rollingEvents = (demo?.rolling_events ?? [
    { agent: 'Email-Sequence-AI', action: 'Automating multi-touch campaigns for 3 workflows', status: 'running' as const },
    { agent: 'CRM-Update-Team', action: 'Syncing customer data across sales and marketing tools', status: 'done' as const },
    { agent: 'Sales-Outreach-AI', action: 'Personalizing outreach for 42 prospects', status: 'running' as const },
    { agent: 'Support-Triage-AI', action: 'Handling customer inquiries across email and chat', status: 'done' as const },
    { agent: 'Meeting-Scheduler', action: 'Coordinating calendars and booking demos', status: 'done' as const },
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
    { Icon: Mail, label: 'Email Automation', description: 'AI agents send personalized outreach, follow-ups, and nurture sequences automatically' },
    { Icon: Database, label: 'CRM Management', description: 'Keep customer data synchronized across all your sales and marketing tools in real-time' },
    { Icon: Users, label: 'Sales Outreach', description: 'Qualify leads, schedule meetings, and manage your entire sales pipeline autonomously' },
  ]

  const trustBadges = [
    'No coding skills needed—anyone can build',
    'Agents work together like a real team',
    'Automate email, CRM, support & sales',
    'Deploy complete workflows in 5 minutes'
  ]

  const coreValueProps = [
    { Icon: Code, label: 'No-Code AI Agent Builder', description: 'Visual interface lets anyone create sophisticated automation workflows—no developers, no technical skills, just drag, drop, and deploy in minutes' },
    { Icon: Network, label: 'Multi-Agent Team Collaboration', description: 'Your AI agents don\'t work alone—they communicate, coordinate tasks, and collaborate like a real team to handle complex workflows autonomously' },
    { Icon: Mail, label: 'Automate Critical Workflows', description: 'Email campaigns, CRM updates, sales follow-ups, customer support—handle the tasks that consume your team\'s time every single day' },
  ]

  const technicalBenefits = [
    { Icon: Rocket, label: '5-Minute Deployment', description: 'Go from zero to fully automated workflow in minutes—no development cycles, no API setup, no technical complexity. Just pure execution speed' },
    { Icon: Brain, label: 'Truly Autonomous Execution', description: 'AI agents don\'t just execute tasks—they make decisions, handle exceptions, and adapt to changes independently, working 24/7 without supervision' },
    { Icon: Database, label: 'Instant Integration', description: 'Connect to 50+ tools with one click—Gmail, Salesforce, Slack, HubSpot, and more. No coding, no API keys, no maintenance required' },
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
    { Icon: Code, label: 'Zero Code Required', description: 'Anyone on your team can build AI automation—no engineers, no technical skills, no complex setup. Just visual workflows that work', color: 'oklch(0.58_0.15_145)' },
    { Icon: Users, label: 'Team Collaboration Built-In', description: 'AI agents coordinate with each other and your human team seamlessly—share context, delegate tasks, and work together toward shared goals', color: 'oklch(0.60_0.18_270)' },
    { Icon: Mail, label: 'Real-World Automation', description: 'Handle the tasks teams actually need—email outreach, CRM updates, sales follow-ups, customer support, lead enrichment, and more',