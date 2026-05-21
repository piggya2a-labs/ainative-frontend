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
//
// Manus API 集成：
//   当 E2B stdout 里包含 manus_task_id 时，调用 Manus API 拉取截图 URL
//   Manus task.listMessages 响应字段是 messages（不是 events）

const LANGSMITH_API_KEY = process.env.LANGSMITH_API_KEY!
const MANUS_API_KEY = process.env.MANUS_API_KEY || 'sk-hsrsjfH2b1WTZRiAIj3gwyhHFTyY8vkumJbZAC3bbEpisCPeS55iDZEcpAdWyxnimAF2F3Gp2HgUVik'
const BASE = 'https://api.smith.langchain.com'
const MANUS_BASE = 'https://api.manus.ai'

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

// ─── Manus API：拉取任务截图 URL ──────────────────────────────────────────────
// 注意：Manus task.listMessages 返回的顶层字段是 messages（不是 events）
async function fetchManusScreenshot(taskId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${MANUS_BASE}/v2/task.listMessages?task_id=${taskId}&order=desc&limit=30`,
      { headers: { 'x-manus-api-key': MANUS_API_KEY }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const messages: Record<string, unknown>[] = data.messages || []

    // 1. 先找 structured_output_result
    for (const msg of messages) {
      if (msg.type === 'structured_output_result') {
        const result = msg.structured_output_result as Record<string, unknown> | undefined
        if (result?.success && result.value) {
          const val = result.value as Record<string, unknown>
          const url = val.screenshot_url as string || val.url as string || ''
          if (url) return url
        }
      }
    }

    // 2. 再找 assistant_message 里的图片 URL
    for (const msg of messages) {
      if (msg.type === 'assistant_message') {
        const content = (msg.assistant_message as Record<string, unknown>)?.content
        if (Array.isArray(content)) {
          for (const c of content) {
            if (typeof c === 'object' && c !== null) {
              const item = c as Record<string, unknown>
              if (item.type === 'image_url') {
                const imgUrl = (item.image_url as Record<string, unknown>)?.url as string
                if (imgUrl) return imgUrl
              }
              if (item.type === 'text') {
                const text = item.text as string || ''
                const match = text.match(/https?:\/\/\S+\.(?:png|jpg|jpeg|webp|gif)\S*/i)
                if (match) return match[0]
              }
            }
          }
        } else if (typeof content === 'string') {
          const match = content.match(/https?:\/\/\S+\.(?:png|jpg|jpeg|webp|gif)\S*/i)
          if (match) return match[0]
        }
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── 工具调用里提取产出物 ─────────────────────────────────────────────────────
function extractArtifacts(run: LangSmithRun): { type: 'stdout' | 'file' | 'screenshot' | 'text'; label: string; content: string; manus_task_id?: string }[] {
  const artifacts: { type: 'stdout' | 'file' | 'screenshot' | 'text'; label: string; content: string; manus_task_id?: string }[] = []
  const outputs = run.outputs as Record<string, unknown> | undefined
  if (!outputs) return artifacts

  const toolName = run.name || ''

  // E2B 沙箱执行结果
  if (toolName.includes('e2b') || toolName.includes('run_code')) {
    // E2B tool output 结构：{ content: '{"ok":true,"stdout":"..."}' }
    // 需要先解析 content JSON，再拿里面的 stdout
    let parsedStdout = ''
    if (typeof outputs.content === 'string') {
      try {
        const parsed = JSON.parse(outputs.content)
        if (parsed && typeof parsed.stdout === 'string') {
          parsedStdout = parsed.stdout
        }
      } catch { /* ignore */ }
    }
    const rawStdout = parsedStdout || outputs.stdout ?? outputs.output ?? outputs.result ?? ''
    const stdout = typeof rawStdout === 'string' ? rawStdout : JSON.stringify(rawStdout)
    if (stdout && stdout.trim()) {
      const artifact: { type: 'stdout'; label: string; content: string; manus_task_id?: string } = {
        type: 'stdout',
        label: 'stdout',
        content: stdout.trim()
      }
      // 检测 stdout 里是否有 Manus task_id
      // 匹配三种格式：
      // 1. manus_task_id: xxx（显式标记）
      // 2. "task_id": "xxx"（Manus API 响应 JSON）
      // 3. task_id: xxx（纯文本格式）
      const taskIdMatch =
        stdout.match(/"?manus_task_id"?\s*[:=]\s*"?([A-Za-z0-9_-]{10,30})"?/) ||
        stdout.match(/"task_id"\s*:\s*"([A-Za-z0-9_-]{10,30})"/)
      if (taskIdMatch) {
        artifact.manus_task_id = taskIdMatch[1]
      }

      // 直接从 stdout 里提取截图 URL（不需要再调 Manus API）
      // 优先匹配 FINAL screenshot_url，其次匹配 screenshot_url
      // 用 [^\s]+ 确保不跨行
      const screenshotMatch =
        stdout.match(/FINAL\s+screenshot_url:\s*(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp|gif)[^\s]*)/i) ||
        stdout.match(/(?<!FINAL\s)screenshot_url:\s*(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp|gif)[^\s]*)/i)
      if (screenshotMatch) {
        const cleanUrl = screenshotMatch[1].replace(/[\r\n].*/g, '').trim()
        if (cleanUrl) artifacts.push({ type: 'screenshot', label: 'Manus 截图', content: cleanUrl })
      }

      artifacts.push(artifact)
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
      if (s.trim() && s !== (typeof rawStdout === 'string' ? rawStdout : '')) {
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
    const manusTaskIds: string[] = []

    for (const tr of allToolRuns) {
      const extracted = extractArtifacts(tr)
      for (const a of extracted) {
        if (a.type === 'screenshot') {
          screenshots.push(a.content)
        } else {
          artifacts.push({ ...a, run_name: tr.name, time: tr.start_time })
          // 收集 Manus task ID
          if (a.manus_task_id && !manusTaskIds.includes(a.manus_task_id)) {
            manusTaskIds.push(a.manus_task_id)
          }
        }
      }
    }

    // Step 4b: 从 Manus 任务里拉取截图 URL（并发，最多 3 个）
    if (manusTaskIds.length > 0) {
      const manusScreenshots = await Promise.all(
        manusTaskIds.slice(0, 3).map(id => fetchManusScreenshot(id))
      )
      for (const url of manusScreenshots) {
        if (url && !screenshots.includes(url)) {
          screenshots.push(url)
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
      manus_task_ids: manusTaskIds,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
