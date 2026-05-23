/**
 * POST /api/agent-chat
 *
 * 服务端安全代理：
 * 1. 验证 Supabase session（确认用户已登录）
 * 2. 用 user_id + agent_id 生成确定性 thread_id（每个用户对每个 Agent 有独立对话）
 * 3. 确保 LangGraph thread 存在
 * 4. 把用户消息以 SSE 流的形式转发给 LangGraph，原样透传回前端
 *
 * 前端只传 { assistant_id, message, thread_id? }
 * API key 不暴露给浏览器。
 */
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const LANGSMITH_KEY = process.env.LANGSMITH_API_KEY!
const LGBASE = process.env.LANGGRAPH_URL ?? 'https://piggya2a-0a1fda0a717459128b46c20d5a2662c7.us.langgraph.app'

// 生成 deterministic thread_id（UUID v5，基于 user_id + agent_id）
// 保证同一个用户对同一个 Agent 始终对应同一个 LangGraph thread
async function makeThreadId(userId: string, agentId: string): Promise<string> {
  const enc = new TextEncoder()
  const ns = new Uint8Array([0x6b,0xa7,0xb8,0x10,0x9d,0xad,0x11,0xd1,0x80,0xb4,0x00,0xc0,0x4f,0xd4,0x30,0xc8])
  const d = enc.encode(`agent-chat:${userId}:${agentId}`)
  const buf = new Uint8Array(ns.length + d.length)
  buf.set(ns); buf.set(d, ns.length)
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', buf))
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80
  const x = Array.from(h.slice(0,16)).map(b => b.toString(16).padStart(2,'0')).join('')
  return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20,32)}`
}

// 确保 LangGraph thread 存在（不存在则创建）
async function ensureThread(threadId: string, userId: string, assistantId: string): Promise<void> {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': LANGSMITH_KEY,
  }
  // 先查是否存在
  const check = await fetch(`${LGBASE}/threads/${threadId}`, { headers })
  if (check.ok) {
    const t = await check.json()
    if (t.status !== 'error') return
    // error 状态则删掉重建
    await fetch(`${LGBASE}/threads/${threadId}`, { method: 'DELETE', headers })
  }
  // 创建新 thread
  await fetch(`${LGBASE}/threads`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      thread_id: threadId,
      metadata: {
        source: 'web-chat',
        user_id: userId,
        assistant_id: assistantId,
      },
    }),
  })
}

export async function POST(req: NextRequest) {
  // 1. 验证 Supabase session
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // 2. 解析请求体
  const body = await req.json()
  const { assistant_id, message, thread_id: clientThreadId } = body as {
    assistant_id: string
    message: string
    thread_id?: string
  }

  if (!assistant_id || !message) {
    return new Response(JSON.stringify({ error: 'assistant_id and message required' }), { status: 400 })
  }

  // 3. 确定 thread_id（客户端可以传入已有 thread，否则生成确定性 thread）
  const threadId = clientThreadId ?? await makeThreadId(user.id, assistant_id)

  // 4. 确保 thread 存在
  await ensureThread(threadId, user.id, assistant_id)

  // 5. 转发给 LangGraph streaming 端点，原样透传 SSE
  const lgResp = await fetch(
    `${LGBASE}/threads/${threadId}/runs/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LANGSMITH_KEY,
      },
      body: JSON.stringify({
        assistant_id,
        input: { messages: [{ role: 'human', content: message }] },
        stream_mode: ['values', 'events'],
        stream_subgraphs: false,
      }),
    }
  )

  if (!lgResp.ok || !lgResp.body) {
    const err = await lgResp.text()
    return new Response(JSON.stringify({ error: err }), { status: lgResp.status })
  }

  // 透传 SSE 流，附加 thread_id header 供前端记录
  return new Response(lgResp.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Thread-Id': threadId,
    },
  })
}
