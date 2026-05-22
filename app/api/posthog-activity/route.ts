import { NextRequest, NextResponse } from 'next/server'

const POSTHOG_HOST = 'https://us.posthog.com'
const POSTHOG_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY ?? ''
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? ''

// 查询某个 tenant 的客户活跃度事件
// 事件列表：live_board_view, marketplace_agent_connect_success, dashboard_telegram_cta_click, api_key_create
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenant_id')
  const tenantSlug = searchParams.get('tenant_slug')

  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
    return NextResponse.json({ error: 'PostHog not configured', events: {} }, { status: 200 })
  }

  const events = [
    'live_board_view',
    'marketplace_agent_connect_success',
    'dashboard_telegram_cta_click',
    'api_key_create',
  ]

  try {
    const counts: Record<string, number> = {}

    await Promise.all(events.map(async (event) => {
      const filter = tenantId
        ? `properties.tenant_id="${tenantId}"`
        : tenantSlug
        ? `properties.tenant_slug="${tenantSlug}"`
        : ''

      const query = {
        query: {
          kind: 'EventsQuery',
          select: ['count()'],
          event: event,
          where: filter ? [filter] : [],
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
        counts[event] = data?.results?.[0]?.[0] ?? 0
      } else {
        counts[event] = -1 // -1 表示查询失败
      }
    }))

    return NextResponse.json({ events: counts })
  } catch (e) {
    return NextResponse.json({ error: String(e), events: {} }, { status: 500 })
  }
}
