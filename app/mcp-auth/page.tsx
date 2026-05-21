'use client'
/**
 * /mcp-auth — ONIT MCP OAuth Authorization Page
 *
 * This page is shown when a user connects ONIT MCP from Claude/ChatGPT.
 * Flow:
 *   1. Claude redirects here with ?redirect_uri=...&client_id=...&state=...&code_challenge=...
 *   2. User logs in (or is already logged in)
 *   3. User clicks "授权" (Authorize)
 *   4. We call /api/mcp-oauth to generate an auth code
 *   5. We redirect back to Claude with ?code=...&state=...
 *   6. Claude exchanges the code for an access token via /oauth/token
 */
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function McpAuthContent() {
  const searchParams = useSearchParams()
  const redirectUri = searchParams.get('redirect_uri') ?? ''
  const clientId = searchParams.get('client_id') ?? ''
  const state = searchParams.get('state') ?? ''
  const codeChallenge = searchParams.get('code_challenge') ?? ''

  const [step, setStep] = useState<'login' | 'authorize' | 'done' | 'error'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<{ access_token: string; user_email: string } | null>(null)

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s?.access_token) {
        setSession({ access_token: s.access_token, user_email: s.user?.email ?? '' })
        setStep('authorize')
      }
    })
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !data.session) {
      setError(authError?.message === 'Invalid login credentials' ? '邮箱或密码错误' : (authError?.message ?? '登录失败'))
    } else {
      setSession({ access_token: data.session.access_token, user_email: data.user?.email ?? '' })
      setStep('authorize')
    }
    setLoading(false)
  }

  async function handleAuthorize() {
    if (!session || !redirectUri) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/mcp-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase_access_token: session.access_token,
          redirect_uri: redirectUri,
          client_id: clientId,
          state,
          code_challenge: codeChallenge,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.redirect_url) {
        setError(data.error ?? '授权失败，请重试')
        setLoading(false)
        return
      }
      setStep('done')
      // Redirect back to Claude/ChatGPT
      window.location.href = data.redirect_url
    } catch {
      setError('网络错误，请重试')
      setLoading(false)
    }
  }

  function handleDeny() {
    if (redirectUri) {
      const url = new URL(redirectUri)
      url.searchParams.set('error', 'access_denied')
      if (state) url.searchParams.set('state', state)
      window.location.href = url.toString()
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-black flex items-center justify-center">
              <span className="text-white text-sm font-bold">O</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">ONIT</span>
          </Link>
          <p className="mt-2 text-sm text-gray-500">
            {step === 'login' ? '登录以连接 ONIT MCP' : '授权 MCP 访问'}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {step === 'login' && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                外部应用请求连接你的 ONIT Agent 团队。请先登录验证身份。
              </p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">邮箱</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">密码</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                {error && (
                  <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-xs text-red-600">{error}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? '登录中...' : '登录'}
                </button>
              </form>
            </>
          )}

          {step === 'authorize' && session && (
            <>
              <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">O</span>
                </div>
                <div>
                  <p className="text-sm font-medium">ONIT Agent 团队</p>
                  <p className="text-xs text-gray-500">{session.user_email}</p>
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-2">外部应用将获得以下权限：</p>
              <ul className="text-sm text-gray-600 space-y-1 mb-5 ml-2">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> 调用你的 ONIT Agent 团队
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> 使用你已连接的工具（Composio 等）
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-gray-400">✗</span> 无法修改你的账户设置
                </li>
              </ul>

              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md mb-4">
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleDeny}
                  disabled={loading}
                  className="flex-1 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  拒绝
                </button>
                <button
                  onClick={handleAuthorize}
                  disabled={loading}
                  className="flex-1 py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? '授权中...' : '授权'}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <p className="text-sm font-medium text-gray-900">授权成功</p>
              <p className="text-xs text-gray-500 mt-1">正在跳转回应用...</p>
            </div>
          )}
        </div>

        <p className="text-center mt-4 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600 transition-colors">
            ← 返回首页
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function McpAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-sm text-gray-500">加载中...</div>
      </div>
    }>
      <McpAuthContent />
    </Suspense>
  )
}
