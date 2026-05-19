import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const EF_BASE = `${SUPABASE_URL}/functions/v1`

export async function GET(req: NextRequest) {
  // 透传用户 token，让 EF 能拿到 tenant_id
  const authHeader = req.headers.get('Authorization') ?? `Bearer ${SUPABASE_ANON_KEY}`

  const res = await fetch(`${EF_BASE}/api-connector-list`, {
    headers: {
      'Authorization': authHeader,
      'apikey': SUPABASE_ANON_KEY,
    },
    cache: 'no-store',
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
