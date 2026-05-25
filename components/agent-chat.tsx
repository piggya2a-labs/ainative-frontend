'use client'
/**
 * AgentChat 组件
 *
 * 完全基于官方 @langchain/langgraph-sdk/react 的 useStream Hook：
 * - 发消息 → stream.submit({ messages: [...] })
 * - 历史消息 → stream.messages（useStream 在 mount 时自动加载历史）
 * - 流式渲染 → stream.isLoading + stream.messages
 * - 图片渲染 → 检测 tool message content 里的 image_url 字段直接渲染 <img>
 * - 零手写 SSE 解析
 */
import { useStream } from '@langchain/langgraph-sdk/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Streamdown } from 'streamdown'
import { cjk } from '@streamdown/cjk'
import 'streamdown/styles.css'
import { Send, Loader2 } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'

interface AgentChatProps {
  /** LangGraph assistant_id（UUID） */
  assistantId: string
  /** 已有的 thread_id，传入后 useStream 自动加载历史消息 */
  threadId?: string
  placeholder?: string
}

// 从 tool message 的 content 里提取截图 URL（steel 返回 JSON 字符串）
function extractImageUrl(content: unknown): string | null {
  if (!content) return null
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content)
      if (parsed?.image_url && typeof parsed.image_url === 'string') return parsed.image_url
      if (parsed?.url && typeof parsed.url === 'string' && /\.(png|jpg|jpeg|webp|gif)/i.test(parsed.url)) return parsed.url
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item?.image_url) return item.image_url
        }
      }
    } catch { /* not JSON */ }
    return null
  }
  if (Array.isArray(content)) {
    for (const block of content as Array<Record<string, unknown>>) {
      if (block?.type === 'image_url' && (block?.image_url as Record<string, unknown>)?.url) {
        return (block.image_url as Record<string, unknown>).url as string
      }
    }
  }
  if (typeof content === 'object') {
    const c = content as Record<string, unknown>
    if (c.image_url && typeof c.image_url === 'string') return c.image_url
  }
  return null
}

// 渲染单条消息内容
function MessageContent({
  msg,
  isStreaming,
}: {
  msg: Record<string, unknown>
  isStreaming: boolean
}) {
  const role = (msg.role ?? msg.type ?? '') as string
  const content = msg.content

  // 工具消息：尝试提取图片
  if (role === 'tool') {
    const imgUrl = extractImageUrl(content)
    if (imgUrl) {
      return (
        <div className="space-y-1">
          <img
            src={imgUrl}
            alt="截图"
            className="max-w-full rounded border border-border/50 cursor-pointer"
            style={{ maxHeight: 240 }}
            onClick={() => window.open(imgUrl, '_blank')}
          />
          <p className="text-xs text-muted-foreground/50">点击查看原图</p>
        </div>
      )
    }
    const text = typeof content === 'string' ? content : JSON.stringify(content)
    return (
      <code className="text-xs font-mono text-muted-foreground/70 whitespace-pre-wrap break-all">
        {text.length > 300 ? text.slice(0, 300) + '…' : text}
      </code>
    )
  }

  // AI 消息：流式 Markdown 渲染
  if (role === 'assistant' || role === 'ai') {
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? (content as Array<{ type?: string; text?: string }>)
            .filter(c => c.type === 'text').map(c => c.text ?? '').join('')
        : String(content ?? '')
    if (isStreaming && !text) {
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
    }
    return (
      <Streamdown animated isAnimating={isStreaming} plugins={{ cjk }}>
        {text}
      </Streamdown>
    )
  }

  // 用户消息
  const text = typeof content === 'string' ? content : JSON.stringify(content)
  return <span className="whitespace-pre-wrap">{text}</span>
}

export function AgentChat({ assistantId, threadId, placeholder = '输入消息，Enter 发送，Shift+Enter 换行' }: AgentChatProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // 官方 useStream：自动加载历史消息（threadId 传入时），自动流式更新
  // 注：streamMode 是 SubmitOptions 的参数，不是 UseStreamOptions 的参数，在 submit() 时传入
  const stream = useStream<{ messages: Array<Record<string, unknown>> }>({
    apiUrl: '/api/lg-proxy',
    assistantId,
    threadId,
  })

  // 滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [stream.messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || stream.isLoading) return
    setInput('')
    await stream.submit({
      messages: [{ role: 'user', content: text }],
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // 过滤掉 system 消息，只显示 human/user、ai/assistant、tool 消息
  const visibleMessages = (stream.messages as Array<Record<string, unknown>>).filter(m => {
    const role = (m.role ?? m.type ?? '') as string
    return ['human', 'user', 'ai', 'assistant', 'tool'].includes(role)
  })

  return (
    <div className="flex flex-col h-full min-h-[200px]">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2 pr-1">
        {stream.isThreadLoading && (
          <div className="flex items-center justify-center gap-2 pt-6">
            <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground/50 italic">加载历史消息…</p>
          </div>
        )}
        {!stream.isThreadLoading && visibleMessages.length === 0 && (
          <p className="text-xs text-muted-foreground/50 italic text-center pt-6">
            发送消息开始对话
          </p>
        )}
        {visibleMessages.map((msg, i) => {
          const role = (msg.role ?? msg.type ?? 'assistant') as string
          const isUser = role === 'human' || role === 'user'
          const isTool = role === 'tool'
          const isLastMsg = i === visibleMessages.length - 1
          const isStreaming = stream.isLoading && isLastMsg && !isUser

          return (
            <div
              key={(msg.id as string) ?? i}
              className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {isTool && (
                <span className="text-xs text-muted-foreground/40 self-start pt-1 shrink-0">🔧</span>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  isUser
                    ? 'bg-primary text-primary-foreground'
                    : isTool
                      ? 'bg-muted/50 border border-border/30 text-foreground'
                      : 'bg-muted text-foreground'
                }`}
              >
                <MessageContent msg={msg} isStreaming={isStreaming} />
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* 输入框 */}
      <div className="flex gap-2 pt-2 border-t border-border/50">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className="resize-none text-sm"
          disabled={stream.isLoading}
        />
        <Button
          size="sm"
          onClick={sendMessage}
          disabled={stream.isLoading || !input.trim()}
          className="self-end"
        >
          {stream.isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}

export default AgentChat
