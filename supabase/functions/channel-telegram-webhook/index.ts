// @ts-nocheck
// ⚠️ 防回退注释：
// Telegram 绑定数据存在 tenants 表的字段：telegram_chat_id, telegram_username, telegram_bound_at
// 不要引入 telegram_bindings 表——该表已删除。
// 通过 user_id 找到对应的 tenant 行，更新这三个字段。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

async function sendMessage(chatId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
  } catch (_) { /* ignore */ }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('ok', { status: 200 })
  }

  let update: any
  try {
    update = await req.json()
  } catch (_) {
    return new Response('bad request', { status: 400 })
  }

  const message = update?.message
  if (!message) return new Response('ok', { status: 200 })

  const text: string = message.text ?? ''
  const from = message.from ?? {}
  const chat = message.chat ?? {}
  const chatId: number = chat.id

  if (text.startsWith('/start')) {
    const parts = text.trim().split(/\s+/)
    const userId: string | undefined = parts[1]

    if (!userId) {
      await sendMessage(chatId, '👋 欢迎来到 ONIT！\n\n请从 Dashboard 点击「加入 →」按钮来绑定你的账号。')
      return new Response('ok', { status: 200 })
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
      return new Response('ok', { status: 200 })
    }

    // 更新 tenants 表的 telegram 字段
    const { error: updateError } = await sb
      .from('tenants')
      .update({
        telegram_chat_id: String(chatId),
        telegram_username: from.username ?? null,
        telegram_bound_at: new Date().toISOString(),
      })
      .eq('id', tenant.id)

    if (updateError) {
      console.error('bind error:', updateError.message)
      await sendMessage(chatId, '❌ 绑定失败，请稍后重试。')
      return new Response('ok', { status: 200 })
    }

    const firstName: string = from.first_name ?? '你'
    await sendMessage(
      chatId,
      `✅ 绑定成功！\n\n你好 ${firstName}，你的 ONIT 账号已与 Telegram 绑定。\n\nAgent 团队将通过这里与你保持联系 🚀`
    )
    return new Response('ok', { status: 200 })
  }

  return new Response('ok', { status: 200 })
})
