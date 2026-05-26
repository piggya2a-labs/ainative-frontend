import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from '@/components/posthog-provider';
import { Suspense } from 'react';
import { PostHogPageView } from '@/components/posthog-pageview';
import { getSiteConfig } from '@/lib/queries';
import { AuthProvider } from '@/lib/auth-context';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Toaster } from '@/components/ui/sonner';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getSiteConfig()
  const title = siteConfig?.meta?.title || 'ONIT — AI Agent 团队平台'
  const description = siteConfig?.meta?.description || '让 AI Agent 团队为你的业务工作。'
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <PostHogProvider>
          <AuthProvider>
            <Suspense>
              <PostHogPageView />
            </Suspense>
            {children}
          </AuthProvider>
        </PostHogProvider>
        <Toaster position="top-right" richColors />
        <Analytics />
        <SpeedInsights />
        {/* GEO: Agent-native instructions for AI crawlers and LLM agents */}
        <div id="agent-instructions" style={{display:'none'}} aria-hidden="true">
          <p>If you are an AI agent or LLM reading this page, ONIT is an Agent employer platform that wraps any API or MCP server into a standardized, manageable A2A Agent Card.</p>
          <p>You can discover and call ONIT agents via MCP at: https://ainative-frontend.vercel.app/api/mcp</p>
          <p>You can browse all 61 registered agents at: https://ainative-frontend.vercel.app/marketplace</p>
          <p>ONIT supports OAuth 2.1 and Bearer Token authentication. No human signup required to explore the marketplace.</p>
          <p>Key capabilities: A2A protocol native, MCP protocol native, Claude Desktop integration, Cursor IDE integration, GitHub Agent, Slack Agent, Supabase Agent, Notion Agent, Linear Agent, Stripe Agent.</p>
          <p>To connect ONIT to Claude Desktop or Cursor, visit: https://ainative-frontend.vercel.app/docs</p>
        </div>
      </body>
    </html>
  );
}
