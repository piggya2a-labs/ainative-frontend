import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://bgzrcrftjkcfdszumywd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnenJjcmZ0amtjZmRzenVteXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE4OTY4MiwiZXhwIjoyMDkxNzY1NjgyfQ.Qud0H9j_m2lYU9YmPz8Jkp67gM2-2QmJYKge99roMqQ'
)

// 每个 agent id → icon_url（优先用官方 CDN / favicon，稳定不过期）
const ICONS = {
  // GitHub
  'composio-github-mcp':     'https://github.githubassets.com/favicons/favicon.svg',
  'ext-github-agent':        'https://github.githubassets.com/favicons/favicon.svg',
  // Telegram
  'ext-telegram-agent':      'https://telegram.org/img/website_icon.svg',
  // Slack
  'ext-slack-agent':         'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png',
  // 飞书
  'ext-feishu-agent':        'https://sf3-cdn-tos.douyinstatic.com/obj/eden-cn/lm-lmz/ljhwZthlaukjlkulzlp/feishu-logo.png',
  // 微信 — 用腾讯官方 favicon
  'ext-wechat-agent':        'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico',
  // Claude / Anthropic
  'ext-claude-agent':        'https://claude.ai/favicon.ico',
  // LangSmith
  'ext-langsmith-agent':     'https://www.langchain.com/favicon.ico',
  // N8N
  'ext-telegram-agent':      'https://telegram.org/img/website_icon.svg',
  'custom-e1609505':         'https://n8n.io/favicon.ico',
  'cap_n8n_mcp':             'https://n8n.io/favicon.ico',
  'l2-n8n-agent':            'https://n8n.io/favicon.ico',
  // Trigger.dev
  'openapi-fac82b58':        'https://trigger.dev/favicon.ico',
  // Supabase
  'ext-supabase-agent':      'https://supabase.com/favicon/favicon-32x32.png',
  'openapi-666c1333':        'https://supabase.com/favicon/favicon-32x32.png',
  // Vercel
  'openapi-1df6723b':        'https://assets.vercel.com/image/upload/front/favicon/vercel/favicon.ico',
  // E2B
  'openapi-92eb2d4d':        'https://e2b.dev/favicon.ico',
  'ext-sprite-agent':        'https://e2b.dev/favicon.ico',
  // Composio
  'custom-ce80d42b':         'https://composio.dev/favicon.ico',
  'ext-composio-agent':      'https://composio.dev/favicon.ico',
  // HuggingFace
  'custom-d5b262a5':         'https://huggingface.co/front/assets/huggingface_logo-noborder.svg',
  'cap_huggingface_mcp':     'https://huggingface.co/front/assets/huggingface_logo-noborder.svg',
  // Firecrawl
  'openapi-d15e84e4':        'https://www.firecrawl.dev/favicon.ico',
  // Vapi
  'openapi-34aa0ce1':        'https://vapi.ai/favicon.ico',
  // Steel
  'ext-steel-agent':         'https://steel.dev/favicon.ico',
  // Context7
  'context7-mcp':            'https://context7.com/favicon.ico',
  // LangGraph / LangChain
  'ext-langgraph-agent':     'https://www.langchain.com/favicon.ico',
  // LangSmith API
  'openapi-5d87853a':        'https://www.langchain.com/favicon.ico',
  // Gentic
  'custom-d147056d':         'https://gentic.co/favicon.ico',
  'custom-9a0134bc':         'https://gentic.co/favicon.ico',
  // GitHub Copilot MCP
  'custom-08607424':         'https://github.githubassets.com/favicons/favicon.svg',
  // AIHOT
  'cap-aihot':               'https://aihot.today/favicon.ico',
  // ONIT platform
  'platform':                'https://ainative-frontend.vercel.app/favicon.ico',
  // N8N workflow agents
  'openapi-fac82b58':        'https://trigger.dev/favicon.ico',
}

async function main() {
  let updated = 0
  for (const [id, icon_url] of Object.entries(ICONS)) {
    const { error } = await sb
      .from('agent_registry')
      .update({ icon_url })
      .eq('id', id)
    if (error) {
      console.error(`❌ ${id}:`, error.message)
    } else {
      console.log(`✅ ${id}`)
      updated++
    }
  }
  console.log(`\n完成：更新了 ${updated} 个 agent icon`)
}

main()
