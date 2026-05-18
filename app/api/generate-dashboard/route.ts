import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Dashboard 配置的结构定义
export interface DashboardConfig {
  workspace_name: string        // AI 生成的工作区名称
  tagline: string               // 一句话描述这个工作区的目标
  welcome_message: string       // 欢迎语，个性化
  primary_goal: string          // 用户的核心目标（提炼自 JTBD）
  suggested_agents: Array<{     // 推荐的 Agent 配置
    name: string
    role: string
    description: string
    priority: 'high' | 'medium' | 'low'
  }>
  suggested_integrations: string[]  // 推荐优先连接的工具
  quick_actions: Array<{            // 快捷操作卡片
    label: string
    description: string
    action: string
  }>
  metrics_to_track: Array<{         // 建议追踪的指标
    label: string
    description: string
  }>
  onboarding_steps: Array<{         // 个性化的上手步骤
    step: number
    title: string
    description: string
    completed: boolean
  }>
}

const SYSTEM_PROMPT = `你是 ONIT 的 AI 助手，ONIT 是一个 AI Agent 团队平台，帮助用户构建和管理自动化 Agent 团队。

用户会告诉你他们想用 Agent 团队做什么（JTBD）。你需要根据这个需求，生成一份个性化的 Dashboard 配置，帮助用户快速上手。

你必须返回严格的 JSON 格式，不要有任何额外文字。JSON 结构如下：

{
  "workspace_name": "工作区名称（2-4个字，简洁有力，体现用户的业务方向）",
  "tagline": "一句话描述这个工作区的核心目标（不超过20字）",
  "welcome_message": "个性化欢迎语，提到用户的具体目标，鼓励性语气（不超过50字）",
  "primary_goal": "用户核心目标的精炼表述（不超过15字）",
  "suggested_agents": [
    {
      "name": "Agent名称",
      "role": "角色定位（如：内容策略师、数据分析师）",
      "description": "这个Agent具体做什么（不超过30字）",
      "priority": "high|medium|low"
    }
  ],
  "suggested_integrations": ["最相关的工具名称，从以下选择：GitHub, Slack, Supabase, PostHog, Sanity, Vercel, LangGraph, Trigger.dev"],
  "quick_actions": [
    {
      "label": "操作名称",
      "description": "这个操作做什么（不超过20字）",
      "action": "操作标识符（英文小写下划线）"
    }
  ],
  "metrics_to_track": [
    {
      "label": "指标名称",
      "description": "为什么追踪这个指标（不超过20字）"
    }
  ],
  "onboarding_steps": [
    {
      "step": 1,
      "title": "步骤标题",
      "description": "具体要做什么（不超过30字）",
      "completed": false
    }
  ]
}

要求：
- suggested_agents 提供 3-5 个，按优先级排序
- suggested_integrations 提供 2-4 个最相关的
- quick_actions 提供 3 个
- metrics_to_track 提供 3 个
- onboarding_steps 提供 4 个，从最基础到最进阶
- 所有内容必须高度贴合用户的具体业务场景，不要泛泛而谈
- 语言风格：专业、简洁、有行动力`

export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { jtbd, team_size, industry } = await req.json()
    if (!jtbd) {
      return NextResponse.json({ error: 'JTBD is required' }, { status: 400 })
    }

    const userPrompt = `用户信息：
- 想用 Agent 团队做的事：${jtbd}
- 团队规模：${team_size || '未填写'}
- 行业/领域：${industry || '未填写'}

请根据以上信息生成个性化的 Dashboard 配置。`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const config = JSON.parse(completion.choices[0].message.content || '{}') as DashboardConfig

    // 存入 tenant metadata
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (tenant) {
      await supabase
        .from('tenants')
        .update({
          name: config.workspace_name,
          metadata: {
            dashboard_config: config,
            jtbd,
            team_size,
            industry,
            generated_at: new Date().toISOString(),
          }
        })
        .eq('id', tenant.id)
    }

    return NextResponse.json({ config })
  } catch (err) {
    console.error('Dashboard generation error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
