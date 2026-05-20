import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email, newPassword } = await req.json()

  if (!email || !newPassword) {
    return NextResponse.json({ error: '邮箱和新密码不能为空' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // 先查 user id
  const listRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  )

  const listData = await listRes.json()
  const user = listData?.users?.[0]

  if (!user) {
    return NextResponse.json({ error: `找不到用户：${email}` }, { status: 404 })
  }

  // 重置密码
  const resetRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${user.id}`,
    {
      method: 'PUT',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: newPassword }),
    }
  )

  if (!resetRes.ok) {
    const err = await resetRes.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email, message: '密码已重置' })
}
