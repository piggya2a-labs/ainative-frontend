'use client'
/**
 * /marketplace/callback
 *
 * OAuth 授权完成后，Supabase Edge Function (api-connector-callback) 会把浏览器
 * 重定向到这里：
 *   /marketplace/callback?status=connected&agent_id=xxx&name=yyy
 *   /marketplace/callback?status=error&reason=zzz
 *
 * 这个页面读取 query params，展示结果，然后自动跳回 /marketplace。
 */
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

function CallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const status = searchParams.get('status')
  const agentName = searchParams.get('name')
  const reason = searchParams.get('reason')
  const [countdown, setCountdown] = useState(3)

  const isSuccess = status === 'connected'

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          router.replace('/marketplace')
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [router])

  return (
    <div className="text-center max-w-sm px-6">
      {isSuccess ? (
        <>
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-[var(--onit-green)]/10 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[var(--onit-green)]" />
            </div>
          </div>
          <h1 className="text-lg font-semibold mb-1">连接成功</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {agentName ? <><span className="font-medium text-foreground">{agentName}</span> 已连接到你的工作区</> : '已成功连接'}
          </p>
        </>
      ) : (
        <>
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-7 h-7 text-destructive" />
            </div>
          </div>
          <h1 className="text-lg font-semibold mb-1">连接失败</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {reason ? `原因：${reason}` : '授权过程中出现问题，请重试'}
          </p>
        </>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-4">
        <Loader2 className="w-3 h-3 animate-spin" />
        {countdown} 秒后自动返回 Marketplace
      </div>

      <Button variant="outline" size="sm" onClick={() => router.replace('/marketplace')}>
        立即返回
      </Button>
    </div>
  )
}

export default function MarketplaceCallbackPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Suspense fallback={
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      }>
        <CallbackContent />
      </Suspense>
    </div>
  )
}
