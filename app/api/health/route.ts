export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {}

  // 检查 Sanity
  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    if (!projectId) throw new Error('NEXT_PUBLIC_SANITY_PROJECT_ID not set')
    const r = await fetch(
      `https://${projectId}.api.sanity.io/v2024-01-01/data/query/production?query=1`,
      { cache: 'no-store' }
    )
    checks.sanity = { ok: r.ok, detail: r.ok ? `project=${projectId}` : `HTTP ${r.status}` }
  } catch (e) {
    checks.sanity = { ok: false, detail: String(e) }
  }

  // 检查 Supabase
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase env not set')
    const r = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key },
      cache: 'no-store',
    })
    checks.supabase = { ok: r.ok, detail: r.ok ? 'connected' : `HTTP ${r.status}` }
  } catch (e) {
    checks.supabase = { ok: false, detail: String(e) }
  }

  // 检查关键环境变量
  const requiredEnvs = [
    'NEXT_PUBLIC_SANITY_PROJECT_ID',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_POSTHOG_KEY',
    'AGENT_API_SECRET',
    'SANITY_API_WRITE_TOKEN',
  ]
  const envChecks: Record<string, boolean> = {}
  for (const k of requiredEnvs) {
    envChecks[k] = !!process.env[k]
  }
  checks.env = {
    ok: Object.values(envChecks).every(Boolean),
    detail: JSON.stringify(envChecks),
  }

  const allOk = Object.values(checks).every((c) => c.ok)

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  )
}
