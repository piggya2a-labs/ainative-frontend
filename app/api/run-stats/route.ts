import { NextRequest, NextResponse } from 'next/server'

const LANGSMITH_API_KEY = process.env.LANGSMITH_API_KEY ?? ''
const LANGSMITH_BASE = 'https://api.smith.langchain.com'

// 定价表（per token，美元）
// 历史 run 没有 total_cost 时用这个估算
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5':          { input: 0.000003,  output: 0.000015 },
  'anthropic/claude-sonnet-4-5': { input: 0.000003,  output: 0.000015 },
  'claude-opus-4-7':             { input: 0.000005,  output: 0.000025 },
  'anthropic/claude-opus-4-7':   { input: 0.000005,  output: 0.000025 },
  'claude-haiku-3-5':            { input: 0.0000008, output: 0.000004 },
  'gpt-4o':                      { input: 0.0000025, output: 0.000010 },
  'gpt-4o-mini':                 { input: 0.00000015,output: 0.0000006 },
  'gemini-2.5-flash':            { input: 0.0000003, output: 0.0000025 },
}

function estimateCost(model: string, promptTokens: number, completionTokens: number): number | null {
  // 精确匹配
  const key = Object.keys(MODEL_PRICING).find(k => model.toLowerCase().includes(k.toLowerCase()))
  if (!key) return null
  const p = MODEL_PRICING[key]
  return p.input * promptTokens + p.output * completionTokens
}

/**
 * GET /api/run-stats?run_id=xxx
 * 返回单个 run 的完整量化指标：
 *   - prompt_tokens, completion_tokens, total_tokens
 *   - llm_rounds: LLM 调用次数（思考轮次）
 *   - tool_calls: 工具调用次数
 *   - tool_names: 调用的工具种类列表
 *   - model: 使用的模型名
 *   - duration_ms: 耗时
 *   - status: success / error
 *   - error: 错误信息（失败时）
 *   - total_cost: 成本（$），优先用 LangSmith 原生值，否则估算
 *   - cost_estimated: 是否为估算值
 *   - first_token_ms: 首 token 延迟（ms，streaming 时有值）
 *   - feedback_stats: 评分统计
 */
export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('run_id')
  if (!runId) {
    return NextResponse.json({ error: 'run_id required' }, { status: 400 })
  }

  try {
    // 1. 查 root run
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

    // first_token_time → TTFT（ms）
    const firstTokenMs = root.first_token_time && root.start_time
      ? new Date(root.first_token_time).getTime() - startTime
      : null

    // 2. 查 child runs（统计 LLM 轮次、工具调用、模型名）
    let llmRounds = 0
    let toolCallCount = 0
    const toolNamesSet = new Set<string>()
    let modelName: string | null = null

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
      const runs: Array<{
        run_type: string
        name: string
        extra?: { invocation_params?: { model?: string } }
      }> = childData.runs ?? []

      for (const r of runs) {
        if (r.run_type === 'llm') {
          llmRounds++
          // 从第一个 llm run 里取模型名
          if (!modelName && r.extra?.invocation_params?.model) {
            modelName = r.extra.invocation_params.model
          }
        }
        if (r.run_type === 'tool') {
          toolCallCount++
          if (r.name) toolNamesSet.add(r.name)
        }
      }

      cursor = childData.cursor ?? null
      hasMore = !!cursor && runs.length >= 100
    }

    // 3. 成本：优先用 LangSmith 原生值，否则估算
    let totalCost: number | null = root.total_cost ?? null
    let costEstimated = false
    if (totalCost === null && modelName && promptTokens > 0) {
      totalCost = estimateCost(modelName, promptTokens, completionTokens)
      if (totalCost !== null) costEstimated = true
    }

    return NextResponse.json({
      run_id: runId,
      status: root.status,
      error: root.error ?? null,
      model: modelName,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      llm_rounds: llmRounds,
      tool_call_count: toolCallCount,
      tool_names: Array.from(toolNamesSet).sort(),
      duration_ms: durationMs,
      first_token_ms: firstTokenMs,
      total_cost: totalCost,
      cost_estimated: costEstimated,
      feedback_stats: root.feedback_stats ?? null,
      start_time: root.start_time,
      end_time: root.end_time,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
