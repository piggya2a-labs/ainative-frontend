import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

// Sanity webhook 调用此接口，立即刷新所有页面缓存
export async function POST(request: Request) {
  const secret = request.headers.get('x-revalidate-secret')
  if (secret !== process.env.AGENT_API_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  revalidatePath('/', 'layout')
  return NextResponse.json({ revalidated: true, ts: Date.now() })
}

// GET 手动触发（需要 x-revalidate-secret 鉴权）
export async function GET(request: Request) {
  const secret = request.headers.get('x-revalidate-secret')
  if (secret !== process.env.AGENT_API_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  revalidatePath('/', 'layout')
  return NextResponse.json({ revalidated: true, ts: Date.now() })
}
