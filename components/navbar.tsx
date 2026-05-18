'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'
import { SiteConfig } from '@/lib/sanity-schema'
import { useUser } from '@/lib/auth-context'

interface NavbarProps {
  siteConfig?: SiteConfig | null
}

export function Navbar({ siteConfig }: NavbarProps) {
  const posthog = usePostHog()
  const { user, loading, signInAnonymously, signOut } = useUser()
  const nav = siteConfig?.nav
  const logo = nav?.logo || 'ONIT'
  const links = nav?.links ?? []
  const ctaText = nav?.ctaText || '开始使用'

  const trackNav = (label: string) => {
    posthog?.capture('nav_click', { label })
  }

  const handleGetStarted = async () => {
    posthog?.capture('cta_click', { location: 'navbar', action: 'get_started' })
    if (!user) {
      await signInAnonymously()
    }
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
            {nav?.badge || 'Beta'}
          </Badge>
          {!loading && user ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:block text-xs text-muted-foreground">
                {user.is_anonymous ? '访客' : (user.email || user.id.slice(0, 8))}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8"
                onClick={() => {
                  posthog?.capture('sign_out')
                  signOut()
                }}
              >
                退出
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="text-xs h-8"
              disabled={loading}
              onClick={handleGetStarted}
            >
              {loading ? '...' : ctaText}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
