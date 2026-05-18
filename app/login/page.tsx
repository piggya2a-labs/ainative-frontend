'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })
      if (error) {
        setError(error.message)
      } else {
        // 注册成功，直接跳转 onboarding 生成专属 Dashboard
        router.push('/onboarding')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message === 'Invalid login credentials' ? '邮箱或密码错误' : error.message)
      } else {
        router.push('/dashboard')
      }
    }

    setLoading(false)
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
            {mode === 'login' ? '登录你的账户' : '创建新账户'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {/* Tab 切换 */}
          <div className="flex border border-gray-200 rounded-md p-0.5 mb-6 bg-gray-50">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
              className={`flex-1 py-1.5 text-sm rounded transition-all ${
                mode === 'login'
                  ? 'bg-white text-black shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setSuccess(null) }}
              className={`flex-1 py-1.5 text-sm rounded transition-all ${
                mode === 'signup'
                  ? 'bg-white text-black shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                邮箱
              </label>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">
                密码
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder:text-gray-400"
              />
              {mode === 'signup' && (
                <p className="mt-1 text-xs text-gray-400">至少 6 位</p>
              )}
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                <p className="text-xs text-green-600">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </button>
          </form>
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
