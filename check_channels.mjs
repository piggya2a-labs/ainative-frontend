import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1'

// 先用测试账号登录拿 session token
const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
  email: 'test@onit.ai',
  password: 'test123456',
})
if (authErr) {
  console.error('login failed:', authErr.message)
  process.exit(1)
}
const token = auth.session.access_token
console.log('logged in as:', auth.user.email)

// 测试飞书 authorize（应该返回 qrcode_url）
console.log('\n=== channel-feishu authorize ===')
const r1 = await fetch(`${BASE}/channel-feishu`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'authorize' }),
})
console.log('status:', r1.status)
console.log('body:', (await r1.text()).slice(0, 400))

// 测试微信 setup（应该返回 webhook_url 和 qrcode）
console.log('\n=== channel-wechat setup ===')
const r2 = await fetch(`${BASE}/channel-wechat`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'setup' }),
})
console.log('status:', r2.status)
console.log('body:', (await r2.text()).slice(0, 400))

// 测试 Slack authorize（对比看）
console.log('\n=== channel-slack authorize ===')
const r3 = await fetch(`${BASE}/channel-slack`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'authorize' }),
})
console.log('status:', r3.status)
console.log('body:', (await r3.text()).slice(0, 400))
