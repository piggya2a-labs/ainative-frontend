import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 不带 auth，看报什么错
const r1 = await fetch(`${BASE}/channel-telegram`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'verify', bot_token: 'test' }),
})
console.log('no auth:', r1.status, await r1.text())

// 用 anon key
const r2 = await fetch(`${BASE}/channel-telegram`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'verify', bot_token: 'test' }),
})
console.log('anon key:', r2.status, (await r2.text()).slice(0, 200))

// 看 mcp-server 是否正常（已知可用的 function）
const r3 = await fetch(`${BASE}/mcp-server`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1, params: {} }),
})
console.log('mcp-server:', r3.status, (await r3.text()).slice(0, 100))
