import { NextRequest, NextResponse } from 'next/server'

const LGURL = process.env.LANGGRAPH_URL ?? 'https://piggya2a-0a1fda0a717459128b46c20d5a2662c7.us.langgraph.app'
const LGKEY = process.env.LANGSMITH_API_KEY ?? ''

/**
 * /api/langgraph-trace
 *
 * 服务端安全代理，API key 不暴露给浏览器。
 * 支持 LangGraph Agent Service 全部原生路径：
 *
 * Threads
 *   POST /threads/search                          搜索 threads
 *   GET  /threads/{id}/runs                       列出 runs
 *   GET  /threads/{id}/state                      当前 state（含 status、interrupts）
 *   GET  /threads/{id}/history                    checkpoint 历史
 *   POST /threads/{id}/runs/{rid}/cancel          取消 run（interrupt 模式）
 *   POST /threads/{id}/state                      update_state（时间旅行恢复）
 *   POST /threads/{id}/copy                       fork thread
 *   DELETE /threads/{id}                          删除 thread
 *   POST /threads/prune                           批量清理 threads
 *
 * Crons
 *   GET  /crons                                   列出所有 cron jobs
 *   POST /crons                                   创建 cron job
 *   DELETE /crons/{cron_id}                       删除 cron job
 *   PATCH /crons/{cron_id}                        更新 cron job
 *
 * Store（跨 Thread 持久化 KV）
 *   POST /store/items                             put_item / get_item（body 决定）
 *   GET  /store/items                             get_item
 *   DELETE /store/items                           delete_item
 *   POST /store/namespaces                        list_namespaces
 *   POST /store/items/search                      search_items
 *
 * Assistants
 *   GET  /assistants                              列出所有 assistants
 *   GET  /assistants/{id}                         获取单个 assistant
 */
export async function POST(req: NextRequest) {
  return handleRequest(req, 'POST')
}

export async function GET(req: NextRequest) {
  return handleRequest(req, 'GET')
}

export async function DELETE(req: NextRequest) {
  return handleRequest(req, 'DELETE')
}

export async function PATCH(req: NextRequest) {
  return handleRequest(req, 'PATCH')
}

async function handleRequest(req: NextRequest, httpMethod: string) {
  try {
    let path: string
    let body: unknown
    let explicitMethod: string | undefined

    if (httpMethod === 'GET' || httpMethod === 'DELETE') {
      // GET/DELETE：从 query params 读取 path
      const url = new URL(req.url)
      path = url.searchParams.get('path') ?? ''
      body = undefined
      explicitMethod = httpMethod
    } else {
      // POST/PATCH：从 body 读取
      const json = await req.json()
      path = json.path ?? ''
      body = json.body
      explicitMethod = json.method // 可选：调用方可强制指定方法（如 DELETE via POST）
    }

    if (!path) {
      return NextResponse.json({ error: 'missing path' }, { status: 400 })
    }

    // 路径白名单：只允许 LangGraph Agent Service 原生路径
    const allowed =
      path.startsWith('/threads') ||
      path.startsWith('/crons') ||
      path.startsWith('/store') ||
      path.startsWith('/assistants')

    if (!allowed) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // 方法推断（explicitMethod 优先）
    const method = explicitMethod ?? inferMethod(path, httpMethod)

    const fetchOptions: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json', 'x-api-key': LGKEY },
    }
    if ((method === 'POST' || method === 'PATCH') && body !== undefined) {
      fetchOptions.body = JSON.stringify(body)
    }

    const resp = await fetch(`${LGURL}${path}`, fetchOptions)

    // 204 No Content（cancel、delete 等）
    if (resp.status === 204) {
      return new NextResponse(null, { status: 204 })
    }

    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

/**
 * 从路径模式推断 HTTP 方法
 */
function inferMethod(path: string, httpMethod: string): string {
  // 明确的写操作路径
  if (path.endsWith('/cancel')) return 'POST'
  if (path.endsWith('/copy')) return 'POST'
  if (path.endsWith('/prune')) return 'POST'
  if (path.endsWith('/state') && httpMethod === 'POST') return 'POST'  // update_state

  // 读操作路径
  if (
    path.endsWith('/runs') ||
    path.endsWith('/state') ||
    path.endsWith('/history') ||
    path === '/assistants' ||
    path === '/crons' ||
    path.match(/^\/assistants\/[^/]+$/) ||
    path.match(/^\/crons\/[^/]+$/)
  ) return 'GET'

  // store 操作
  if (path.startsWith('/store')) return httpMethod === 'GET' ? 'GET' : 'POST'

  // 默认
  return 'POST'
}
