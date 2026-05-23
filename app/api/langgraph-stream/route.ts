/**
 * /api/langgraph-stream
 *
 * KR3: SSE 代理 — 把 LangGraph thread stream 转发给浏览器。
 * 浏览器用 EventSource 订阅，Agent 每跑一步看板自动更新。
 *
 * GET  ?thread_id=<id>           → 订阅最新 run 的 SSE stream
 * POST { thread_id, command }    → 发送 Command(resume) 恢复 interrupt（KR4）
 *
 * 设计原则：
 * - API key 在服务端，不暴露给浏览器
 * - 只允许读取 /threads/{id}/stream 和发送 resume command
 * - interrupt 事件透传给前端，前端渲染 Human Gate UI
 */

import { NextRequest } from 'next/server'

const LG_URL = process.env.LANGSMITH_BASE_URL ?? 'https://piggya2a-0a1fda0a717459128b46c20d5a2662c7.us.langgraph.app'
const LG_KEY = process.env.LANGSMITH_API_KEY ?? ''

// ── GET: SSE stream proxy ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get('thread_id')
  if (!threadId) {
    return new Response('Missing thread_id', { status: 400 })
  }

  // 先查 thread 最新 run，再订阅该 run 的 stream
  const runsRes = await fetch(
    `${LG_URL}/threads/${threadId}/runs?limit=1`,
    { headers: { 'x-api-key': LG_KEY } }
  )
  if (!runsRes.ok) {
    return new Response(`LangGraph error: ${runsRes.status}`, { status: 502 })
  }
  const runs: Array<{ run_id: string; status: string }> = await runsRes.json()
  const latestRun = runs[0]

  // 如果没有 active run（pending 或 running），返回 thread state 的 interrupt 检查
  const isActive = latestRun && (latestRun.status === 'pending' || latestRun.status === 'running')
  if (!isActive) {
    // 查 thread state 看是否有 pending interrupt
    const stateRes = await fetch(
      `${LG_URL}/threads/${threadId}/state`,
      { headers: { 'x-api-key': LG_KEY } }
    )
    const state = stateRes.ok ? await stateRes.json() : {}
    const nextNodes: string[] = state?.next ?? []
    const hasInterrupt = nextNodes.length > 0

    // 从 tasks 里提取 interrupt items（__interrupt__ 调用产生的）
    const taskInterrupts: unknown[] = state?.tasks?.flatMap((t: { interrupts?: unknown[] }) => t.interrupts ?? []) ?? []
    // 如果是 interrupt_before 暂停（nextNodes 有值但 taskInterrupts 为空），构造默认 interrupt item
    const interruptItems = taskInterrupts.length > 0
      ? taskInterrupts
      : hasInterrupt
        ? [{ value: `Agent 已暂停，等待确认后继续执行节点：${nextNodes.join(', ')}`, resumable: true }]
        : []

    const payload = JSON.stringify({
      type: 'snapshot',
      thread_id: threadId,
      has_interrupt: hasInterrupt,
      interrupts: interruptItems,
      messages: state?.values?.messages ?? [],
      // 当 thread 有 interrupt 时，run_status 应该是 interrupted，不管 run 本身是否 success
      run_status: hasInterrupt ? 'interrupted' : (latestRun?.status ?? 'idle'),
    })

    return new Response(
      `data: ${payload}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      }
    )
  }

  // 有 active run（pending/running）：代理 stream
  const streamRes = await fetch(
    `${LG_URL}/threads/${threadId}/runs/${latestRun.run_id}/stream`,
    {
      headers: {
        'x-api-key': LG_KEY,
        'Accept': 'text/event-stream',
      }
    }
  )

  if (!streamRes.ok || !streamRes.body) {
    return new Response(`Stream error: ${streamRes.status}`, { status: 502 })
  }

  // 直接透传 SSE stream，前端 EventSource 接收
  return new Response(streamRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Thread-Id': threadId,
    }
  })
}

// ── POST: resume interrupt (KR4 Human Gate) ────────────────────────────────────
export async function POST(req: NextRequest) {
  const { thread_id, command, resume_value } = await req.json()
  if (!thread_id) {
    return Response.json({ error: 'Missing thread_id' }, { status: 400 })
  }

  // 查最新 run
  const runsRes = await fetch(
    `${LG_URL}/threads/${thread_id}/runs?limit=1`,
    { headers: { 'x-api-key': LG_KEY } }
  )
  const runs: Array<{ run_id: string; assistant_id: string }> = runsRes.ok ? await runsRes.json() : []
  const latestRun = runs[0]

  if (!latestRun) {
    return Response.json({ error: 'No run found' }, { status: 404 })
  }

  // 发送 Command(resume) 恢复 interrupt
  const resumeRes = await fetch(
    `${LG_URL}/threads/${thread_id}/runs`,
    {
      method: 'POST',
      headers: {
        'x-api-key': LG_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistant_id: latestRun.assistant_id,
        command: {
          resume: resume_value ?? command ?? true,
        },
        multitask_strategy: 'enqueue',
      })
    }
  )

  if (!resumeRes.ok) {
    const err = await resumeRes.text()
    return Response.json({ error: err }, { status: resumeRes.status })
  }

  const result = await resumeRes.json()
  return Response.json({ ok: true, run_id: result.run_id ?? result.id })
}
