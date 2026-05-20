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
      </body>
    </html>
  );
}
