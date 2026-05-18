'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
    
    if (key) {
      posthog.init(key, {
        api_host: host,
        capture_pageview: false, // 手动控制，精确追踪
        capture_pageleave: true,
        persistence: 'localStorage',
        autocapture: true,
      })
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
