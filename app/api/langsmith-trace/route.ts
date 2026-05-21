import { NextRequest, NextResponse } from 'next/server'

// ─── LangSmith Trace API Route ────────────────────────────────────────────────
// 接收 tenant_slug，在 LangSmith 两个项目里搜索包含该 slug 的 root runs，
// 提取工具调用（tool runs），返回执行轨迹、产出物、截图 URL。
// 锚点：tenant_slug 出现在 run 的 inputs 消息文本里。
// 不需要 Agent 打标，完全程序化追踪。
//
// LangSmith API 正确用法：
//   查 root runs: POST /api/v1/runs/query { session: [sessionId], is_root: true }
//   查子 runs:    POST /api/v1/runs/query { trace: runId, run_type: 'tool' }

const LANGSMITH_API_KEY = process.env.LANGSMITH_API_KEY!
const BASE = 'https://api.smith.langchain.com'

// piggya2a 和 piggya2a-user-01 两个项目的 session ID
const SESSION_IDS = [
  '5e444c7f-88aa-48d1-9783-623c59591801', // piggya2a
  '146a2fe8-f1ad-40ae-8518-76fa76d4f93b', // piggya2a-user-01
]

interface LangSmithRun {
  id: string
  name: string
  run_type: string
  status: string
  start_time: string
  end_time?: string
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  error?: string
  parent_run_id?: string | null
}

// 工具调用里提取产出物
function extractArtifacts(run: LangSmithRun): { type: 'stdout' | 'file' | 'screenshot' | 'text'; label: string; content: string }[] {
  const artifacts: { type: 'stdout' | 'file' | 'screenshot' | 'text'; label: string; content: string }[] = []
  const outputs = run.outputs as Record<string, unknown> | undefined
  if (!outputs) return artifacts

  const toolName = run.name || ''

  // E2B 沙箱执行结果
  if (toolName.includes('e2b') || toolName.includes('run_code')) {
    const rawStdout = outputs.stdout ?? outputs.output ?? outputs.result ?? ''
    const stdout = typeof rawStdout === 'string' ? rawStdout : JSON.stringify(rawStdout)
    if (stdout && stdout.trim()) {
      artifacts.push({ type: 'stdout', label: 'stdout', content: stdout.trim() })
    }
    const rawStderr = outputs.stderr
    const stderr = typeof rawStderr === 'string' ? rawStderr : ''
    if (stderr && stderr.trim()) {
      artifacts.push({ type: 'text', label: 'stderr', content: stderr.trim() })
    }
    // 处理 { ok: true, stdout: '...' } 格式
    const okOutput = outputs as { ok?: boolean; stdout?: unknown; stderr?: unknown }
    if (okOutput.ok === true && okOutput.stdout) {
      const s = typeof okOutput.stdout === 'string' ? okOutput.stdout : JSON.stringify(okOutput.stdout)
      if (s.trim() && s !== stdout) {
        artifacts.push({ type: 'stdout', label: 'stdout', content: s.trim() })
      }
    }
  }

  // 写文件
  if (toolName.includes('write_file') || toolName.includes('write')) {
    const path = (run.inputs as Record<string, unknown>)?.path as string || ''
    const content = (run.inputs as Record<string, unknown>)?.content as string || ''
    if (path) {
      artifacts.push({ type: 'file', label: path, content: content.slice(0, 500) + (content.length > 500 ? '…' : '') })
    }
  }

  // 截图
  if (toolName.includes('screenshot') || toolName.includes('steel')) {
    const url = (outputs.url as string) || (outputs.image_url as string) || (outputs.screenshot_url as string) || ''
    if (url) {
      artifacts.push({ type: 'screenshot', label: '截图', content: url })
    }
  }

  return artifacts
}

async function queryRuns(body: Record<string, unknown>): Promise<LangSmithRun[]> {
  const res = await fetch(`${BASE}/api/v1/runs/query`, {
    method: 'POST',
    headers: { 'x-api-key': LANGSMITH_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.runs || data || []) as LangSmithRun[]
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tenantSlug = searchParams.get('slug')

  if (!tenantSlug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  if (!LANGSMITH_API_KEY) {
    return NextResponse.json({ error: 'LANGSMITH_API_KEY not configured' }, { status: 500 })
  }

  try {
    // Step 1: 查询两个项目最近 100 个 root runs
    const rootRuns = await queryRuns({
      session: SESSION_IDS,
      run_type: 'chain',
      is_root: true,
      limit: 100,
    })

    // Step 2: 过滤出 inputs 里包含 tenantSlug 的 runs
    const matchedRuns = rootRuns.filter(run => {
      const inputStr = JSON.stringify(run.inputs || '')
      return inputStr.includes(tenantSlug)
    })

    if (matchedRuns.length === 0) {
      return NextResponse.json({ runs: [], total_calls: 0, agents: [], artifacts: [], screenshots: [], timeline: [] })
    }

    // Step 3: 对每个匹配的 root run，查询其子 tool runs
    const allToolRuns: (LangSmithRun & { root_run_id: string; root_run_name: string })[] = []

    for (const rootRun of matchedRuns.slice(0, 10)) {
      const childRuns = await queryRuns({
        trace: rootRun.id,
        run_type: 'tool',
        limit: 50,
      })
      for (const cr of childRuns) {
        allToolRuns.push({ ...cr, root_run_id: rootRun.id, root_run_name: rootRun.name })
      }
    }

    // Step 4: 提取产出物和截图
    const artifacts: { type: string; label: string; content: string; run_name: string; time: string }[] = []
    const screenshots: string[] = []

    for (const tr of allToolRuns) {
      const extracted = extractArtifacts(tr)
      for (const a of extracted) {
        if (a.type === 'screenshot') {
          screenshots.push(a.content)
        } else {
          artifacts.push({ ...a, run_name: tr.name, time: tr.start_time })
        }
      }
    }

    // Step 5: 统计 Agent 列表（从 root run name 推断）
    const agentSet = new Set<string>()
    for (const r of matchedRuns) {
      const name = r.name || ''
      if (name.includes('polly') || name.includes('Polly')) agentSet.add('@Polly')
      else if (name.includes('lumen') || name.includes('Lumen') || name.includes('meta_manage')) agentSet.add('@Lumen')
      else if (name.includes('sega') || name.includes('Sega') || name.includes('dev')) agentSet.add('@Sega')
      else if (name.includes('eva') || name.includes('Eva') || name.includes('evaluator')) agentSet.add('@Eva')
      else if (name.trim()) agentSet.add(name.slice(0, 20))
    }

    // Step 6: 构建时间线（按时间排序的工具调用）
    const timeline = allToolRuns
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .map(tr => ({
        id: tr.id,
        tool: tr.name,
        status: tr.status,
        start_time: tr.start_time,
        end_time: tr.end_time,
        root_run_name: tr.root_run_name,
        has_output: !!(tr.outputs && Object.keys(tr.outputs).length > 0),
        error: tr.error || null,
      }))

    return NextResponse.json({
      runs: matchedRuns.map(r => ({ id: r.id, name: r.name, status: r.status, start_time: r.start_time })),
      total_calls: allToolRuns.length,
      agents: Array.from(agentSet),
      timeline,
      artifacts,
      screenshots,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
