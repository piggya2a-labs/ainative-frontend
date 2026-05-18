'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePostHog } from 'posthog-js/react'
import { useState } from 'react'

export function CTASection() {
  const posthog = usePostHog()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    posthog?.capture('waitlist_signup', { email })
    setSubmitted(true)
  }

  return (
    <section className="py-24 px-4">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Ready to delegate?
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Join the teams already running agents that work while they sleep.
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
              Join waitlist
            </Button>
          </form>
        ) : (
          <div className="text-sm text-muted-foreground bg-muted rounded-lg px-6 py-3 inline-block">
            You&apos;re on the list. We&apos;ll be in touch soon.
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          No spam. Unsubscribe anytime.
        </p>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-border/40 py-8 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-foreground flex items-center justify-center">
            <span className="text-background text-[9px] font-bold">A</span>
          </div>
          <span>PiggyA2A · AI-native agent platform</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Docs</span>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  )
}
