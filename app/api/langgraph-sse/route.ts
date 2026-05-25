import { NextRequest } from 'next/server'

const LGURL = process.env.LANGGRAPH_URL ?? 'https://piggya2a-0a1fda0a717459128b46c20d5a2662c7.us.langgraph.app'
const LGKEY = process.env.LANGSMITH_API_KEY ?? ''

/**
 * /api/langgraph-sse
 *
 * 服务端 SSE 代理：每 2 秒查一次 LangGraph thread state，
 * 把 status 变化推送给浏览器。浏览器用 EventSource 接收。
 *
 * 用法：GET /api/langgraph-sse?thread_id=xxx
 *
 * SSE 事件格式：
 *   event: thread_status
 *   data: { "status": "busy"|"idle"|"interrupted", "interrupt_value": "..." | null }
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const threadId = url.searchParams.get('thread_id')

  if (!threadId) {
    return new Response('missing thread_id', { status: 400 })
  }

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      // 发送初始心跳
      controller.enqueue(encoder.encode(': connected\n\n'))

      let lastStatus: string | null = null

      const poll = async () => {
        if (closed) return
        try {
          const res = await fetch(`${LGURL}/threads/${threadId}/state`, {
            headers: { 'x-api-key': LGKEY },
          })
          if (!res.ok) return

          const state = await res.json() as {
            status?: string
            tasks?: Array<{ interrupts?: Array<{ value?: unknown }> }>
            interrupts?: Array<{ value?: unknown }>
          }

          const status = state?.status ?? 'idle'

          // 只在状态变化时推送（减少噪音）
          if (status !== lastStatus) {
            lastStatus = status

            // 读取 interrupt value
            let interruptValue: string | null = null
            if (status === 'interrupted') {
              const tasks = state?.tasks
              const firstInterrupt = tasks?.flatMap(t => t.interrupts ?? []).find(Boolean)
              if (firstInterrupt?.value != null) {
                interruptValue = String(firstInterrupt.value).slice(0, 200)
              } else {
                const topInterrupts = state?.interrupts
                const topFirst = topInterrupts?.[0]
                interruptValue = topFirst?.value != null ? String(topFirst.value).slice(0, 200) : null
              }
            }

            const payload = JSON.stringify({ status, interrupt_value: interruptValue })
            controller.enqueue(encoder.encode(`event: thread_status\ndata: ${payload}\n\n`))
          } else {
            // 发送心跳保持连接
            controller.enqueue(encoder.encode(': ping\n\n'))
          }
        } catch {
          // 忽略错误，继续轮询
          controller.enqueue(encoder.encode(': error\n\n'))
        }
      }

      // 立即查一次
      await poll()

      // 每 2 秒查一次
      const timer = setInterval(async () => {
        if (closed) {
          clearInterval(timer)
          return
        }
        await poll()
      }, 2000)

      // 30 秒后自动关闭（客户端会重连）
      setTimeout(() => {
        if (!closed) {
          closed = true
          clearInterval(timer)
          try { controller.close() } catch { /* ignore */ }
        }
      }, 30000)
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
