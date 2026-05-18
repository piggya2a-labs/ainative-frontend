'use client'
import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useState } from 'react'

// 真实 Supabase MCP Server 端点
const MCP_SERVER_URL = 'https://bgzrcrftjkcfdszumywd.supabase.co/functions/v1/mcp-server'

const SECTIONS = [
  {
    id: 'getting-started',
    title: '快速开始',
    content: [
      {
        step: '01',
        title: '连接 MCP Server',
        description: '在 Claude Desktop 或任何 MCP 兼容客户端中配置 ONIT MCP Server，即可直接访问所有 Agent 和工具。',
        code: `# Claude Desktop 配置 (~/.claude/claude_desktop_config.json)
{
  "mcpServers": {
    "onit": {
      "url": "${MCP_SERVER_URL}",
      "headers": {
        "Authorization": "Bearer <your-supabase-anon-key>"
      }
    }
  }
}`,
      },
      {
        step: '02',
        title: '调用 Agent',
        description: '通过 MCP 协议向任意 Agent 发送任务，Agent 异步执行并返回结果。',
        code: `# 通过 MCP 调用 Agent（以 l1-orchestrator 为例）
POST ${MCP_SERVER_URL}?agent=l1-orchestrator
Authorization: Bearer <your-supabase-anon-key>
Content-Type: application/json

{
  "method": "tools/call",
  "params": {
    "name": "run_task",
    "arguments": {
      "task": "分析最近 10 条客服工单并生成摘要"
    }
  }
}`,
      },
      {
        step: '03',
        title: '查询 Agent 列表',
        description: '随时查询当前在线的所有 Agent 及其能力，后端新增 Agent 后前端自动发现。',
        code: `# 查询所有已启用的 Agent
GET https://bgzrcrftjkcfdszumywd.supabase.co/rest/v1/agent_registry
  ?enabled=eq.true
  &select=name,type,description,skills
Authorization: Bearer <your-supabase-anon-key>
apikey: <your-supabase-anon-key>`,
      },
    ],
  },
  {
    id: 'mcp',
    title: 'MCP Server',
    content: null,
    mcp: {
      description: '通过标准 MCP 协议连接 ONIT，任何 MCP 兼容客户端（Claude Desktop、Cursor、Continue）都可以直接访问所有 Agent 和工具。',
      config: `{
  "mcpServers": {
    "onit": {
      "url": "${MCP_SERVER_URL}",
      "headers": {
        "Authorization": "Bearer <your-supabase-anon-key>"
      }
    }
  }
}`,
      tools: [
        { name: 'run_task', description: '向指定 Agent 发送任务，异步执行' },
        { name: 'list_agents', description: '列出所有可用 Agent 及其能力描述' },
        { name: 'get_agent_status', description: '查询 Agent 当前运行状态' },
        { name: 'list_tools', description: '列出 Agent 可用的所有 Capability 工具' },
      ],
    },
  },
  {
    id: 'architecture',
    title: '架构说明',
    content: null,
    architecture: {
      description: 'ONIT 采用三层 Agent 架构，每层职责明确，协同完成复杂任务。',
      layers: [
        {
          name: 'L1 Orchestrator',
          prefix: 'l1-',
          role: '任务拆解与协调，始终加载，不直接执行工具',
        },
        {
          name: 'L2 Specialist',
          prefix: 'l2-',
          role: '专业执行层，负责研究、写作、分析等具体工作',
        },
        {
          name: 'L3 Reviewer',
          prefix: 'l3-',
          role: '质量审核层，验证输出、触发人工审批',
        },
        {
          name: 'External',
          prefix: 'ext-',
          role: '按需加载的外部 Agent（Trigger.dev、N8N 等）',
        },
      ],
    },
  },
]

export default function DocsPage() {
  const posthog = usePostHog()
  const [activeSection, setActiveSection] = useState('getting-started')

  useEffect(() => {
    posthog?.capture('page_view', { page: 'docs' })
  }, [posthog])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto px-4 pt-24 pb-16 w-full">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden md:block w-48 shrink-0">
            <div className="sticky top-24 space-y-1">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSection(s.id)
                    posthog?.capture('docs_section_click', { section: s.id })
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeSection === s.id
                      ? 'bg-foreground text-background font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </aside>
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="mb-10">
              <Badge variant="secondary" className="font-mono text-xs mb-4">v1.0</Badge>
              <h1 className="text-4xl font-bold tracking-tight mb-3">文档</h1>
              <p className="text-muted-foreground leading-relaxed">
                在生产环境中部署和管理 AI Agent 所需的一切。
              </p>
            </div>
            {/* Getting Started */}
            {activeSection === 'getting-started' && (
              <div className="space-y-10">
                <h2 className="text-2xl font-semibold">快速开始</h2>
                {SECTIONS[0].content?.map((item) => (
                  <div key={item.step} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground">{item.step}</span>
                      <h3 className="text-base font-semibold">{item.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-8">
                      {item.description}
                    </p>
                    <pre className="ml-8 p-4 rounded-lg bg-muted border border-border text-xs font-mono overflow-x-auto leading-relaxed">
                      <code>{item.code}</code>
                    </pre>
                  </div>
                ))}
              </div>
            )}
            {/* MCP Server */}
            {activeSection === 'mcp' && SECTIONS[1].mcp && (
              <div className="space-y-8">
                <h2 className="text-2xl font-semibold">MCP Server</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {SECTIONS[1].mcp.description}
                </p>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                    Claude Desktop 配置 (~/.claude/claude_desktop_config.json)
                  </p>
                  <pre className="p-4 rounded-lg bg-muted border border-border text-xs font-mono overflow-x-auto leading-relaxed">
                    <code>{SECTIONS[1].mcp.config}</code>
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                    可用工具
                  </p>
                  <div className="space-y-2">
                    {SECTIONS[1].mcp.tools.map((tool) => (
                      <div key={tool.name} className="flex items-start gap-4 p-3 rounded-lg border border-border">
                        <code className="text-xs font-mono text-foreground shrink-0">{tool.name}</code>
                        <span className="text-xs text-muted-foreground">{tool.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* Architecture */}
            {activeSection === 'architecture' && SECTIONS[2].architecture && (
              <div className="space-y-8">
                <h2 className="text-2xl font-semibold">架构说明</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {SECTIONS[2].architecture.description}
                </p>
                <div className="space-y-3">
                  {SECTIONS[2].architecture.layers.map((layer) => (
                    <div key={layer.name} className="flex items-start gap-4 p-4 rounded-lg border border-border">
                      <div className="shrink-0">
                        <code className="text-xs font-mono text-foreground font-semibold">{layer.name}</code>
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">前缀: {layer.prefix}</div>
                      </div>
                      <span className="text-xs text-muted-foreground leading-relaxed">{layer.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <CTASection />
      <Footer />
    </div>
  )
}
