import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://bgzrcrftjkcfdszumywd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnenJjcmZ0amtjZmRzenVteXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE4OTY4MiwiZXhwIjoyMDkxNzY1NjgyfQ.Qud0H9j_m2lYU9YmPz8Jkp67gM2-2QmJYKge99roMqQ'
)

const TEST_EMAIL = 'test@onit.ai'

async function main() {
  console.log('=== 开始清空 test@onit.ai 状态 ===\n')

  // 1. 找到 user id
  const { data: { users } } = await sb.auth.admin.listUsers()
  const user = users.find(u => u.email === TEST_EMAIL)
  if (!user) { console.error('找不到用户'); process.exit(1) }
  console.log(`✅ 找到用户: ${user.id}`)

  // 2. 清空 composio_mcp_tokens（如果有）
  const { error: e1 } = await sb.from('composio_mcp_tokens').delete().eq('user_id', user.id)
  console.log(e1 ? `⚠️  composio_mcp_tokens: ${e1.message}` : '✅ composio_mcp_tokens 已清空')

  // 3. 找到 tenant（列名是 user_id）
  const { data: tenants, error: te } = await sb.from('tenants').select('id').eq('user_id', user.id)
  if (te) console.error('查 tenants 失败:', te.message)
  console.log(`✅ 找到 ${tenants?.length ?? 0} 个 tenant`)

  for (const tenant of (tenants ?? [])) {
    const tid = tenant.id

    // 4. 清空 tenant_connectors
    const { error: e2 } = await sb.from('tenant_connectors').delete().eq('tenant_id', tid)
    console.log(e2 ? `⚠️  tenant_connectors[${tid}]: ${e2.message}` : `✅ tenant_connectors[${tid}] 已清空`)

    // 5. 清空 projects（含 milestones / raci / risks）
    const { data: projects } = await sb.from('projects').select('id').eq('tenant_id', tid)
    for (const p of (projects ?? [])) {
      await sb.from('project_milestones').delete().eq('project_id', p.id)
      await sb.from('project_raci').delete().eq('project_id', p.id)
      await sb.from('project_risks').delete().eq('project_id', p.id)
      await sb.from('projects').delete().eq('id', p.id)
      console.log(`✅ project[${p.id}] 及子表已清空`)
    }

    // 6. 清空 audit_logs
    const { error: e3 } = await sb.from('audit_logs').delete().eq('tenant_id', tid)
    console.log(e3 ? `⚠️  audit_logs: ${e3.message}` : `✅ audit_logs[${tid}] 已清空`)

    // 7. 清空 api_keys
    const { error: e4 } = await sb.from('api_keys').delete().eq('tenant_id', tid)
    console.log(e4 ? `⚠️  api_keys: ${e4.message}` : `✅ api_keys[${tid}] 已清空`)

    // 8. 清空 github_installation_bindings
    const { error: e5 } = await sb.from('github_installation_bindings').delete().eq('tenant_id', tid)
    console.log(e5 ? `⚠️  github_installation_bindings: ${e5.message}` : `✅ github_installation_bindings[${tid}] 已清空`)

    // 9. 删除 tenant 本身
    const { error: e6 } = await sb.from('tenants').delete().eq('id', tid)
    console.log(e6 ? `⚠️  tenant[${tid}]: ${e6.message}` : `✅ tenant[${tid}] 已删除`)
  }

  // 10. 清空 user_metadata 中的 composio_mcp（保留 email 等基础字段）
  const { error: e7 } = await sb.auth.admin.updateUserById(user.id, {
    user_metadata: {
      email: TEST_EMAIL,
      email_verified: true,
      phone_verified: false,
      sub: user.id
    }
  })
  console.log(e7 ? `⚠️  user_metadata: ${e7.message}` : '✅ user_metadata composio_mcp 已清空')

  // 验证
  const { data: { user: u2 } } = await sb.auth.admin.getUserById(user.id)
  console.log(`composio_mcp 验证: ${u2?.user_metadata?.composio_mcp ? '仍存在 ❌' : '已清空 ✅'}`)
  const { data: remaining } = await sb.from('tenants').select('id').eq('user_id', user.id)
  console.log(`剩余 tenant 数: ${remaining?.length ?? 0}`)

  console.log('\n=== 清空完成，test@onit.ai 现在是全新用户状态 ===')
}

main().catch(console.error)
