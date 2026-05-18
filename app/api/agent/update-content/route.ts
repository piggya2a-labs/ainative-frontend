import { NextRequest, NextResponse } from 'next/server'
import { writeClient } from '@/lib/sanity'

// Agent 调用此接口更新前端内容
// POST /api/agent/update-content
// Body: { type: 'heroContent' | 'featureCard' | 'agentTool' | 'siteConfig', data: {...}, agentId: string }

export async function POST(req: NextRequest) {
  // 验证 Agent 身份
  const authHeader = req.headers.get('authorization')
  const expectedToken = process.env.AGENT_API_SECRET

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { type, data, agentId, operation = 'createOrReplace' } = body

    if (!type || !data) {
      return NextResponse.json({ error: 'Missing type or data' }, { status: 400 })
    }

    const allowedTypes = ['heroContent', 'featureCard', 'agentTool', 'siteConfig']
    if (!allowedTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })
    }

    // 写入 Sanity
    let result
    if (operation === 'createOrReplace' && data._id) {
      result = await writeClient.createOrReplace({
        ...data,
        _type: type,
        _agentId: agentId,
        _updatedAt: new Date().toISOString(),
      })
    } else {
      result = await writeClient.create({
        ...data,
        _type: type,
        _agentId: agentId,
        _updatedAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      id: result._id,
      type,
      agentId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Agent content update error:', error)
    return NextResponse.json(
      { error: 'Failed to update content', details: String(error) },
      { status: 500 }
    )
  }
}

// GET /api/agent/update-content - 健康检查
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoints: {
      'POST /api/agent/update-content': 'Update Sanity content',
    },
    supportedTypes: ['heroContent', 'featureCard', 'agentTool', 'siteConfig'],
  })
}
