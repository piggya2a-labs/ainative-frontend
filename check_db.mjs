import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// agent_registry 最近 updated 的所有条目，看有没有新字段被填充
const { data: recent } = await sb.from('agent_registry')
  .select('id, type, name, owner_agent_id, updated_at')
  .order('updated_at', { ascending: false })
  .limit(20)
console.log('=== agent_registry recent ===')
recent?.forEach(a => console.log(a.updated_at.slice(0,16), '|', a.type, '|', a.id, '|', a.owner_agent_id ?? '-'))

// 看 owner_agent_id 有没有被填充（表示 capability 挂到了某个 agent 下）
const { data: withOwner } = await sb.from('agent_registry')
  .select('id, type, name, owner_agent_id')
  .not('owner_agent_id', 'is', null)
console.log('\n=== has owner_agent_id ===')
withOwner?.forEach(a => console.log(a.type, '|', a.id, '->', a.owner_agent_id))

// 试更多表名
const candidates = [
  'site_config', 'config', 'onboarding', 'waitlist',
  'users', 'profiles', 'tasks', 'runs', 'events',
  'agent_tasks', 'agent_runs', 'agent_logs',
  'capability_registry', 'platform_config'
]
for (const t of candidates) {
  const { data, error } = await sb.from(t).select('*').limit(1)
  if (!error) {
    console.log('EXISTS:', t, '| fields:', data && data.length > 0 ? Object.keys(data[0]).join(', ') : '(empty table)')
  }
}
