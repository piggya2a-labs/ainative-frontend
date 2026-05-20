import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    const { error } = await sb
      .from('telegram_bindings')
      .upsert(
        {
          user_id: userId,
          chat_id: chatId,
          username: (from.username as string) ?? null,
          first_name: (from.first_name as string) ?? null,
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('telegram bind error:', error.message)
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
