'use client'
import { Badge } from '@/components/ui/badge'
import { usePostHog } from 'posthog-js/react'
import { SiteConfig } from '@/lib/sanity-schema'
import { T } from 'gt-next'

interface ToolsGridProps {
  siteConfig?: SiteConfig | null
}

// 每个集成工具的分类对应颜色
const CATEGORY_COLORS: Record<string, string> = {
  开发: 'bg-blue-500/10 text-blue-400',
  沟通: 'bg-green-500/10 text-green-400',
  数据: 'bg-purple-500/10 text-purple-400',
  分析: 'bg-orange-500/10 text-orange-400',
  内容: 'bg-pink-500/10 text-pink-400',
  部署: 'bg-cyan-500/10 text-cyan-400',
  编排: 'bg-yellow-500/10 text-yellow-400',
  自动化: 'bg-red-500/10 text-red-400',
  工具: 'bg-violet-500/10 text-violet-400',
  邮件: 'bg-rose-500/10 text-rose-400',
  语音: 'bg-teal-500/10 text-teal-400',
  研究: 'bg-amber-500/10 text-amber-400',
}

export function ToolsGrid({ siteConfig }: ToolsGridProps) {
  const posthog = usePostHog()
  const tools = siteConfig?.tools

  if (!tools || tools.length === 0) {
    return null
  }

  return (
    <section className="py-20 px-4 bg-muted/30" id="tools">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {siteConfig?.tools_section?.title || <T id="tools.title">工具生态，开笱即用</T>}
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            <T id="tools.subtitle">Agent 预装所需工具，通过 API 接入你自己的系统。</T>
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tools.map((tool) => {
            const colorClass = CATEGORY_COLORS[tool.category] || 'bg-muted text-muted-foreground'
            return (
              <div
                key={tool._key}
                className="bg-background border border-border/60 rounded-lg p-4 hover:border-border transition-colors cursor-default"
                onClick={() => posthog?.capture('tool_card_click', { name: tool.name, category: tool.category })}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-medium leading-tight">{tool.name}</span>
                  <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 shrink-0 ${colorClass}`}>
                    {tool.category}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
