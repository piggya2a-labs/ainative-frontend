# ONIT Frontend (ainative-frontend)

本文档是 ONIT 前端项目的 Single Source of Truth (SSOT)。
**任何人类开发者或 AI Agent 在修改本项目代码前，必须完整阅读并遵守本文档的约束。**

## 1. 架构与技术栈

- **框架**: Next.js 15 (App Router)
- **UI 库**: base-ui (Shadcn 变体，非 Radix UI)
- **样式**: Tailwind CSS v4
- **数据库**: Supabase
- **CMS**: Sanity

## 2. 数据源与类型约束 (Supabase)

前端直接从 Supabase 读取数据。**严禁在前端代码中手写数据库接口类型。**

### 2.1 核心表与用途
- `agent_registry`: 存储所有 Agent（内部团队成员、外部集成平台、能力工具）。
  - `type = 'agent'`: ONIT 内部团队成员（显示在 `/agents`）
  - `type = 'external'`: 外部集成平台（显示在 `/marketplace`）
  - `type = 'capability'`: 能力工具（目前不直接展示）
- `tenant_connectors`: 存储用户与外部 Agent 的连接状态（显示在 Dashboard）。
- `tool_registry`: 存储具体的原子工具（目前前端不直接读取，通过 agent_registry 的 skills 关联）。

### 2.2 类型生成规范
所有数据库类型必须通过 Supabase CLI 自动生成。
- **生成脚本**: `node --env-file=.env.local scripts/gen-types.mjs`
- **输出文件**: `lib/database.types.ts`
- **使用规范**: 前端组件必须从 `lib/database.types.ts` 导入类型（如 `AgentRow`, `ConnectorRow`），并使用 `Pick` 提取所需字段。

## 3. 文案与内容管理 (Sanity)

**严禁在代码中硬编码面向用户的文案（如页面标题、描述、按钮文字）。**

- 所有页面级文案必须从 Sanity CMS 读取。
- 导航链接（Navbar）由 Sanity 的 `site_config` 控制。
- 博客文章（`/blog`）完全由 Sanity 的 `article` schema 驱动。
- **修改文案**: 请登录 Sanity Studio 修改，或编写脚本通过 Sanity API 更新，不要改代码。

## 4. 设计规范 (Design Tokens)

**严禁在组件中使用裸色值（如 `text-[#123456]` 或 `bg-oklch(...)`）。**

所有品牌颜色和状态颜色已在 `app/globals.css` 中定义为 CSS 变量，并通过 `@theme inline` 暴露给 Tailwind。

### 4.1 核心 Tokens
- **品牌绿** (在线、成功、已连接): `text-onit-green`, `bg-onit-green-muted`
- **品牌蓝** (链接、交互): `text-onit-blue`, `bg-onit-blue-muted`
- **状态黄** (待机、处理中): `text-onit-amber`
- **状态红** (错误、断开): `text-onit-red` (等同于 `destructive`)

### 4.2 Agent 职责 Badge Tokens
Agent 卡片上的职责标签必须使用以下预定义颜色：
- `bg-badge-exec`: 执行 (development)
- `bg-badge-arch`: 设计 (architecture)
- `bg-badge-coord`: 协调 (coordination)
- `bg-badge-audit`: 审核 (audit)
- `bg-badge-ops`: 运维 (operations)
- `bg-badge-core`: 核心 (platform)

## 5. 组件开发规范

1. **UI 组件库**: 只能使用 `components/ui/` 目录下的 base-ui 组件。如果需要新组件，请先检查是否已存在。
2. **工具函数**: 日期格式化（`relativeTime`, `formatDate`）、类名合并（`cn`）等通用逻辑必须放在 `lib/utils.ts`，严禁在组件内重复实现。
3. **Tooltip**: 展示相对时间（如"3天前"）时，必须使用 `Tooltip` 组件包裹，悬停显示绝对时间。注意 base-ui 的 `TooltipTrigger` **不支持** `asChild` 属性。
4. **查询优化**: Supabase 查询必须明确指定 `select('field1, field2')`，严禁使用 `select('*')`。

## 6. 常见修改指南

- **新增一个外部集成 (Marketplace)**: 后端在 `agent_registry` 插入 `type='external'` 的记录，前端 `/marketplace` 自动显示。
- **修改 Agent 的职责标签**: 后端修改 `agent_registry.tags[0]`，前端自动映射颜色和中文。
- **修改导航栏**: 在 Sanity Studio 中修改 `site_config`。
- **修改 Dashboard 连接流程**: 检查 `app/dashboard/dashboard-client.tsx`，确保 `INTEGRATIONS` 数组中的 `agentId` 与数据库一致。
