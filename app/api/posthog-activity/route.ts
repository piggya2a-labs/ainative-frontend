import { NextRequest, NextResponse } from 'next/server'

const POSTHOG_HOST = 'https://us.posthog.com'
const POSTHOG_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY ?? ''
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? ''

// 查询某个 tenant 的客户活跃度事件
// 事件名以实际 PostHog 埋点为准：
//   live_board_view          → 客户访问 Live 看板（live-client useEffect 埋点）
//   live_report_tab_switch   → 客户切换 Tab（有数据，作为「看板互动」备用）
//   marketplace_agent_connect_click → 连接 Agent 点击
//   api_key_create           → 创建 API Key
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenant_id')
  const tenantSlug = searchParams.get('tenant_slug')

  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
    return NextResponse.json({ error: 'PostHog not configured', events: {} }, { status: 200 })
  }

  // 事件列表：[查询事件名, 返回 key]（按 tenant_id 过滤，只统计这个 tenant 的看板数据）
  const eventMap: [string, string][] = [
    ['live_board_nav',                   'live_board_nav'],                   // 看板访问/导航次数
    ['live_report_tab_switch',           'live_report_tab_switch'],           // 看板互动次数
    ['marketplace_agent_connect_click',  'marketplace_agent_connect_click'],  // Agent 连接点击
    ['live_report_telegram_click',       'live_report_telegram_click'],       // Telegram 点击
  ]

  try {
    const counts: Record<string, number> = {}

    await Promise.all(eventMap.map(async ([eventName, returnKey]) => {
      // 优先用 tenant_id 过滤，其次 tenant_slug，都没有则全局计数
      const filters: string[] = []
      if (tenantId) filters.push(`properties.tenant_id = '${tenantId}'`)
      else if (tenantSlug) filters.push(`properties.tenant_slug = '${tenantSlug}'`)

      const query = {
        query: {
          kind: 'EventsQuery',
          select: ['count()'],
          where: [`event = '${eventName}'`, ...filters],
          limit: 1,
        },
      }

      const resp = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${POSTHOG_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      })

      if (resp.ok) {
        const data = await resp.json()
        counts[returnKey] = data?.results?.[0]?.[0] ?? 0
      } else {
        counts[returnKey] = -1 // -1 表示查询失败
      }
    }))

    return NextResponse.json({ events: counts })
  } catch (e) {
    return NextResponse.json({ error: String(e), events: {} }, { status: 500 })
  }
}
