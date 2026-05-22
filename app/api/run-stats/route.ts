import { NextRequest, NextResponse } from 'next/server'

const LANGSMITH_API_KEY = process.env.LANGSMITH_API_KEY ?? ''
const LANGSMITH_BASE = 'https://api.smith.langchain.com'

/**
 * GET /api/run-stats?run_id=xxx
 * 返回单个 run 的量化指标：
 *   - prompt_tokens, completion_tokens, total_tokens
 *   - llm_rounds: LLM 调用次数（思考轮次）
 *   - tool_calls: 工具调用次数
 *   - tool_names: 调用的工具种类列表
 *   - duration_ms: 耗时
 *   - status
 */
export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('run_id')
  if (!runId) {
    return NextResponse.json({ error: 'run_id required' }, { status: 400 })
  }

  try {
    // 1. 查 root run（获取 token 总量和耗时）
    const rootResp = await fetch(`${LANGSMITH_BASE}/api/v1/runs/${runId}`, {
      headers: { 'x-api-key': LANGSMITH_API_KEY },
    })
    if (!rootResp.ok) {
      return NextResponse.json({ error: `LangSmith error: ${rootResp.status}` }, { status: rootResp.status })
    }
    const root = await rootResp.json()

    const promptTokens: number = root.prompt_tokens ?? 0
    const completionTokens: number = root.completion_tokens ?? 0
    const totalTokens: number = root.total_tokens ?? (promptTokens + completionTokens)

    const startTime = root.start_time ? new Date(root.start_time).getTime() : 0
    const endTime = root.end_time ? new Date(root.end_time).getTime() : 0
    const durationMs = startTime && endTime ? endTime - startTime : null

    // 2. 查 child runs（统计 LLM 轮次和工具调用）
    let llmRounds = 0
    let toolCallCount = 0
    const toolNamesSet = new Set<string>()

    let cursor: string | null = null
    let hasMore = true
    while (hasMore) {
      const body: Record<string, unknown> = { trace: runId, limit: 100 }
      if (cursor) body.cursor = cursor

      const childResp = await fetch(`${LANGSMITH_BASE}/api/v1/runs/query`, {
        method: 'POST',
        headers: { 'x-api-key': LANGSMITH_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!childResp.ok) break

      const childData = await childResp.json()
      const runs: Array<{ run_type: string; name: string }> = childData.runs ?? []

      for (const r of runs) {
        if (r.run_type === 'llm') llmRounds++
        if (r.run_type === 'tool') {
          toolCallCount++
          if (r.name) toolNamesSet.add(r.name)
        }
      }

      cursor = childData.cursor ?? null
      hasMore = !!cursor && runs.length >= 100
    }

    return NextResponse.json({
      run_id: runId,
      status: root.status,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      llm_rounds: llmRounds,
      tool_call_count: toolCallCount,
      tool_names: Array.from(toolNamesSet).sort(),
      duration_ms: durationMs,
      start_time: root.start_time,
      end_time: root.end_time,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
