import { NextRequest, NextResponse } from 'next/server'

const LGURL = process.env.LANGGRAPH_URL ?? 'https://piggya2a-0a1fda0a717459128b46c20d5a2662c7.us.langgraph.app'
const LGKEY = process.env.LANGSMITH_API_KEY ?? ''

export async function POST(req: NextRequest) {
  try {
    const { path, body } = await req.json()

    // 只允许 /threads 路径
    // 支持路径：/threads/search、/threads/{id}/runs、/threads/{id}/state、
    //           /threads/{id}/history、/threads/{id}/runs/{rid}/cancel
    if (!path.startsWith('/threads')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // 方法推断：cancel → POST；runs/state/history 结尾 → GET；其余 → POST
    let method: string
    if (path.endsWith('/cancel')) {
      method = 'POST'
    } else if (
      path.endsWith('/runs') ||
      path.endsWith('/state') ||
      path.endsWith('/history')
    ) {
      method = 'GET'
    } else {
      method = 'POST'
    }
    const fetchOptions: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json', 'x-api-key': LGKEY },
    }
    if (method === 'POST' && body) {
      fetchOptions.body = JSON.stringify(body)
    }

    const resp = await fetch(`${LGURL}${path}`, fetchOptions)
    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
