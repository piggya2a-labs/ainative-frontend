'use client'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Zap, BookOpen } from 'lucide-react'
import { relativeTime, formatDate } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { AgentListItem } from '@/lib/database.types'

// 将 tag 映射为对用户友好的中文标签
const TAG_LABELS: Record<string, string> = {
  development: '执行',
  operations: '运维',
  architecture: '设计',
  coordination: '协调',
  audit: '审核',
  platform: '核心',
  core: '核心',
  native: '核心',
}

// 为兼容旧属性名（principle vs principles）做本地映射
type RoleModelDisplay = {
  name: string
  principle?: string
  principles?: string
  affiliation?: string
  institution?: string
}

// 展示用的类型：基于 AgentListItem，允许额外传入 url
type AgentRow = AgentListItem & { url?: string | null }

/**
 * 从 agent 的 tags 字段推断显示标签。
 * 优先用 tags 里能映射到中文的第一个，fallback 到 ID 前缀。
 */
function getRoleLabel(agent: AgentRow): string {
  const tags = agent.tags ?? []
  for (const tag of tags) {
    if (TAG_LABELS[tag]) return TAG_LABELS[tag]
  }
  // fallback: ID 前缀
  if (agent.id.startsWith('l1-')) return '执行'
  if (agent.id.startsWith('l2-')) return '设计'
  if (agent.id.startsWith('l3-')) return '审核'
  if (agent.id.startsWith('ext-')) return '外部'
  return 'Agent'
}

export function AgentCardWithPopover({ agent }: { agent: AgentRow }) {
  const roleLabel = getRoleLabel(agent)
  const isLive = agent.url && agent.url !== 'pending'
  const skills = agent.skills ?? []
  const roleModels = (agent.capabilities?.role_models ?? []) as RoleModelDisplay[]
  const hasDetail = skills.length > 0 || roleModels.length > 0

  return (
    <Dialog>
      <div className="p-5 rounded-lg border border-border hover:border-foreground/20 transition-colors flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          {hasDetail ? (
            <DialogTrigger className="text-sm font-semibold leading-snug text-left hover:underline cursor-pointer">
              {agent.name}
            </DialogTrigger>
          ) : (
            <span className="text-sm font-semibold leading-snug">{agent.name}</span>
          )}
          <Badge
            variant="outline"
            className={`text-xs shrink-0 ${
              isLive
                ? 'bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.55_0.15_145)] border-[oklch(0.65_0.15_145)]/20'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            {isLive ? '在线' : '待机'}
          </Badge>
        </div>

        {/* Description */}
        {agent.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {agent.description}
          </p>
        )}

        {/* Role badge + skill badges */}
        <div className="flex items-center gap-2 flex-wrap mt-auto">
          <Badge variant="secondary" className="text-xs">{roleLabel}</Badge>
          {agent.updated_at && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="text-[10px] text-muted-foreground font-mono ml-auto cursor-default">
                  {relativeTime(agent.updated_at)}
                </TooltipTrigger>
                <TooltipContent>
                  {formatDate(agent.updated_at)}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {skills.slice(0, 3).map((s) => (
            <Badge key={s.id} variant="outline" className="text-xs font-mono">
              {s.name}
            </Badge>
          ))}
          {skills.length > 3 && (
            <span className="text-xs text-muted-foreground">+{skills.length - 3}</span>
          )}
        </div>
      </div>

      {/* Dialog 详情弹窗 */}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{agent.name}</DialogTitle>
            <Badge
              variant="outline"
              className={`text-xs ${
                isLive
                  ? 'bg-[oklch(0.65_0.15_145)]/10 text-[oklch(0.55_0.15_145)] border-[oklch(0.65_0.15_145)]/20'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {isLive ? '在线' : '待机'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            {agent.description}
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Skills */}
          {skills.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">技能</span>
              </div>
              <div className="space-y-2">
                {skills.map((skill) => (
                  <div key={skill.id} className="flex items-start gap-2">
                    <span className="text-xs font-medium text-foreground shrink-0 min-w-[80px]">
                      {skill.name}
                    </span>
                    {skill.description && (
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        {skill.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Role Models */}
          {roleModels.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">参考对象</span>
              </div>
              <div className="space-y-3">
                {roleModels.map((rm, i) => (
                  <div key={i} className="border-l-2 border-border pl-3">
                    <p className="text-xs font-medium">{rm.name}</p>
                    {rm.affiliation && (
                      <p className="text-[10px] text-muted-foreground">{rm.affiliation}</p>
                    )}
                    <p className="text-xs text-muted-foreground italic mt-0.5">
                      &ldquo;{rm.principle ?? rm.principles}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
