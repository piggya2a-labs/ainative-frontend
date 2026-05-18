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

type AgentTiers = { ext?: string; l1?: string; l2?: string; l3?: string; default?: string }

type AgentSkill = {
  id: string
  name: string
  description?: string
  examples?: string[]
  tags?: string[]
}

type RoleModel = {
  name: string
  principle: string
  affiliation?: string
}

type AgentRow = {
  id: string
  name: string
  description: string
  url?: string
  skills?: AgentSkill[]
  capabilities?: {
    tools?: string[]
    role_models?: RoleModel[]
  }
  tags?: string[]
  icon_url?: string
}

function getTier(id: string, tiers?: AgentTiers): string {
  if (id.startsWith('ext-')) return tiers?.ext ?? 'External'
  if (id.startsWith('l1-')) return tiers?.l1 ?? 'Operator'
  if (id.startsWith('l2-')) return tiers?.l2 ?? 'Architect'
  if (id.startsWith('l3-')) return tiers?.l3 ?? 'Auditor'
  return tiers?.default ?? 'Agent'
}

export function AgentCardWithPopover({
  agent,
  tiers,
}: {
  agent: AgentRow
  tiers?: AgentTiers
}) {
  const tier = getTier(agent.id, tiers)
  const isLive = agent.url && agent.url !== 'pending'
  const skills = agent.skills ?? []
  const roleModels = agent.capabilities?.role_models ?? []
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
            {isLive ? 'Live' : 'Pending'}
          </Badge>
        </div>

        {/* Description */}
        {agent.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {agent.description}
          </p>
        )}

        {/* Skill badges */}
        <div className="flex items-center gap-2 flex-wrap mt-auto">
          <Badge variant="secondary" className="text-xs">{tier}</Badge>
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
              {isLive ? 'Live' : 'Pending'}
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
                      &ldquo;{rm.principle}&rdquo;
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
