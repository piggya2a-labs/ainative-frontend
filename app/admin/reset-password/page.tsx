'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleReset() {
    if (!email || !newPassword) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword }),
      })
      const data = await res.json()

      if (res.ok) {
        setResult({ ok: true, message: `✓ ${data.email} 密码已重置为：${newPassword}` })
        setNewPassword('')
      } else {
        setResult({ ok: false, message: data.error || '重置失败' })
      }
    } catch {
      setResult({ ok: false, message: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-white">重置用户密码</CardTitle>
          <CardDescription className="text-zinc-400">
            内部工具 · 仅限管理员使用
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-zinc-300">邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@onit.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-zinc-300">新密码</Label>
            <Input
              id="password"
              type="text"
              placeholder="新密码（明文，方便复制）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              onKeyDown={(e) => e.key === 'Enter' && handleReset()}
            />
          </div>

          <Button
            onClick={handleReset}
            disabled={loading || !email || !newPassword}
            className="w-full"
          >
            {loading ? '重置中…' : '重置密码'}
          </Button>

          {result && (
            <p className={`text-sm rounded-md px-3 py-2 ${
              result.ok
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'bg-red-950 text-red-400 border border-red-800'
            }`}>
              {result.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
