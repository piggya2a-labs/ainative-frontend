import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { LiveClient } from './live-client'
import { Navbar } from '@/components/navbar'
import { getSiteConfig } from '@/lib/queries'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MilestoneData {
  id: string
  order: number
  status: 'done' | 'in_progress' | 'pending'
  name: string
  completed_at?: string | null
  started_at?: string | null
  target_date?: string | null
  tasks_total: number
  tasks_done: number
  owner: string
  tasks?: { name: string; done: boolean; owner: string }[]
}

interface TenantMetadata {
  share_token: string
  current_milestone: string
  milestones: MilestoneData[]
  mcsp: {
    goal: string
    context?: string
    as_is?: string | string[]
    to_be?: string | string[]
    success_criteria?: { metric: string; baseline: string; target: string; method: string; checkpoint: string }[]
    risks?: { risk: string; level: 'high' | 'mid' | 'low'; mitigation: string; owner: string }[]
    cadence?: { type: string; frequency: string; duration: string; owner: string }[]
    credentials?: { name: string; type: string; note?: string }[]
    signed_m1: boolean
    signed_m3: boolean
    evidence_count: number
    modules_filled: number
    agent_ratio?: number
  }
  audit: {
    health: 'green' | 'yellow' | 'red'
    last_audit: string | null
    conclusion: string | null
    next_action: string | null
    eva_note: string | null
  }
  client: {
    name: string
    display_name: string
    contract_start: string
    plan_period: string
    lumen: string
    sega: string
    client_lead: string
    telegram_handle?: string
  }
  update_log: { date: string; author: string; note: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  const start = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function healthLabel(health: string) {
  if (health === 'green') return '健康'
  if (health === 'yellow') return '关注'
  return '风险'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LiveReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { name } = await params
  const { t: token } = await searchParams
  const siteConfig = await getSiteConfig()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 查询 tenant（用 slug 匹配）
  // ⚠️ 防回退：api_key 在 tenants 表，不要用 tenant_api_keys 表（已删）
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, slug, name, status, metadata, created_at, api_key')
    .eq('slug', name)
    .limit(1)

  if (error || !tenants || tenants.length === 0) {
    notFound()
  }

  const tenant = tenants[0]
  const meta = tenant.metadata as TenantMetadata | null

  // 验证 share_token
  if (!meta || !meta.share_token) {
    return (
      <><Navbar siteConfig={siteConfig} />
      <main className="min-h-screen flex items-center justify-center px-4 pt-14">
        <div className="text-center space-y-3">
          <div className="text-2xl font-bold">链接无效</div>
          <p className="text-sm text-muted-foreground">该客户尚未开通 Live 看板。</p>
        </div>
      </main></>
    )
  }

  if (meta.share_token !== token) {
    return (
      <><Navbar siteConfig={siteConfig} />
      <main className="min-h-screen flex items-center justify-center px-4 pt-14">
        <div className="text-center space-y-3">
          <div className="text-2xl font-bold">访问令牌无效</div>
          <p className="text-sm text-muted-foreground">请确认链接是否完整，或联系你的 ONIT 客户成功经理获取正确链接。</p>
        </div>
      </main></>
    )
  }

  // ⚠️ 防回退：不要用 tenant_api_keys 表（已删），api_key 在 tenants 表单字段
  // API Key 是否已生成（单 key 设计，0 或 1）
  const apiKeyCount = (tenant as Record<string, unknown>).api_key ? 1 : 0

  // 防御：client / audit 为空说明该 tenant 还未被 Agent 初始化。
  // 新建的 tenant 只有 share_token，其他字段要等 @Lumen 写入后才有。
  // 不要删除这个判断，否则新建看板会直接崩溃。
  if (!meta.client || !meta.audit) {
    return (
      <><Navbar siteConfig={siteConfig} />
      <main className="min-h-screen flex items-center justify-center px-4 pt-14">
        <div className="text-center space-y-6 max-w-sm">
          <div className="text-xs font-mono text-muted-foreground">ONIT / {tenant.name}</div>
          <div className="text-2xl font-bold">看板已创建</div>
          <p className="text-sm text-muted-foreground">
            Agent 团队正在等待你的第一条指令。
          </p>
          <ol className="text-sm text-left space-y-2 text-muted-foreground">
            <li><span className="font-semibold text-foreground">1.</span> 打开 Telegram，搜索 <span className="font-mono">@onitmeowbot</span></li>
            <li><span className="font-semibold text-foreground">2.</span> 发送这个看板的名字：<span className="font-mono">{tenant.name}</span></li>
            <li><span className="font-semibold text-foreground">3.</span> 告诉 Agent 这个项目的目标和背景</li>
          </ol>
          <a
            href="https://t.me/onitmeowbot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-80 transition-opacity"
          >
            打开 Telegram → @onitmeowbot
          </a>
        </div>
      </main></>
    )
  }

  const { client } = meta
  const runDays = daysSince(client.contract_start)

  return (
    <>
      {/* ─── 全站统一 Navbar ─── */}
      <Navbar siteConfig={siteConfig} />
      <main className="min-h-screen bg-background pt-14">
      {/* Client Component — PostHog + 29 数据点 */}
      <LiveClient
        meta={meta}
        tenantId={tenant.id}
        tenantName={tenant.name}
        tenantCreatedAt={tenant.created_at}
        tenantSlug={tenant.slug}
        apiKeyCount={apiKeyCount ?? 0}
        runDays={runDays}
      />
      </main>
    </>  
  )
}

// 禁止缓存，保证实时性
export const revalidate = 0
export const dynamic = 'force-dynamic'
