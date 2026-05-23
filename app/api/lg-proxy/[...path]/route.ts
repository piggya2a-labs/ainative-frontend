/**
 * /api/lg-proxy/[...path]
 *
 * 通用 LangGraph Cloud 透传代理（catch-all）。
 * 前端通过 useStream({ apiUrl: '/api/lg-proxy' }) 访问 LangGraph，
 * SDK 会自动追加路径（如 /threads/{id}/runs/stream），
 * 此代理将请求透传给 LangGraph Cloud，并注入 API Key。
 *
 * 支持 SSE stream 透传（Content-Type: text/event-stream）。
 */
import { NextRequest } from 'next/server'

const LG_URL = process.env.LANGSMITH_BASE_URL ?? 'https://piggya2a-0a1fda0a717459128b46c20d5a2662c7.us.langgraph.app'
const LG_KEY = process.env.LANGSMITH_API_KEY ?? ''

// 允许的路径前缀白名单（安全防护）
const ALLOWED_PREFIXES = ['/threads', '/assistants', '/runs', '/store', '/crons', '/info', '/ok']

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some(p => path.startsWith(p))
}

async function proxyRequest(
  req: NextRequest,
  method: string,
  params: { path: string[] }
) {
  const pathSegments = params.path ?? []
  const path = '/' + pathSegments.join('/')

  if (!isAllowed(path)) {
    return new Response('Forbidden', { status: 403 })
  }

  // 透传 query string（如 ?limit=50）
  const searchParams = req.nextUrl.searchParams.toString()
  const upstreamUrl = `${LG_URL}${path}${searchParams ? '?' + searchParams : ''}`

  const headers: Record<string, string> = {
    'x-api-key': LG_KEY,
  }

  let body: BodyInit | undefined = undefined
  const contentType = req.headers.get('content-type') ?? ''
  if (method !== 'GET' && method !== 'DELETE') {
    if (contentType.includes('application/json')) {
      body = await req.text()
      headers['Content-Type'] = 'application/json'
    }
  }

  // 透传 Accept 头（SSE stream 需要）
  const accept = req.headers.get('accept')
  if (accept) headers['Accept'] = accept

  const upstream = await fetch(upstreamUrl, {
    method,
    headers,
    body,
    // 禁止 Node.js 自动解压（SSE stream 需要原始字节流）
    // @ts-expect-error Node.js fetch 扩展
    duplex: 'half',
  })

  // SSE stream 直接透传
  const respContentType = upstream.headers.get('content-type') ?? ''
  if (respContentType.includes('text/event-stream') && upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  // 普通 JSON 响应
  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  })
}

type RouteContext = { params: Promise<{ path: string[] }> }

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, 'GET', await ctx.params)
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, 'POST', await ctx.params)
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, 'DELETE', await ctx.params)
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, 'PATCH', await ctx.params)
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, 'PUT', await ctx.params)
}
