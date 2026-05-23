'use client'
/**
 * /oauth/consent — ONIT MCP OAuth 2.1 授权页
 *
 * 当 Claude/ChatGPT 连接 ONIT MCP 时，Supabase Auth 会把用户重定向到这里。
 * URL 参数：?authorization_id=xxx
 *
 * 流程：
 *   1. 用 authorization_id 拿到授权详情（客户端名称、请求的 scope）
 *   2. 如果未登录，跳转到登录页（保留 authorization_id）
 *   3. 用户点"授权"或"拒绝"
 *   4. Supabase Auth 自动处理 code 生成和 token 交换
 */
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'

function ConsentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const authorizationId = searchParams.get('authorization_id') ?? ''

  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authDetails, setAuthDetails] = useState<{
    client: { name: string; description?: string }
    scope?: string
    redirect_uri?: string
  } | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!authorizationId) {
      setError('缺少 authorization_id 参数')
      setLoading(false)
      return
    }

    const supabase = createClient()

    async function init() {
      // 检查是否已登录
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // 未登录，跳转到登录页，保留 authorization_id
        router.push(`/login?redirect=/auth/v1/oauth/authorize?authorization_id=${authorizationId}`)
        return
      }
      setUserEmail(user.email ?? null)

      // 拿授权详情
      const { data, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
      if (detailsError || !data) {
        setError(detailsError?.message ?? '授权请求无效或已过期')
        setLoading(false)
        return
      }

      // 如果用户之前已经同意过，直接跳转
      if (!('authorization_id' in data)) {
        window.location.href = (data as { redirect_url: string }).redirect_url
        return
      }

      setAuthDetails({
        client: data.client as { name: string; description?: string },
        scope: data.scope,
        redirect_uri: data.redirect_uri,
      })
      setLoading(false)
    }

    init()
  }, [authorizationId, router])

  async function handleApprove() {
    if (!authorizationId) return
    setActing(true)
    setError(null)
    const supabase = createClient()
    const { data, error: approveError } = await supabase.auth.oauth.approveAuthorization(authorizationId)
    if (approveError) {
      setError(approveError.message)
      setActing(false)
      return
    }
    window.location.href = data.redirect_url
  }

  async function handleDeny() {
    if (!authorizationId) return
    setActing(true)
    const supabase = createClient()
    const { data } = await supabase.auth.oauth.denyAuthorization(authorizationId)
    if (data?.redirect_url) {
      window.location.href = data.redirect_url
    } else {
      router.push('/dashboard')
    }
  }

  // 解析 scope 列表，映射成人看的权限描述
  const scopeLabels: Record<string, string> = {
    openid: '验证你的身份',
    email: '读取你的邮箱地址',
    profile: '读取你的基本信息',
    mcp: '调用你的 ONIT Agent 团队',
  }

  const scopes = authDetails?.scope?.trim()
    ? authDetails.scope.split(' ').filter(Boolean)
    : ['mcp']

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
          <p className="mt-2 text-sm text-gray-500">授权 MCP 访问</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {loading && (
            <div className="text-center py-8">
              <div className="text-sm text-gray-500">加载中...</div>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-red-500 text-xl">✕</span>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">授权失败</p>
              <p className="text-xs text-gray-500">{error}</p>
              <Link href="/dashboard" className="mt-4 inline-block text-xs text-gray-400 hover:text-gray-600">
                返回 Dashboard
              </Link>
            </div>
          )}

          {!loading && !error && authDetails && (
            <>
              {/* 客户端信息 */}
              <div className="flex items-center gap-3 mb-5 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">
                    {authDetails.client.name?.charAt(0)?.toUpperCase() ?? 'A'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{authDetails.client.name}</p>
                  {authDetails.client.description && (
                    <p className="text-xs text-gray-500">{authDetails.client.description}</p>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-1">
                <span className="font-medium">{authDetails.client.name}</span> 请求访问你的 ONIT 账号
              </p>
              {userEmail && (
                <p className="text-xs text-gray-400 mb-4">{userEmail}</p>
              )}

              {/* 权限列表 */}
              <div className="mb-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">将获得以下权限</p>
                <ul className="space-y-2">
                  {scopes.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                      <span>{scopeLabels[s] ?? s}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-sm text-gray-400">
                    <span className="mt-0.5 flex-shrink-0">✗</span>
                    <span>无法修改你的账户设置</span>
                  </li>
                </ul>
              </div>

              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md mb-4">
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleDeny}
                  disabled={acting}
                  className="flex-1 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  拒绝
                </button>
                <button
                  onClick={handleApprove}
                  disabled={acting}
                  className="flex-1 py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {acting ? '处理中...' : '授权'}
                </button>
              </div>
            </>
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

export default function OAuthConsentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-sm text-gray-500">加载中...</div>
      </div>
    }>
      <ConsentContent />
    </Suspense>
  )
}
