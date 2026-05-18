import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// 1. tool_registry 有没有新的 agent_id 列
const { data: tools, error: te } = await sb.from('tool_registry')
  .select('tool_name, agent_id, layer, category')
  .limit(5)
if (te) console.log('tool_registry error:', te.message)
else {
  console.log('=== tool_registry fields ===')
  console.log('has agent_id:', 'agent_id' in (tools[0] ?? {}))
  tools.forEach(t => console.log(' ', t.tool_name, '| agent_id:', t.agent_id, '| layer:', t.layer))
}

// 2. agent_registry 里的 Platform Agent 列表
const { data: agents } = await sb.from('agent_registry')
  .select('id, name, type, provider, skills')
  .in('type', ['agent', 'external', 'capability'])
  .order('type')

console.log('\n=== agent_registry all types ===')
agents?.forEach(a => {
  const skillCount = Array.isArray(a.skills) ? a.skills.length : 0
  console.log(a.type, '|', a.id, '|', a.provider ?? '-', '| skills:', skillCount)
})

// 3. 按 agent_id 统计 tool 数量
const { data: allTools } = await sb.from('tool_registry')
  .select('agent_id')
  .not('agent_id', 'is', null)

const byAgent = {}
allTools?.forEach(t => { byAgent[t.agent_id] = (byAgent[t.agent_id] || 0) + 1 })
console.log('\n=== tools per agent_id ===')
Object.entries(byAgent).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(' ', k, ':', v))

// 4. 没有 agent_id 的 tool 数量
const { count } = await sb.from('tool_registry')
  .select('*', { count: 'exact', head: true })
  .is('agent_id', null)
console.log('\ntools without agent_id:', count)
