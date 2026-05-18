'use client'

import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
    <Popover>
      <div className="p-5 rounded-lg border border-border hover:border-foreground/20 transition-colors flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          {hasDetail ? (
            <PopoverTrigger className="text-sm font-semibold leading-snug text-left hover:underline cursor-pointer">
              {agent.name}
            </PopoverTrigger>
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

      {/* Popover detail panel */}
      <PopoverContent className="w-80 p-0" side="bottom" align="start">
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{agent.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {agent.description}
              </p>
            </div>
            <span
              className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                isLive ? 'bg-[oklch(0.65_0.15_145)]' : 'bg-amber-400'
              }`}
            />
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <Zap className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">技能</span>
              </div>
              <div className="space-y-1.5">
                {skills.map((skill) => (
                  <div key={skill.id} className="flex items-start gap-1.5">
                    <span className="text-xs font-medium text-foreground shrink-0">
                      {skill.name}
                    </span>
                    {skill.description && (
                      <span className="text-xs text-muted-foreground">
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
              <div className="flex items-center gap-1 mb-1.5">
                <BookOpen className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">参考对象</span>
              </div>
              <div className="space-y-2">
                {roleModels.map((rm, i) => (
                  <div key={i}>
                    <p className="text-xs font-medium">{rm.name}</p>
                    <p className="text-xs text-muted-foreground italic">
                      &ldquo;{rm.principle.slice(0, 70)}{rm.principle.length > 70 ? '…' : ''}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
