'use client'

// 适配层：把旧的 AgentListItem 形状映射到统一的 AgentRecord，然后渲染 AgentCard
import { AgentCard, type AgentRecord } from '@/components/agent-card'
import type { AgentListItem } from '@/lib/database.types'

type AgentRow = AgentListItem & { url?: string | null }

export function AgentCardWithPopover({ agent }: { agent: AgentRow }) {
  const record: AgentRecord = {
    id: agent.id,
    name: agent.name,
    type: 'agent',
    description: agent.description,
    version: null,
    tags: agent.tags,
    skills: agent.skills as AgentRecord['skills'],
    capabilities: agent.capabilities as AgentRecord['capabilities'],
    connector_type: agent.connector_type,
    url: agent.url,
    updated_at: agent.updated_at,
    // preset agents 都有 A2A 接口（从 url 推断）
    supported_interfaces: agent.url
      ? [{ url: agent.url, protocol: 'A2A', transport: 'JSONRPC' }]
      : undefined,
    // preset agents 没有 connect/disconnect 操作
    isOnline: !!(agent.url && agent.url !== 'pending'),
  }

  return <AgentCard agent={record} />
}
