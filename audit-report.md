# ONIT AI Native Closed Loop 哑前端审计报告

## 1. 愿景与当前状态对比

**愿景**：一个 AI Native Closed Loop 的哑前端，网站能用 AI Agent 自动优化自己、并时刻检查后端服务和代码、自动优化和联调。
**原生集成要求**：Vercel + Shadcn UI + PostHog + Sanity + GitHub + Claude Code。

**当前状态**：
- ✅ **Shadcn UI**：已安装并广泛使用（Button, Card, Tabs, Dialog 等）。
- ✅ **GitHub Actions (Inner Loop)**：已配置 `claude-code.yml` 和 `inner-loop.yml`，包含 `perception_agent.py`、`health_agent.py` 和 `claude_worker.js`。
- ✅ **PostHog**：前端已集成 `posthog-js`，环境变量已配置，API 可正常获取数据（`/api/agent/analytics` 正常工作）。
- ⚠️ **Sanity CMS**：前端已集成读取和写入（`/api/agent/update-content` 正常工作），但 **Webhook 自动刷新未接通**。
- ⚠️ **Vercel**：已连接 GitHub 自动部署，但 **Vercel-Sanity 原生集成未开启**，**Vercel Analytics/Speed Insights 未完全激活**。
- ❌ **API 健康检查**：`health_agent.py` 依赖的 `/api/health` 端点**不存在**（返回 404）。
- ❌ **Sanity Studio**：前端代码中**没有集成 Sanity Studio**（`/studio` 返回 404），导致人类无法可视化管理内容。

---

## 2. 未接好的集成缺口清单（按优先级排序）

### 🔴 P0: 阻断 AI 闭环的核心缺口

1. **缺失 `/api/health` 端点**
   - **问题**：`health_agent.py` 依赖此端点检查前端健康状态，目前返回 404，导致后端健康检查 Job 报错。
   - **修复指令**：创建 `app/api/health/route.ts`，返回系统状态、环境变量加载情况（脱敏）、Sanity/Supabase 连接状态。

2. **Sanity Webhook 未配置到 Vercel**
   - **问题**：Agent 通过 `/api/agent/update-content` 写入 Sanity 后，前端页面不会自动刷新，因为 Sanity 没有配置 Webhook 调用 `/api/revalidate`。
   - **修复指令**：需要通过 Sanity CLI 或 API，将 Webhook 注册到 Sanity 项目中，目标 URL 为 `https://ainative-frontend.vercel.app/api/revalidate`，并带上 `x-revalidate-secret` header。

### 🟠 P1: 影响人类体验与监控的缺口

3. **缺失内嵌的 Sanity Studio**
   - **问题**：虽然是"哑前端"，但人类管理员仍需要一个可视化界面查看 Agent 写入的内容。目前 `/studio` 路由不存在。
   - **修复指令**：在 Next.js 中集成 `next-sanity/studio`，创建 `app/studio/[[...index]]/page.tsx` 和 `sanity.config.ts`。

4. **Vercel 原生集成未开启**
   - **问题**：Vercel Analytics 和 Speed Insights 在 Vercel 控制台未完全激活，且 Vercel-Sanity 原生集成未绑定。
   - **修复指令**：在 `layout.tsx` 中引入 `@vercel/analytics/react` 和 `@vercel/speed-insights/next`。

### 🟡 P2: 代码清理与优化

5. **废弃页面未清理**
   - **问题**：`/onboarding` 页面已在之前的迭代中决定废弃，但代码仍在，且可通过 URL 访问。
   - **修复指令**：删除 `app/onboarding` 目录。

---

## 3. 下一步行动：向 Worker 下发指令

我将通过 `claude-code.yml` 的 workflow_dispatch 或直接运行 `claude_worker.js`，将上述修复任务下发给 Claude Code Worker。
