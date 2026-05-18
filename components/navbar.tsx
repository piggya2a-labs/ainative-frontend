'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'
import { SiteConfig } from '@/lib/sanity-schema'

interface NavbarProps {
  siteConfig?: SiteConfig | null
}

const DEFAULT_NAV = {
  logo: 'ONIT',
  links: [
    { _key: 'n1', label: 'Agents', url: '/agents' },
    { _key: 'n2', label: 'Tools', url: '/tools' },
    { _key: 'n3', label: 'Docs', url: '/docs' },
  ],
  ctaText: '开始使用',
  ctaUrl: '#contact',
}

export function Navbar({ siteConfig }: NavbarProps) {
  const posthog = usePostHog()
  const nav = siteConfig?.nav ?? DEFAULT_NAV
  const logo = nav.logo || 'ONIT'
  const links = nav.links?.length ? nav.links : DEFAULT_NAV.links

  const trackNav = (label: string) => {
    posthog?.capture('nav_click', { label })
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-sm">
            <div className="w-6 h-6 rounded bg-foreground flex items-center justify-center">
              <span className="text-background text-xs font-bold">
                {logo.charAt(0).toUpperCase()}
              </span>
            </div>
            <span>{logo}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link._key}
                href={link.url}
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
            className="text-xs h-8"
            onClick={() => posthog?.capture('cta_click', { location: 'navbar', action: 'get_started' })}
          >
            {nav.ctaText || '开始使用'}
          </Button>
        </div>
      </div>
    </header>
  )
}
