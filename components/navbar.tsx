'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'

const navLinks = [
  { label: 'Agents', href: '/agents' },
  { label: 'Tools', href: '/tools' },
  { label: 'Docs', href: '/docs' },
]

export function Navbar() {
  const posthog = usePostHog()

  const trackNav = (label: string) => {
    posthog?.capture('nav_click', { label })
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-sm">
            <div className="w-6 h-6 rounded bg-foreground flex items-center justify-center">
              <span className="text-background text-xs font-bold">A</span>
            </div>
            <span>PiggyA2A</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => trackNav(link.label)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden sm:flex text-xs">
            Beta
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => posthog?.capture('cta_click', { location: 'navbar', action: 'sign_in' })}
          >
            Sign in
          </Button>
          <Button
            size="sm"
            className="text-xs h-8"
            onClick={() => posthog?.capture('cta_click', { location: 'navbar', action: 'get_started' })}
          >
            Get started
          </Button>
        </div>
      </div>
    </header>
  )
}
