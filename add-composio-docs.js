const { createClient } = require('@sanity/client')

const client = createClient({
  projectId: 'zae9ml5g',
  dataset: 'production',
  apiVersion: '2024-01-01',
  token: 'sk2b0RItXHWk8AnNgT12tDo2ZcitQlQJgzO0AfXfmeFBskZ9gthtePSiHzOQCscsCGVH8ximQmI0Zc0Bc6uK5yCeB3haJz7RqoXF7E32J7kFz7SDM3lunR3ZhHAVO5NpDPAUe23iQt0OrwbcbwsWnXkt7atwniZOjgeezcm1bDNxW1UtTn6E',
  useCdn: false
})

const composioSection = {
  id: 'composio',
  title: 'Composio 授权',
  description: 'ONIT 通过 Composio 托管所有工具授权。你只需要授权一次 Composio 账号，ONIT 的 Agent 就能按需调用你已连接的所有工具——GitHub、Gmail、Slack、Notion、Linear……整个过程和在 Claude Desktop 或 ChatGPT 里连接 Composio 完全一样。',
  steps: [
    {
      step: '01',
      title: '打开 Dashboard，找到 Composio 那行',
      description: '登录 ONIT 之后，在 Dashboard 顶部可以看到 Telegram 和 Composio 并排的两行。点击 Composio 那行右侧的「连接 →」按钮。',
      code: '# ONIT 不会存储你的任何 API Key\n# 所有工具授权全部由 Composio 托管，ONIT 无法访问你的密钥'
    },
    {
      step: '02',
      title: '选择你的 Composio 组织',
      description: '点击「连接 →」后，浏览器会跳转到 Composio 的授权页面，显示你的组织列表。选择你要授权的组织，点击「Continue」。如果你还没有 Composio 账号，可以在这一步免费注册。',
      code: '# 支持的登录方式\n# - Google OAuth\n# - GitHub OAuth\n# - Email + Password'
    },
    {
      step: '03',
      title: '授权 ONIT 访问你的 Composio 账号',
      description: 'Composio 会显示授权确认页：Give access to your Composio account。点击「Authorize」完成授权。这和你在 Claude Desktop、ChatGPT 里连接 Composio 是完全一样的体验。',
      code: '# Composio 授权确认页\n# "Give access to your Composio account"\n# "This will allow the application to use Composio tools on your behalf."\n# -> 点击 [Authorize]'
    },
    {
      step: '04',
      title: '自动飞回 ONIT，所有工具立即可用',
      description: '授权完成后，页面自动跳回 ONIT Dashboard，Composio 那行显示「已连接 ✓」。你在 Composio 里已经授权的所有工具（GitHub、Gmail、Slack、Notion 等）现在都可以被 ONIT 的 Agent 直接调用。授权是永久有效的，以后 ONIT 上线新的 Agent，只要你的 Composio 账号里有对应工具，Agent 会自动继承，无需重新授权。',
      code: '# 授权完成后，ONIT 可以调用你的所有已连接工具\n# 例如：GitHub、Gmail、Slack、Notion、Linear、Jira、HubSpot...\n# 共 250+ 工具，无需逐一配置'
    }
  ],
  tools: [
    { name: 'GitHub', description: '代码仓库管理、PR 审查、Issue 跟踪' },
    { name: 'Gmail', description: '邮件收发、自动回复、邮件分类' },
    { name: 'Slack', description: '消息发送、频道管理、通知推送' },
    { name: 'Notion', description: '文档创建、数据库查询、页面更新' },
    { name: 'Linear', description: '任务管理、Sprint 规划、Bug 跟踪' },
    { name: 'Google Calendar', description: '日历查询、会议创建、提醒设置' },
    { name: '250+ 更多', description: '所有在 Composio 里已授权的工具均可被 Agent 调用' }
  ],
  tools_label: '支持的工具（部分）'
}

client.patch('siteConfig')
  .setIfMissing({ 'docs.sections': [] })
  .append('docs.sections', [composioSection])
  .commit()
  .then(result => {
    console.log('✅ Composio section added to Sanity!')
    console.log('sections count:', result.docs?.sections?.length)
  })
  .catch(e => console.error('❌', e.message))
