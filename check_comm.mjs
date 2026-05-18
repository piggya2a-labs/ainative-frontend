import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// communication 类工具完整字段
const { data } = await sb.from('tool_registry')
  .select('*')
  .eq('category', 'communication')

console.log('=== communication tools ===')
data?.forEach(t => {
  console.log('\n---', t.tool_name, '---')
  console.log('enabled:', t.enabled)
  console.log('platform:', t.platform)
  console.log('annotations:', JSON.stringify(t.annotations, null, 2))
  console.log('metadata:', JSON.stringify(t.metadata, null, 2))
  console.log('schema_json:', JSON.stringify(t.schema_json, null, 2))
  console.log('input_schema:', JSON.stringify(t.input_schema, null, 2))
  console.log('description (first 200):', t.description?.slice(0, 200))
})

// agent_registry 里有没有对应的 communication agent
const { data: commAgents } = await sb.from('agent_registry')
  .select('id, name, type, mcp_url, oauth_config, connector_type, provider')
  .or('tags.cs.{communication},provider.eq.slack,provider.eq.telegram,provider.eq.feishu,provider.eq.wechat')

console.log('\n=== communication agents ===')
console.log(JSON.stringify(commAgents, null, 2))
