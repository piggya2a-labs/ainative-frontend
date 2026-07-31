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

  const headline = hero?.hero_title || hero?.headline || 'AI Agents That Actually Work for Your Team'
  const subheadline = hero?.hero_subtitle || hero?.subheadline || 'Stop wasting hours on email management, meeting scheduling, and CRM updates. Our AI agents handle repetitive work autonomously—so your team can focus on what matters. From lead follow-ups to data enrichment, automate the busy work in minutes.'
  const ctaText = hero?.ctaText || hero?.hero_cta || 'Start Automating Today'
  const secondaryCtaText = hero?.secondaryCtaText || 'Watch Live Demo'
  const eyebrow = hero?.eyebrow || 'Trusted by Teams Building the Future'

  const defaultTrustIndicators = [
    { icon: 'workflow', text: 'No-Code Visual Builder' },
    { icon: 'bot', text: 'Autonomous 24/7 Agents' },
    { icon: 'zap', text: 'Live in 5 Minutes' },
  ]

  const trustIndicators = demo?.trust_indicators && demo.trust_indicators.length > 0 ? demo.trust_indicators : defaultTrustIndicators

  const displayToolCount = toolCount > 0 ? toolCount : 50
  const displayAgentCount = agentCount > 0 ? agentCount : 10000

  const trustStats = [
    { value: '5 min', label: 'Setup Time', Icon: Clock },
    { value: '24/7', label: 'Autonomous Ops', Icon: Bot },
    { value: '0', label: 'Code Required', Icon: Zap },
  ]

  const feedHeader = demo?.feed_header || 'Live: Teams Automating Work Right Now'
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
    { Icon: Zap, label: 'Launch Instantly, No Tech Skills', description: 'Create automated workflows in minutes with our visual builder—no developers, no code, no complexity' },
    { Icon: Bot, label: 'AI Agents That Work for You', description: 'Your agents handle complete tasks from start to finish, making smart decisions without needing your input' },
    { Icon: Workflow, label: 'Eliminate Busy Work Forever', description: 'Stop manually sending emails, updating spreadsheets, and chasing leads—let AI handle the repetitive stuff' },
  ]

  const technicalBenefits = [
    { Icon: Mail, label: 'Smart Email & Outreach', description: 'Agents compose personalized emails, follow up with leads, and respond to inquiries automatically' },
    { Icon: Database, label: 'Automatic CRM Management', description: 'Keep customer data fresh, update deals, enrich contacts across Salesforce, HubSpot, and more' },
    { Icon: MessageSquare, label: 'Intelligent Follow-ups', description: 'Never miss a lead—agents schedule calls, send reminders, and manage customer conversations' },
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
    { Icon: Zap, label: 'Anyone Can Build Agents', description: 'Drag-and-drop builder designed for teams—no coding background needed to automate workflows', color: 'oklch(0.58_0.15_145)' },
    { Icon: Workflow, label: 'Handles Complete Tasks', description: 'AI agents execute entire workflows autonomously from trigger to completion without supervision', color: 'oklch(0.60_0.18_25)' },
    { Icon: Brain, label: 'Makes Smart Decisions', description: 'Agents adapt to context, prioritize what matters, and handle complex processes intelligently', color: 'oklch(0.65_0.15_270)' },
  ]

  const automationUseCases = [
    { icon: Mail, text: 'Send Personalized Emails' },
    { icon: Database, text: 'Keep CRM Up-to-Date' },
    { icon: MessageSquare, text: 'Handle Outbound Calls' },
    { icon: Calendar, text: 'Schedule Meetings Automatically' }
  ]

  const platformCapabilities = [
    { Icon: Zap, label: 'Start Today, Not Next Month', description: 'Build your first AI agent in 5 minutes—no technical setup, no learning curve, just results', color: 'oklch(0.65_0.15_270)' },
    { Icon: Bot, label: 'Truly Hands-Off Automation', description: 'Agents work 24/7 handling tasks, making decisions, and running workflows while you sleep', color: 'oklch(0.60_0.18_25)' },
    { Icon: Shield, label: 'Safe & Secure by Design', description: 'SOC 2 certified infrastructure—trusted by teams who take security seriously', color: 'oklch(0.58_0.15_145)' },
  ]

  const realWorldUseCases = [
    { Icon: Mail, label: 'Email Management', description: 'Auto-reply to inquiries, draft personalized outreach, and manage inbox triage' },
    { Icon: Calendar, label: 'Meeting Scheduling', description: 'Coordinate calendars, send invites, and handle rescheduling automatically' },
    { Icon: Database, label: 'CRM Automation', description: 'Update contacts, enrich lead data, and sync information across platforms' },
    { Icon: MessageSquare, label: 'Lead Follow-ups', description: 'Track prospects, send timely reminders, and nurture relationships autonomously' },
  ]

  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-16 sm:pt-20 md:pt-24 pb-8 sm:pb-12 md:pb-20 overflow-hidden" aria-label="Hero">
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle, oklch(0.30 0 0) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.35 }} />
      <div className="absolute inset-0 -z-10" aria-hidden="true" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, oklch(0.30 0.08 270) 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 50% 60%, oklch(0.25 0.10 250) 0%, transparent 60%)' }} />
      
      <div className={`max-w-7xl mx-auto flex flex-col items-center gap-5 sm:gap-7 md:gap-9 w-full transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="flex flex-col items-center gap-4 sm:gap-5 md:gap-6 max-w-5xl w-full">
          <div className={`flex items-center gap-2 px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 backdrop-blur-sm transition-all duration-700 delay-100 ${isVisible ? 'opacity