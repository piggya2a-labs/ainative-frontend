import { NextRequest, NextResponse } from 'next/server'

const LGURL = process.env.LANGGRAPH_URL ?? 'https://piggya2a-0a1fda0a717459128b46c20d5a2662c7.us.langgraph.app'
const LGKEY = process.env.LANGSMITH_API_KEY ?? ''

export async function POST(req: NextRequest) {
  try {
    const { path, body } = await req.json()

    // 只允许查询 threads 和 runs，不允许写操作
    if (!path.startsWith('/threads')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const method = path.endsWith('/runs') ? 'GET' : 'POST'
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
