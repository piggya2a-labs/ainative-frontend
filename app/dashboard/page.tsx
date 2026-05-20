import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { DashboardClient } from './dashboard-client'

// ─── MCSP 默认 metadata 生成器 ────────────────────────────────────────────────
function buildDefaultMcspMetadata(tenantName: string, tenantSlug: string, createdAt: string) {
  const today = new Date().toISOString().slice(0, 10)
  const contractStart = createdAt.slice(0, 10)
  // M1 target: 合同开始后 4 周
  const m1Target = new Date(new Date(contractStart).getTime() + 28 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10)
  const shareToken = `${tenantSlug}-live-${new Date().getFullYear()}q${Math.ceil((new Date().getMonth() + 1) / 3)}`

  return {
    share_token: shareToken,
    current_milestone: 'M1',
    milestones: [
      {
        id: 'M0',
        order: 0,
        status: 'done',
        name: '找到合适的 Agent',
        completed_at: contractStart,
        started_at: contractStart,
        target_date: null,
        tasks_total: 3,
        tasks_done: 3,
        owner: '@Polly',
        tasks: [
          { name: '候选 Agent 调研清单输出完毕', done: true, owner: '@Polly' },
          { name: '选定目标 Agent，双方确认', done: true, owner: tenantName },
          { name: '双方签认，M1 正式启动', done: true, owner: '双方' },
        ],
      },
      {
        id: 'M1',
        order: 1,
        status: 'in_progress',
        name: '交付试用设计方案',
        started_at: contractStart,
        target_date: m1Target,
        completed_at: null,
        tasks_total: 4,
        tasks_done: 0,
        owner: '@Lumen',
        tasks: [
          { name: '共同成功计划初稿完成，等待客户确认', done: false, owner: '@Lumen' },
          { name: 'pipe/workflow 设计方案完成', done: false, owner: '@Sega' },
          { name: '成功标准确认，或提出修改', done: false, owner: tenantName },
          { name: 'MCSP + OMT 双方签认，M2 正式启动', done: false, owner: '双方' },
        ],
      },
      {
        id: 'M2',
        order: 2,
        status: 'pending',
        name: '试运行完成',
        started_at: null,
        target_date: null,
        completed_at: null,
        tasks_total: 4,
        tasks_done: 0,
        owner: '@Sega',
        tasks: [
          { name: 'Agent 接入客户系统，完成冒烟测试', done: false, owner: '@Sega' },
          { name: '试运行 2 周，LangSmith 全链路追踪', done: false, owner: '@Sega' },
          { name: '客户验收试运行结果', done: false, owner: tenantName },
          { name: 'M2 双方签认，M3 正式启动', done: false, owner: '双方' },
        ],
      },
      {
        id: 'M3',
        order: 3,
        status: 'pending',
        name: '审计验证通过',
        started_at: null,
        target_date: null,
        completed_at: null,
        tasks_total: 3,
        tasks_done: 0,
        owner: '@Eva',
        tasks: [
          { name: '@Eva 执行完整审计，输出结论', done: false, owner: '@Eva' },
          { name: '成功标准全部达标确认', done: false, owner: '@Eva' },
          { name: '双方签认验收报告，归档', done: false, owner: '双方' },
        ],
      },
    ],
    mcsp: {
      goal: `帮助 ${tenantName} 团队完成 AI Native 多 Agent 工作流的试运行验证，实现从人工操作到 Agent 自动化的第一个闭环`,
      context: '',
      as_is: '',
      to_be: '',
      success_criteria: [
        { metric: 'Agent 自动化覆盖率', baseline: '0%', target: '≥70%', method: 'M3 审计', checkpoint: 'M3' },
        { metric: '里程碑按时完成率', baseline: '—', target: 'M0-M3 全部在目标日期内', method: 'M3 审计', checkpoint: 'M3' },
        { metric: '审计通过', baseline: '—', target: '@Eva 审计结论为通过', method: 'M3 审计', checkpoint: 'M3' },
      ],
      risks: [
        { risk: 'API 权限审批延迟', level: 'mid', mitigation: '提前 2 周发送权限申请清单', owner: '' },
        { risk: 'Agent 输出质量不达预期', level: 'low', mitigation: 'LangSmith 全链路追踪 + 每周抽查', owner: '' },
      ],
      cadence: [
        { type: '周会', frequency: '每周固定时间', duration: '30 min', owner: '@Lumen' },
        { type: '月度 QBR', frequency: '每月一次', duration: '60 min', owner: '@Lumen' },
        { type: '里程碑验收', frequency: '每个 M 节点', duration: '按需', owner: '双方' },
      ],
      credentials: [],
      signed_m1: false,
      signed_m3: false,
      evidence_count: 0,
      modules_filled: 3,
    },
    audit: {
      health: 'yellow',
      last_audit: null,
      conclusion: null,
      next_action: '等待 @Lumen 完成 MCSP 初稿，与客户确认成功标准后推进 M1 签认',
      eva_note: null,
    },
    client: {
      name: tenantName,
      display_name: tenantName,
      contract_start: contractStart,
      plan_period: `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`,
      lumen: 'Lumen',
      sega: 'Sega',
      client_lead: '',
    },
    update_log: [
      { date: today, author: '@Lumen', note: 'MCSP 自动初始化，M0 已完成，M1 正式启动' },
    ],
  }
}

export default async function DashboardPage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.is_anonymous) {
    redirect('/login')
  }

  // Tenant
  const { data: tenantRaw } = await supabase
    .from('tenants')
    .select('id, name, slug, status, created_at, metadata')
    .eq('user_id', user.id)
    .single()

  // ─── 自动初始化 MCSP metadata ────────────────────────────────────────────────
  // 如果 tenant 存在但 metadata 里没有 share_token，自动生成并写入
  let tenant = tenantRaw
  if (tenant && !(tenant.metadata as Record<string, unknown> | null)?.share_token) {
    const defaultMeta = buildDefaultMcspMetadata(tenant.name, tenant.slug, tenant.created_at)
    // 用 service role 写入（绕过 RLS）
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: updated, error: updateError } = await adminClient
      .from('tenants')
      .update({ metadata: defaultMeta })
      .eq('id', tenant.id)
      .select('id, name, slug, status, created_at, metadata')
      .single()
    if (updateError) {
      console.error('[MCSP init] update error:', JSON.stringify(updateError))
    }
    // 用更新后的 tenant 继续渲染（直接替换，不用 Object.assign）
    if (updated) {
      tenant = updated
    } else {
      console.error('[MCSP init] updated is null, using defaultMeta for render')
      tenant = { ...tenant, metadata: defaultMeta }
    }
  }

  // API Keys
  const { data: apiKeys } = tenant
    ? await supabase
        .from('tenant_api_keys')
        .select('id, name, key_prefix, created_at, last_used_at')
        .eq('tenant_id', tenant.id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
    : { data: [] }

  // 用户在 Marketplace 已连接的外部 MCP（从 tenant_connectors 读取）
  const { data: mcpConnectors } = tenant
    ? await supabase
        .from('tenant_connectors')
        .select('id, agent_id, status, metadata, created_at, discovered_tools')
        .eq('tenant_id', tenant.id)
        .eq('status', 'connected')
        .order('created_at', { ascending: false })
    : { data: [] }

  // 拿到 agent_registry 里对应的名字和描述
  const mcpAgentIds = (mcpConnectors ?? []).map(c => c.agent_id).filter(Boolean)
  const { data: mcpAgentCards } = mcpAgentIds.length > 0
    ? await supabase
        .from('agent_registry')
        .select('id, name, description, skills')
        .in('id', mcpAgentIds)
    : { data: [] }

  // 合并成前端需要的格式
  const mcpTools = (mcpConnectors ?? []).map(c => {
    const card = (mcpAgentCards ?? []).find(a => a.id === c.agent_id)
    return {
      id: c.id,
      agent_id: c.agent_id,
      name: card?.name ?? c.agent_id,
      description: card?.description ?? '',
      skills: (card?.skills ?? []) as Array<{ id: string; name: string; description: string }>,
      connected_at: c.created_at,
    }
  })

  // GitHub 集成状态（从 github_installation_bindings 读）
  const { data: githubBindings } = tenant
    ? await supabase
        .from('github_installation_bindings')
        .select('id, repository_full_name, status, created_at')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
    : { data: [] }

  // Channel connectors（渠道连接状态，用于 Integrations 区块）
  const { data: connectors } = tenant
    ? await supabase
        .from('tenant_connectors')
        .select('id, agent_id, status, metadata, created_at')
        .eq('tenant_id', tenant.id)
    : { data: [] }

  // Recent audit logs（最近 10 条系统活动）
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('id, action, resource_type, status, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <DashboardClient
      user={user}
      tenant={tenant}
      initialApiKeys={apiKeys ?? []}
      agents={[]}
      mcpTools={mcpTools}
      githubBindings={githubBindings ?? []}
      connectors={connectors ?? []}
      auditLogs={auditLogs ?? []}
    />
  )
}
