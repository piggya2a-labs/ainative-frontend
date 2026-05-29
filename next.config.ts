import { withGTConfig } from "gt-next/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许 Manus 代理域名访问 Next.js dev server API
  allowedDevOrigins: [
  '*.sg1.manus.computer',
  '*.manus.computer'],

  async rewrites() {
    return [
    // PostHog 服务端代理：绕过广告拦截器，确保行为数据完整
    {
      source: "/ingest/static/:path*",
      destination: "https://us-assets.i.posthog.com/static/:path*"
    },
    {
      source: "/ingest/:path*",
      destination: "https://us.i.posthog.com/:path*"
    },
    {
      source: "/ingest/decide",
      destination: "https://us.i.posthog.com/decide"
    }];

  },
  // PostHog 代理要求跳过 trailing slash 自动处理
  skipTrailingSlashRedirect: true
};

export default withGTConfig(nextConfig, {});