import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from '@/components/posthog-provider';
import { Suspense } from 'react';
import { PostHogPageView } from '@/components/posthog-pageview';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'PiggyA2A — AI Agent Platform',
  description: 'Delegate complex tasks to specialized AI agents. They coordinate, execute, and iterate — so you can focus on what matters.',
  openGraph: {
    title: 'PiggyA2A — AI Agent Platform',
    description: 'Delegate complex tasks to specialized AI agents.',
    type: 'website',
  },
};

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
          <Suspense>
            <PostHogPageView />
          </Suspense>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
