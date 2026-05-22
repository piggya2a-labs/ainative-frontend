/**
 * POST /api/tenants/init-with-lumen
 *
 * 复刻 Telegram webhook 的 A2A 调用方式：
 * 1. 验证用户 session
 * 2. 创建空 tenant（只有名字和 slug）
 * 3. 用 A2A protocol 发消息给 @Lumen（和 Telegram 完全一样的调用方式）
 * 4. @Lumen 处理后调用 lumen_create_mcsp 写入数据库
 * 5. 返回 tenant_id 和 thread_id，前端轮询看板
 *
 * 不在前端调 GPT，哑前端架构。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const LANGGRAPH_URL = process.env.LANGGRAPH_URL ?? 'https://piggya2a-0a1fda0a717459128b46c20d5a2662c7.us.langgraph.app'
const LANGGRAPH_API_KEY = process.env.LANGSMITH_API_KEY!
// 从环境变量读取，默认値仅作为开发备用
const LUMEN_ASSISTANT_ID = process.env.LUMEN_ASSISTANT_ID ?? '73a8b433-7a94-4ff0-a4d2-5d71bb998fc8'

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function buildSlug(name: string, userId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'project'
  const suffix = userId.replace(/-/g, '').slice(0, 8)
  return `${base}-${suffix}`
}

// 生成 deterministic thread ID（和 Telegram 一样的 UUID v5 方式，基于 user_id）
async function makeThreadId(userId: string): Promise<string> {
  const enc = new TextEncoder()
  const ns = new Uint8Array([0x6b,0xa7,0xb8,0x10,0x9d,0xad,0x11,0xd1,0x80,0xb4,0x00,0xc0,0x4f,0xd4,0x30,0xc8])
  const d = enc.encode(`web:${userId}`)
  const buf = new Uint8Array(ns.length + d.length)
  buf.set(ns); buf.set(d, ns.length)
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', buf))
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80
  const x = Array.from(h.slice(0,16)).map(b => b.toString(16).padStart(2,'0')).join('')
  return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20,32)}`
}

// 确保 LangGraph thread 存在
async function ensureThread(threadId: string, userId: string, tenantSlug: string) {
  const headers = { 'Content-Type': 'application/json', 'x-api-key': LANGGRAPH_API_KEY }
  try {
    const resp = await fetch(`${LANGGRAPH_URL}/threads/${threadId}`, { headers })
    if (resp.ok) {
      const t = await resp.json()
      if (t.status !== 'error') return
      await fetch(`${LANGGRAPH_URL}/threads/${threadId}`, { method: 'DELETE', headers })
    }
  } catch { /* not found, create */ }
  await fetch(`${LANGGRAPH_URL}/threads`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      thread_id: threadId,
      metadata: { source: 'web', user_id: userId, tenant_slug: tenantSlug },
    }),
  })
}

export async function POST(req: NextRequest) {
  // 1. 验证用户 session
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. 解析请求体
  const body = await req.json()
  const { name, description } = body as { name?: string; description?: string }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }
  if (!description?.trim()) {
    return NextResponse.json({ error: 'description required' }, { status: 400 })
  }

  // 3. 创建空 tenant
  const slug = buildSlug(name.trim(), user.id)
  const now = new Date()
  const year = now.getUTCFullYear()
  const quarter = Math.ceil((now.getUTCMonth() + 1) / 3)
  const shareToken = `${slug}-live-${year}q${quarter}`
  const { data: tenant, error: tenantError } = await adminClient
    .from('tenants')
    .insert({
      name: name.trim(),
      slug,
      user_id: user.id,
      status: 'triage',
      metadata: { share_token: shareToken },
    })
    .select('id, slug')
    .single()

  if (tenantError || !tenant) {
    return NextResponse.json({ error: tenantError?.message ?? 'Failed to create tenant' }, { status: 500 })
  }

  // 4. 准备 A2A 调用（完全复刻 Telegram webhook 的方式）
  const threadId = await makeThreadId(user.id)
  await ensureThread(threadId, user.id, tenant.slug)

  const userMsg = `请帮我为这个项目创建 MCSP 共同成功计划：

项目名称：${name.trim()}
项目描述：${description.trim()}

请调用 lumen_create_mcsp 工具，把完整的 MCSP 数据写入看板（tenant_slug: ${tenant.slug}）。`

  const payload = {
    jsonrpc: '2.0',
    method: 'message/stream',
    id: crypto.randomUUID(),
    params: {
      message: {
        role: 'user',
        parts: [{ kind: 'text', text: userMsg }],
        messageId: crypto.randomUUID(),
        contextId: threadId,
        taskId: crypto.randomUUID(),
      },
    },
    metadata: {
      thread_id: threadId,
      tenant_slug: tenant.slug,
    },
  }

  // 5. 异步触发 @Lumen（不等待结果，前端轮询）
  // 用 waitUntil 模式：发出请求后立即返回 tenant_id，@Lumen 在后台处理
  fetch(`${LANGGRAPH_URL}/a2a/${LUMEN_ASSISTANT_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': LANGGRAPH_API_KEY,
    },
    body: JSON.stringify(payload),
  }).catch(err => console.error('[init-with-lumen] A2A call failed:', err))

  // 6. 立即返回 tenant_id，前端开始轮询
  return NextResponse.json({
    tenant_id: tenant.id,
    tenant_slug: tenant.slug,
    thread_id: threadId,
    share_url: `/r/${tenant.slug}?t=${shareToken}`,
    status: 'pending', // @Lumen 正在后台处理
  })
}
