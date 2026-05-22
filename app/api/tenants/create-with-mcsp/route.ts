import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import OpenAI from 'openai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const adminClient = createClient(supabaseUrl, serviceRoleKey)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function buildSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'project'
  const suffix = Math.random().toString(16).slice(2, 10)
  return `${base}-${suffix}`
}

function makeShareToken(slug: string): string {
  const now = new Date()
  const q = Math.ceil((now.getMonth() + 1) / 3)
  return `${slug}-live-${now.getFullYear()}q${q}`
}

function buildMcspMetadata(params: {
  slug: string
  tenantName: string
  clientLead: string
  telegramHandle: string
  goal: string
  context: string
  asIs: string
  toBe: string
  contractStart: string
  planPeriod: string
}) {
  const { slug, tenantName, clientLead, telegramHandle, goal, context, asIs, toBe, contractStart, planPeriod } = params
  const today = new Date().toISOString().slice(0, 10)
  const m1Target = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10)
  const shareToken = makeShareToken(slug)

  return {
    share_token: shareToken,
    current_milestone: 'M1',
    milestones: [
      {
        id: 'M0', order: 0, status: 'done',
        name: '找到合适的 Agent',
        completed_at: contractStart, started_at: contractStart, target_date: null,
        tasks_total: 3, tasks_done: 3, owner: '@Polly',
        tasks: [
          { id: 'M0T1', name: '候选 Agent 调研清单输出完毕', status: 'done', owner: '@Polly' },
          { id: 'M0T2', name: '选定目标 Agent，双方确认', status: 'done', owner: tenantName },
          { id: 'M0T3', name: '双方签认，M1 正式启动', status: 'done', owner: '双方' },
        ],
      },
      {
        id: 'M1', order: 1, status: 'in_progress',
        name: '交付试用设计方案',
        started_at: contractStart, target_date: m1Target, completed_at: null,
        blocked_reason: null, retry_count: 0,
        tasks_total: 4, tasks_done: 0, owner: '@Lumen',
        tasks: [
          { id: 'M1T1', name: '共同成功计划初稿完成，等待客户确认', status: 'pending', owner: '@Lumen' },
          { id: 'M1T2', name: 'pipe/workflow 设计方案完成', status: 'pending', owner: '@Sega' },
          { id: 'M1T3', name: '成功标准确认，或提出修改', status: 'pending', owner: tenantName },
          { id: 'M1T4', name: 'MCSP + OMT 双方签认，M2 正式启动', status: 'pending', owner: '双方' },
        ],
      },
      {
        id: 'M2', order: 2, status: 'pending',
        name: '试运行完成',
        started_at: null, target_date: null, completed_at: null,
        blocked_reason: null, retry_count: 0,
        tasks_total: 4, tasks_done: 0, owner: '@Sega',
        tasks: [
          { id: 'M2T1', name: 'Agent 接入客户系统，完成冒烟测试', status: 'pending', owner: '@Sega' },
          { id: 'M2T2', name: '试运行 2 周，LangSmith 全链路追踪', status: 'pending', owner: '@Sega' },
          { id: 'M2T3', name: '客户验收试运行结果', status: 'pending', owner: tenantName },
          { id: 'M2T4', name: 'M2 双方签认，M3 正式启动', status: 'pending', owner: '双方' },
        ],
      },
      {
        id: 'M3', order: 3, status: 'pending',
        name: '审计验证通过',
        started_at: null, target_date: null, completed_at: null,
        blocked_reason: null, retry_count: 0,
        tasks_total: 3, tasks_done: 0, owner: '@Eva',
        tasks: [
          { id: 'M3T1', name: '@Eva 执行完整审计，输出结论', status: 'pending', owner: '@Eva' },
          { id: 'M3T2', name: '成功标准全部达标确认', status: 'pending', owner: '@Eva' },
          { id: 'M3T3', name: '双方签认验收报告，归档', status: 'pending', owner: '双方' },
        ],
      },
    ],
    mcsp: {
      goal,
      context,
      as_is: asIs,
      to_be: toBe,
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
      modules_filled: 5,
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
      contract_start: contractStart,
      plan_period: planPeriod,
      lumen: 'Lumen',
      sega: 'Sega',
      client_lead: clientLead,
      telegram_handle: telegramHandle,
    },
    update_log: [
      { date: today, author: '@Lumen', type: 'system', note: 'MCSP 初始化完成，M0 已完成，M1 正式启动' },
    ],
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { brief } = body  // 用户输入的自由文本（项目背景）

  if (!brief?.trim()) {
    return NextResponse.json({ error: '请描述一下你的项目' }, { status: 400 })
  }

  // ── 用 GPT 解析用户输入，提取 MCSP 关键字段 ──────────────────────────────
  let parsed: {
    name: string
    goal: string
    as_is: string
    to_be: string
    client_lead: string
    telegram_handle: string
    context: string
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `你是 ONIT 的项目助手。用户会描述一个项目的背景，你需要从中提取关键信息，返回 JSON。

返回格式（严格 JSON，所有字段都要有值，没有就用合理的默认值）：
{
  "name": "项目/客户名称（简短，如 Acme Corp、小红书客服项目）",
  "goal": "一句话合作目标（如：帮助 XX 团队将客服自动化覆盖率提升到 70%）",
  "as_is": "现状描述（客户现在的处境和痛点，1-3句）",
  "to_be": "理想状态（3个月后希望达到什么，1-3句）",
  "client_lead": "客户负责人姓名（没有就填 待确认）",
  "telegram_handle": "客户 Telegram handle（没有就填空字符串）",
  "context": "背景信息（为什么现在做这件事，可以为空字符串）"
}

注意：
- name 要简短，不超过 20 个字
- goal 要具体、可衡量
- as_is 和 to_be 要对比鲜明
- 所有字段都必须是字符串，不能是 null 或 undefined`,
        },
        {
          role: 'user',
          content: brief.trim(),
        },
      ],
      max_tokens: 600,
      temperature: 0.3,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    parsed = JSON.parse(raw)
  } catch (e) {
    return NextResponse.json({ error: `AI 解析失败: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }

  // 确保所有字段都有值
  const name = (parsed.name || '新项目').trim().slice(0, 50)
  const goal = parsed.goal || '待填写'
  const asIs = parsed.as_is || '待填写'
  const toBe = parsed.to_be || '待填写'
  const clientLead = parsed.client_lead || '待确认'
  const telegramHandle = parsed.telegram_handle || ''
  const context = parsed.context || ''

  const slug = buildSlug(name)
  const contractStart = new Date().toISOString().slice(0, 10)

  const metadata = buildMcspMetadata({
    slug,
    tenantName: name,
    clientLead,
    telegramHandle,
    goal,
    context,
    asIs,
    toBe,
    contractStart,
    planPeriod: '3 个月',
  })

  // ── 写入数据库 ────────────────────────────────────────────────────────────
  const { data, error } = await adminClient
    .from('tenants')
    .insert({
      user_id: user.id,
      name,
      slug,
      status: 'triage',
      metadata,
    })
    .select('id, name, slug, status, created_at, metadata')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const liveUrl = `https://ainative-frontend.vercel.app/r/${slug}?t=${metadata.share_token}`

  return NextResponse.json({
    tenant: data,
    live_url: liveUrl,
    parsed: { name, goal, as_is: asIs, to_be: toBe, client_lead: clientLead },
  })
}
