// @ts-nocheck
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

    const { error } = await sb
      .from('telegram_bindings')
      .upsert(
        {
          user_id: userId,
          chat_id: chatId,
          username: from.username ?? null,
          first_name: from.first_name ?? null,
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('bind error:', error.message)
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
