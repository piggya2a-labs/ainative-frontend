'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

const TEAM_SIZES = ['就我一个人', '2-5 人', '6-20 人', '20 人以上']

const INDUSTRY_SUGGESTIONS = [
  '内容创作 / 媒体',
  '电商 / 零售',
  '软件开发',
  '市场营销',
  '数据分析',
  '客户服务',
  '教育 / 培训',
  '金融 / 投资',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [jtbd, setJtbd] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [industry, setIndustry] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!jtbd.trim()) return
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/generate-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jtbd, team_size: teamSize, industry }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Generation failed')
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-4">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-foreground flex items-center justify-center">
              <span className="text-background text-sm font-bold">O</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">ONIT</span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">告诉我们你想做什么，我们来帮你搭好</p>
        </div>

        {/* Progress */}
        <Progress value={(step / 3) * 100} className="h-1" />

        <Card>
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="text-sm">你想用 Agent 团队做什么？</CardTitle>
                <CardDescription>
                  用自己的话描述就好，越具体越好。比如"帮我每天抓取竞品动态并生成报告"。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={jtbd}
                  onChange={(e) => setJtbd(e.target.value)}
                  placeholder="我想用 Agent 团队来..."
                  rows={4}
                  className="resize-none"
                />
                <Button
                  onClick={() => setStep(2)}
                  disabled={!jtbd.trim()}
                  className="w-full"
                >
                  继续 →
                </Button>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="text-sm">你的团队规模？</CardTitle>
                <CardDescription>帮助我们推荐合适的 Agent 配置。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {TEAM_SIZES.map((size) => (
                    <Button
                      key={size}
                      variant={teamSize === size ? 'default' : 'outline'}
                      onClick={() => setTeamSize(size)}
                      className="h-10"
                    >
                      {size}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    ← 返回
                  </Button>
                  <Button onClick={() => setStep(3)} className="flex-1">
                    继续 →
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle className="text-sm">你的行业 / 领域？</CardTitle>
                <CardDescription>选一个或直接输入。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {INDUSTRY_SUGGESTIONS.map((ind) => (
                    <Badge
                      key={ind}
                      variant={industry === ind ? 'default' : 'outline'}
                      className="cursor-pointer text-xs py-1 px-2"
                      onClick={() => setIndustry(ind)}
                    >
                      {ind}
                    </Badge>
                  ))}
                </div>
                <Input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="或者直接输入..."
                />

                {error && (
                  <p className="text-xs text-destructive">{error}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    disabled={generating}
                    className="flex-1"
                  >
                    ← 返回
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex-1"
                  >
                    {generating ? '正在生成...' : '生成我的 Dashboard ✦'}
                  </Button>
                </div>

                {generating && (
                  <p className="text-xs text-center text-muted-foreground animate-pulse">
                    AI 正在根据你的需求定制专属工作区，通常需要 5-10 秒...
                  </p>
                )}
              </CardContent>
            </>
          )}
        </Card>

        {/* 当前填写内容预览 */}
        {step > 1 && jtbd && (
          <Card className="py-2">
            <CardContent className="pt-0 pb-2 px-4">
              <p className="text-xs text-muted-foreground">你的目标：</p>
              <p className="text-xs mt-0.5 line-clamp-2">{jtbd}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
