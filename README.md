# ONIT — AI Native Closed Loop 前端

> 这个网站本身就是产品理念的活体演示：它能用 AI Agent 自动优化自己。

## 快速上手

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 15 App Router |
| 样式 | Tailwind CSS v4 + Shadcn UI |
| 数据库 | Supabase（PostgreSQL + Auth） |
| CMS | Sanity（面向用户的所有文案） |
| 分析 | PostHog + Vercel Analytics |
| 部署 | Vercel（main 分支自动部署） |
| AI | Claude（内循环优化 + GitHub Actions） |

## 关键路由

| 路由 | 说明 |
|------|------|
| `/` | 首页（Hero + Features 从 Sanity 读取） |
| `/dashboard` | 用户工作台（Supabase Auth 保护） |
| `/agents` | Agent 团队展示 |
| `/marketplace` | 外部 Agent 市场 |
| `/blog` | 博客（Sanity CMS） |
| `/studio` | Sanity Studio（内容编辑） |
| `/api/health` | 自检端点（Sanity + Supabase + env） |

## AI 闭环工作流

每天 UTC 02:00 自动运行（`.github/workflows/inner-loop.yml`）：

```
PostHog 行为数据
    ↓
perception_agent.py（分析 → 生成改进指令）
    ↓
claude_worker.js（Claude 生成代码 → 推送 GitHub）
    ↓
Vercel 自动部署
```

同时运行 `health_agent.py` 检查后端健康，发现问题自动创建 GitHub Issue。

## 开发约束

详见 [CLAUDE.md](./CLAUDE.md)。所有 AI Agent 和人类协作者都必须遵守。

## 环境变量

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_WRITE_TOKEN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
AGENT_API_SECRET=
ANTHROPIC_API_KEY=
```
