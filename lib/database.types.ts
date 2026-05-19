/**
 * Supabase Database Types
 *
 * 此文件由 scripts/gen-types.mjs 自动生成，不要手动修改。
 * 如需更新，运行：node scripts/gen-types.mjs
 *
 * 项目 ID: bgzrcrftjkcfdszumywd
 * 最后生成：2026-05-19
 */

// ─── agent_registry ──────────────────────────────────────────────────────────

export type AgentType = 'agent' | 'external' | 'capability' | 'spec'

export interface AgentSkill {
  id: string
  name: string
  description?: string
  tags?: string[]
}

export interface AgentCapabilities {
  tools?: string[]
  role_models?: Array<{
    name: string
    principles?: string
    institution?: string
  }>
}

export interface AgentRow {
  id: string
  name: string
  type: AgentType
  description: string | null
  owner_agent_id: string | null
  skills: AgentSkill[] | null
  url: string | null
  version: string | null
  tags: string[] | null
  body: Record<string, unknown> | null
  langsmith_handle: string | null
  enabled: boolean
  created_at: string
  updated_at: string
  supported_interfaces: string[] | null
  capabilities: AgentCapabilities | null
  default_input_modes: string[] | null
  default_output_modes: string[] | null
  provider: string | null
  documentation_url: string | null
  icon_url: string | null
  connector_type: string | null
  mcp_url: string | null
  oauth_config: Record<string, unknown> | null
}

/** 前端 /agents 页面使用的字段子集 */
export type AgentListItem = Pick<
  AgentRow,
  | 'id'
  | 'name'
  | 'description'
  | 'tags'
  | 'skills'
  | 'capabilities'
  | 'enabled'
  | 'updated_at'
>

/** 前端 /marketplace 页面使用的字段子集 */
export type MarketplaceAgentItem = Pick<
  AgentRow,
  | 'id'
  | 'name'
  | 'description'
  | 'tags'
  | 'skills'
  | 'provider'
  | 'mcp_url'
  | 'enabled'
  | 'updated_at'
  | 'icon_url'
  | 'documentation_url'
  | 'connector_type'
  | 'oauth_config'
>

/** api-connector-list EF 返回的单条数据 */
export interface ConnectorListItem {
  id: string
  name: string
  description: string | null
  type: string
  connector_type: string | null
  mcp_url: string | null
  oauth_required: boolean
  status: 'connected' | 'disconnected' | 'error' | null
  connected_at: string | null
  // 以下字段来自 agent_registry，EF 暂未返回，前端用 fallback
  skills?: AgentSkill[]
  tags?: string[] | null
  icon_url?: string | null
  documentation_url?: string | null
  provider?: string | null
  updated_at?: string
  oauth_config?: Record<string, unknown> | null
}

// ─── tool_registry ────────────────────────────────────────────────────────────

export type ToolLayer = 'capability' | 'infrastructure' | 'system'

export interface ToolRow {
  id: string
  tool_name: string
  description: string | null
  category: string | null
  schema_json: Record<string, unknown> | null
  enabled: boolean
  tenant_id: string | null
  created_at: string
  updated_at: string
  metadata: Record<string, unknown> | null
  tier: string | null
  scope: string | null
  platform: string | null
  layer: ToolLayer | null
  owner_agent: string | null
  input_schema: Record<string, unknown> | null
  annotations: Record<string, unknown> | null
  risk_level: string | null
  deprecated_at: string | null
  credentials_provisioned: boolean | null
  agent_id: string | null
}

// ─── tenant_connectors ───────────────────────────────────────────────────────

export type ConnectorStatus = 'connected' | 'pending_start' | 'pending_verify' | 'disconnected' | 'error'

export interface ConnectorRow {
  id: string
  tenant_id: string
  agent_id: string
  status: ConnectorStatus
  oauth_token: Record<string, unknown> | null
  pkce_state: string | null
  pkce_verifier: string | null
  discovered_tools: string[] | null
  connected_at: string | null
  last_used_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ─── tenants ─────────────────────────────────────────────────────────────────

export type TenantStatus = 'active' | 'suspended' | 'pending'
export type IsolationTier = 'shared' | 'dedicated' | 'enterprise'

export interface TenantRow {
  id: string
  slug: string
  name: string
  status: TenantStatus
  isolation_tier: IsolationTier | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  user_id: string | null
}

// ─── audit_logs ──────────────────────────────────────────────────────────────

export type AuditActorType = 'agent' | 'user' | 'system'
export type AuditStatus = 'success' | 'failed' | 'pending'

export interface AuditLogRow {
  id: string
  timestamp: string
  operator_id: string | null
  actor_type: AuditActorType | null
  actor_id: string | null
  tenant_id: string | null
  target_tenant_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  run_id: string | null
  thread_id: string | null
  request_reason: string | null
  status: AuditStatus | null
  changes: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
}
