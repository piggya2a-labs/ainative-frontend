import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ⚠️ 防回退注释：
// Telegram 绑定数据存在 tenants 表的字段：telegram_chat_id, telegram_username, telegram_bound_at
// 不要引入 telegram_bindings 表——该表已删除。
// 通过 user_id 找到对应的 tenant 行，更新这三个字段。

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

async function sendMessage(chatId: number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
  } catch { /* ignore */ }
}

export async function POST(req: NextRequest) {
  let update: Record<string, unknown>
  try {
    update = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const message = update?.message as Record<string, unknown> | undefined
  if (!message) return NextResponse.json({ ok: true })

  const text = (message.text as string) ?? ''
  const from = (message.from as Record<string, unknown>) ?? {}
  const chat = (message.chat as Record<string, unknown>) ?? {}
  const chatId = chat.id as number

  if (text.startsWith('/start')) {
    const parts = text.trim().split(/\s+/)
    const userId = parts[1]

    if (!userId) {
      await sendMessage(chatId, '👋 欢迎来到 ONIT！\n\n请从 Dashboard 点击「加入 →」按钮来绑定你的账号。')
      return NextResponse.json({ ok: true })
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 找到该用户的第一个 tenant
    const { data: tenant, error: findError } = await sb
      .from('tenants')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (findError || !tenant) {
      console.error('telegram bind: tenant not found for user_id', userId, findError?.message)
      await sendMessage(chatId, '❌ 绑定失败，找不到对应账号，请稍后重试。')
      return NextResponse.json({ ok: true })
    }

    // 更新 tenants 表的 telegram 字段
    const { error: updateError } = await sb
      .from('tenants')
      .update({
        telegram_chat_id: String(chatId),
        telegram_username: (from.username as string) ?? null,
        telegram_bound_at: new Date().toISOString(),
      })
      .eq('id', tenant.id)

    if (updateError) {
      console.error('telegram bind error:', updateError.message)
      await sendMessage(chatId, '❌ 绑定失败，请稍后重试。')
      return NextResponse.json({ ok: true })
    }

    const firstName = (from.first_name as string) ?? '你'
    await sendMessage(
      chatId,
      `✅ 绑定成功！\n\n你好 ${firstName}，你的 ONIT 账号已与 Telegram 绑定。\n\nAgent 团队将通过这里与你保持联系 🚀`
    )
  }

  return NextResponse.json({ ok: true })
}

// Telegram 会发 GET 验证，返回 ok
export async function GET() {
  return NextResponse.json({ ok: true })
}
