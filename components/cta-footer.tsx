'use client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePostHog } from 'posthog-js/react'
import { useState } from 'react'
import { SiteConfig } from '@/lib/sanity-schema'

interface CTASectionProps {
  siteConfig?: SiteConfig | null
}

interface FooterProps {
  siteConfig?: SiteConfig | null
}

export function CTASection({ siteConfig }: CTASectionProps) {
  const posthog = usePostHog()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const cta = siteConfig?.pages?.cta ?? siteConfig?.cta
  const headline = cta?.headline || '准备好让 Agent 团队为你工作了吗？'
  const description = cta?.description || '加入等待列表，成为第一批体验 ONIT 的用户。'
  const buttonText = (cta as { button_text?: string; buttonText?: string })?.button_text
    || (cta as { button_text?: string; buttonText?: string })?.buttonText
    || '加入等待列表'
  const subtitle = (cta as { cta_subtitle?: string; subtitle?: string })?.cta_subtitle
    || (cta as { cta_subtitle?: string; subtitle?: string })?.subtitle
    || '无需信用卡，2 分钟快速上手'
  const successMsg = (cta as { success_message?: string })?.success_message
    || '你已加入等待列表，我们会尽快联系你。'
  const noSpam = (cta as { no_spam?: string })?.no_spam || '不发垃圾邮件，随时可退订。'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    posthog?.capture('waitlist_signup', { email })
    setSubmitted(true)
  }

  return (
    <section className="py-24 px-4" id="contact">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {headline}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-sm h-10"
              required
            />
            <Button type="submit" className="text-sm h-10 px-6 shrink-0">
              {buttonText}
            </Button>
          </form>
        ) : (
          <div className="text-sm text-muted-foreground bg-muted rounded-lg px-6 py-3 inline-block">
            {successMsg}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {subtitle}
        </p>
        <p className="text-xs text-muted-foreground/60">
          {noSpam}
        </p>
      </div>
    </section>
  )
}

export function Footer({ siteConfig }: FooterProps) {
  const footer = siteConfig?.pages?.footer
  const tagline = footer?.tagline || 'ONIT · AI Native Agent 团队平台'
  const logo = siteConfig?.nav?.logo || 'ONIT'
  const links = footer?.links || ['隐私政策', '服务条款', '文档']

  return (
    <footer className="border-t border-border/40 py-8 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-foreground flex items-center justify-center">
            <span className="text-background text-[9px] font-bold">
              {logo.charAt(0).toUpperCase()}
            </span>
          </div>
          <span>{tagline}</span>
        </div>
        <div className="flex items-center gap-4">
          {links.map((link) => (
            <span key={link}>{link}</span>
          ))}
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  )
}
