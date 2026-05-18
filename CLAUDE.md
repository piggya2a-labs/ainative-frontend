# ONIT 前端 — Claude Code 指引

> 这是 ONIT AI Native Closed Loop 哑前端。每一次 PR 和 commit 都可能被 Claude Code 自动审查或执行。
> 阅读本文件是理解项目约束的**唯一入口**，不要依赖 README。

## 产品定位

一个 AI Native 的哑前端：网站本身就是产品理念的活体演示——它能用 AI Agent 自动优化自己、时刻检查后端服务和代码、自动联调。

**核心技术栈**
- Next.js 15 App Router（`app/` 目录）
- Tailwind CSS v4（`@theme inline` token，禁止裸色值）
- Shadcn UI（`components/ui/`，禁止引入其他 UI 库）
- Supabase（数据库 + 认证，用 `lib/supabase-client.ts`）
- Sanity CMS（所有面向用户的文案从 Sanity 读取，禁止硬编码 copy）
- PostHog（用户行为追踪，`components/posthog-provider.tsx`）
- Vercel（部署，Analytics + SpeedInsights 已接入 `app/layout.tsx`）

## 绝对禁止

1. **不写手写 DB 接口**：所有 Supabase 查询的类型从 `lib/database.types.ts` 导入
2. **不硬编码颜色**：使用 `globals.css` 中定义的 CSS token（`var(--onit-green)` 等）
3. **不硬编码用户可见文案**：Hero、Features、Blog 文案从 Sanity 读取
4. **不用 `select('*')`**：Supabase 查询必须显式列出字段
5. **不引入新 UI 库**：只用 Shadcn UI 组件
6. **不删除 `/api/health`**：这是闭环自检的核心端点
7. **不破坏 `/api/agent/update-content`**：这是 Agent 写入 Sanity 的通道

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `lib/database.types.ts` | 所有 Supabase 表的类型定义（SSOT） |
| `lib/queries.ts` | Sanity GROQ 查询（Hero、Features、Blog、SiteConfig） |
| `app/api/health/route.ts` | 自检端点，检查 Sanity + Supabase + env |
| `app/api/agent/update-content/route.ts` | Agent 写入 Sanity 的 API |
| `app/api/agent/analytics/route.ts` | Agent 读取 PostHog 行为数据的 API |
| `agents/perception_agent.py` | 感知层：读 PostHog → 生成改进指令 |
| `agents/claude_worker.js` | 执行层：接收指令 → Claude 生成代码 → 推送 GitHub |
| `agents/health_agent.py` | 健康检查层：检查后端服务 → 自动修复 |
| `.github/workflows/inner-loop.yml` | 每日自动运行的闭环工作流 |

## 代码规范

- 组件文件用 `PascalCase.tsx`，工具函数用 `camelCase.ts`
- Server Component 默认，Client Component 加 `'use client'` 并最小化范围
- 所有 `fetch` 调用加 `cache: 'no-store'` 或 `next: { revalidate: N }`
- API 路由返回 `NextResponse.json()`，错误返回对应 HTTP 状态码

## 闭环工作流说明

`inner-loop.yml` 每天 UTC 02:00 自动运行：
1. `perception_agent.py` 读取 PostHog 7 天行为数据，用 Claude 分析生成改进指令
2. `claude_worker.js` 接收指令，用 Claude 生成改进代码，通过 GitHub API 推送到 main
3. `health_agent.py` 检查 Sanity / Supabase / PostHog 健康状态，发现问题自动创建 GitHub Issue

Vercel 监听 main 分支，推送后自动部署。
