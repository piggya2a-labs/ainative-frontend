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
  title: 'ONIT — AI Agent 团队平台',
  description: '让 AI Agent 团队为你的业务工作。ONIT 是一个 AI Native 平台，专业 Agent 自主完成你的每一个业务目标。',
  openGraph: {
    title: 'ONIT — AI Agent 团队平台',
    description: '让 AI Agent 团队为你的业务工作。',
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
