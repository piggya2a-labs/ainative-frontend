'use client'
/**
 * AgentChat 组件
 *
 * 纯展示层：
 * - 发消息 → POST /api/agent-chat（API Route 负责认证和 LangGraph 转发）
 * - 读 SSE 流 → 实时渲染 AI 回复（Streamdown animated）
 * - 支持 LangGraph values 事件格式：event=values, data={messages:[...]}
 */
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Streamdown } from 'streamdown'
import { cjk } from '@streamdown/cjk'
import 'streamdown/styles.css'

import { Send, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface AgentChatProps {
  /** LangGraph assistant_id */
  assistantId: string
  /** 可选：已有的 thread_id（不传则自动生成确定性 thread） */
  threadId?: string
  placeholder?: string
}

export function AgentChat({ assistantId, threadId, placeholder = '输入消息，Enter 发送，Shift+Enter 换行' }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const historyLoadedRef = useRef(false)

  // B-04 修复：mount 时从 LangGraph Thread state 加载历史消息
  useEffect(() => {
    if (!threadId || historyLoadedRef.current) return
    historyLoadedRef.current = true
    setHistoryLoading(true)
    fetch('/api/langgraph-trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `/threads/${threadId}/state` }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const msgs: Array<{ role?: string; type?: string; content?: unknown }> =
          data?.values?.messages ?? []
        if (msgs.length > 0) {
          const parsed: Message[] = msgs
            .filter(m => m.role === 'user' || m.role === 'assistant' || m.type === 'human' || m.type === 'ai')
            .map(m => ({
              role: ((m.role === 'user' || m.type === 'human') ? 'user' : 'assistant') as 'user' | 'assistant',
              content: typeof m.content === 'string' ? m.content
                : Array.isArray(m.content)
                  ? (m.content as Array<{ type?: string; text?: string }>)
                      .filter(c => c.type === 'text').map(c => c.text ?? '').join('')
                  : String(m.content ?? ''),
            }))
            .filter(m => m.content.trim())
          if (parsed.length > 0) setMessages(parsed)
        }
      })
      .catch(() => { /* 静默失败，不影响正常使用 */ })
      .finally(() => setHistoryLoading(false))
  }, [threadId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    try {
      const resp = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistant_id: assistantId,
          message: text,
          thread_id: threadId,
        }),
      })

      if (!resp.ok || !resp.body) {
        const err = await resp.text()
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: `错误：${err}`, streaming: false }
          return next
        })
        return
      }

      // 读 LangGraph SSE 流
      // 格式：event: values\ndata: {"messages": [...]}
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventType = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
          } else if (line.startsWith('data:') && eventType === 'values') {
            try {
              const payload = JSON.parse(line.slice(5).trim())
              // LangGraph values 事件：messages 数组，取最后一条 AI 消息
              const msgs: Array<{ role?: string; type?: string; content?: string }> =
                payload?.messages ?? []
              const lastAi = [...msgs].reverse().find(
                m => m.role === 'assistant' || m.type === 'ai'
              )
              if (lastAi?.content) {
                setMessages(prev => {
                  const next = [...prev]
                  next[next.length - 1] = {
                    role: 'assistant',
                    content: lastAi.content!,
                    streaming: true,
                  }
                  return next
                })
              }
            } catch { /* ignore parse errors */ }
            eventType = ''
          }
        }
      }

      // 流结束，去掉 streaming 标记
      setMessages(prev => {
        const next = [...prev]
        if (next.length > 0) {
          next[next.length - 1] = { ...next[next.length - 1], streaming: false }
        }
        return next
      })
    } catch (e) {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: `连接失败：${String(e)}`, streaming: false }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full min-h-[200px]">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2 pr-1">
        {historyLoading && (
          <div className="flex items-center justify-center gap-2 pt-6">
            <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground/50 italic">加载历史消息…</p>
          </div>
        )}
        {!historyLoading && messages.length === 0 && (
          <p className="text-xs text-muted-foreground/50 italic text-center pt-6">
            发送消息开始对话
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {msg.role === 'assistant' ? (
                msg.streaming && !msg.content ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <Streamdown animated isAnimating={msg.streaming} plugins={{ cjk }}>
                    {msg.content}
                  </Streamdown>
                )
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}
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
          disabled={streaming}
        />
        <Button
          size="sm"
          onClick={sendMessage}
          disabled={streaming || !input.trim()}
          className="self-end"
        >
          {streaming ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}
