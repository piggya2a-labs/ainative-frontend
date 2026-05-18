import { NextRequest, NextResponse } from 'next/server'

// Agent 调用此接口读取 PostHog 行为数据摘要
// GET /api/agent/analytics?event=hero_cta_click&days=7

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const expectedToken = process.env.AGENT_API_SECRET

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const event = searchParams.get('event')
  const days = parseInt(searchParams.get('days') || '7')

  const posthogApiKey = process.env.POSTHOG_PERSONAL_API_KEY
  const posthogProjectId = process.env.POSTHOG_PROJECT_ID

  if (!posthogApiKey || !posthogProjectId) {
    return NextResponse.json({ error: 'PostHog not configured' }, { status: 503 })
  }

  try {
    // 查询 PostHog Insights API
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const query = event
      ? `event=${encodeURIComponent(event)}&date_from=${dateFrom}`
      : `date_from=${dateFrom}`

    const response = await fetch(
      `https://app.posthog.com/api/projects/${posthogProjectId}/events/?${query}&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${posthogApiKey}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`PostHog API error: ${response.status}`)
    }

    const data = await response.json()

    // 聚合统计
    const eventCounts: Record<string, number> = {}
    const results = data.results || []

    for (const evt of results) {
      const name = evt.event
      eventCounts[name] = (eventCounts[name] || 0) + 1
    }

    return NextResponse.json({
      period: `${days}d`,
      totalEvents: results.length,
      eventBreakdown: eventCounts,
      topEvents: Object.entries(eventCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: String(error) },
      { status: 500 }
    )
  }
}
