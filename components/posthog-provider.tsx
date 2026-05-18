'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY

    if (key) {
      posthog.init(key, {
        // 通过本地 /ingest 代理，绕过广告拦截器
        api_host: '/ingest',
        ui_host: 'https://us.posthog.com',
        capture_pageview: false, // 手动控制，精确追踪
        capture_pageleave: true,
        persistence: 'localStorage',
        autocapture: true,
      })
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
