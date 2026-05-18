import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// 所有 tenant_connectors 条目
const { data, error } = await sb.from('tenant_connectors')
  .select('*')
  .order('created_at', { ascending: false })

console.log('total:', data?.length)
data?.forEach(c => {
  console.log('\n---', c.agent_id, '---')
  console.log('status:', c.status)
  console.log('tenant_id:', c.tenant_id)
  console.log('metadata:', JSON.stringify(c.metadata))
  console.log('oauth_token:', c.oauth_token ? '(has token)' : 'null')
  console.log('connected_at:', c.connected_at?.slice(0,16))
})
