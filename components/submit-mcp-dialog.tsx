'use client'

import { useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertCircle, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'

const EDGE_FN_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-connector-register`

interface DiscoveredTool {
  name: string
  description?: string
}

interface DiscoveredMCP {
  name: string
  tools: DiscoveredTool[]
  tools_count: number
  agent_id: string
}

interface SubmitMcpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type Step = 'url' | 'preview' | 'done' | 'error'

export function SubmitMcpDialog({ open, onOpenChange, onSuccess }: SubmitMcpDialogProps) {
  const posthog = usePostHog()
  const [step, setStep] = useState<Step>('url')
  const [mcpUrl, setMcpUrl] = useState('')
  const [discovered, setDiscovered] = useState<DiscoveredMCP | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setStep('url')
    setMcpUrl('')
    setApiKey('')
    setDiscovered(null)
    setName('')
    setDescription('')
    setError('')
  }

  async function getAuthToken(): Promise<string | null> {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }

  async function handleDiscover() {
    if (!mcpUrl.trim()) return
    setLoading(true)
    setError('')
    posthog?.capture('marketplace_mcp_discover_start', { mcp_url: mcpUrl })
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('请先登录后再添加 MCP')

      // 如果用户填了 API Key，传入 mcp_headers
      const mcpHeaders: Record<string, string> = {}
      if (apiKey.trim()) {
        mcpHeaders['Authorization'] = `Bearer ${apiKey.trim()}`
      }

      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          mcp_url: mcpUrl.trim(),
          ...(Object.keys(mcpHeaders).length ? { mcp_headers: mcpHeaders } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Discover failed')

      // OAuth 需要跳转授权
      if (data.status === 'oauth_required' && data.authorization_url) {
        posthog?.capture('marketplace_mcp_oauth_redirect', { mcp_url: mcpUrl })
        window.location.href = data.authorization_url
        return
      }

      // 无 OAuth：后端已写入 agent_registry，直接进入 preview
      const toolList: DiscoveredTool[] = (data.tools ?? []).map((t: string | DiscoveredTool) =>
        typeof t === 'string' ? { name: t } : t
      )
      setDiscovered({
        name: data.name ?? mcpUrl,
        tools: toolList,
        tools_count: data.tools_count ?? toolList.length,
        agent_id: data.agent_id,
      })
      setName(data.name ?? '')
      setStep('preview')
      posthog?.capture('marketplace_mcp_discover_success', {
        mcp_url: mcpUrl,
        tool_count: data.tools_count ?? toolList.length,
        name: data.name,
        agent_id: data.agent_id,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      setStep('error')
      posthog?.capture('marketplace_mcp_discover_error', { mcp_url: mcpUrl, error: msg })
    } finally {
      setLoading(false)
    }
  }

  async function handlePublish() {
    if (!discovered) return
    setLoading(true)
    posthog?.capture('marketplace_mcp_publish_start', { mcp_url: mcpUrl, name, agent_id: discovered.agent_id })
    try {
      // 后端在 discover 阶段已写入 agent_registry + tenant_connectors
      // 如果用户修改了 name/description，更新 agent_registry
      if ((name.trim() && name.trim() !== discovered.name) || description.trim()) {
        const supabase = createClient()
        await supabase
          .from('agent_registry')
          .update({
            ...(name.trim() ? { name: name.trim() } : {}),
            ...(description.trim() ? { description: description.trim() } : {}),
          })
          .eq('id', discovered.agent_id)
      }
      setStep('done')
      posthog?.capture('marketplace_mcp_publish_success', {
        mcp_url: mcpUrl,
        name: name || discovered.name,
        agent_id: discovered.agent_id,
      })
      onSuccess?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      setStep('error')
      posthog?.capture('marketplace_mcp_publish_error', { mcp_url: mcpUrl, error: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--onit-green)]" />
            {step === 'done' ? 'Agent 已发布' : '添加 MCP Agent'}
          </DialogTitle>
          <DialogDescription>
            {step === 'url' && '粘贴任意 MCP Server URL，自动识别工具能力'}
            {step === 'preview' && '确认信息后发布到 Marketplace'}
            {step === 'done' && '其他用户现在可以直接 Connect 这个 Agent'}
            {step === 'error' && '无法连接到该 MCP Server'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: URL input */}
        {step === 'url' && (
          <div className="space-y-4">
            <Input
              placeholder="https://mcp.example.com/server"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
              className="font-mono text-sm"
              autoFocus
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                API Key
                <span className="ml-1 text-muted-foreground/60">(可选，需要认证的服务填写)</span>
              </label>
              <Input
                type="password"
                placeholder="Bearer token 或 API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleDiscover}
              disabled={!mcpUrl.trim() || loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? '识别中…' : '识别工具能力'}
            </Button>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && discovered && (
          <div className="space-y-4">
            {/* Discovered tools preview */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  识别到 {discovered.tools_count} 个工具
                </span>
                <Badge variant="outline" className="text-[10px] bg-[var(--onit-green)]/10 text-[var(--onit-green)] border-[var(--onit-green)]/20">
                  MCP
                </Badge>
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-border">
                {discovered.tools.slice(0, 12).map((t) => (
                  <div key={t.name} className="px-3 py-2">
                    <span className="text-xs font-mono font-medium block">{t.name}</span>
                    {t.description && (
                      <span className="text-[11px] text-muted-foreground block mt-0.5 truncate">
                        {t.description}
                      </span>
                    )}
                  </div>
                ))}
                {discovered.tools.length > 12 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground font-mono">
                    +{discovered.tools.length - 12} more…
                  </div>
                )}
              </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">名称</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={discovered.name}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">一句话介绍</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述这个 Agent 能做什么"
                  className="text-sm resize-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('url')}>
                返回
              </Button>
              <Button className="flex-1" onClick={handlePublish} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {loading ? '发布中…' : '发布到 Marketplace'}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle2 className="w-10 h-10 text-[var(--onit-green)]" />
            <p className="text-sm text-center text-muted-foreground">
              <span className="font-medium text-foreground">{name || discovered?.name}</span> 已出现在 Marketplace，
              任何用户可以直接 Connect。
            </p>
            <Button className="w-full" onClick={() => { reset(); onOpenChange(false) }}>
              完成
            </Button>
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-center text-muted-foreground">{error}</p>
            <Button variant="outline" className="w-full" onClick={() => setStep('url')}>
              重试
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
