import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/zapier/save-mcp-url
// Called by the frontend after the Zapier Embed fires the mcp-server-url event.
// Stores the user-specific Zapier MCP Server URL in tenants.zapier_mcp_url.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  const userToken = authHeader?.replace('Bearer ', '')
  if (!userToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the user token and get user_id
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await userClient.auth.getUser(userToken)
  if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const body = await req.json()
  const { zapier_mcp_url } = body as { zapier_mcp_url?: string }

  if (!zapier_mcp_url || !zapier_mcp_url.startsWith('https://')) {
    return NextResponse.json({ error: 'Invalid zapier_mcp_url' }, { status: 400 })
  }

  // Find the tenant for this user
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (tenantError || !tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Save the Zapier MCP URL
  const { error: updateError } = await supabase
    .from('tenants')
    .update({ zapier_mcp_url })
    .eq('id', tenant.id)

  if (updateError) {
    console.error('[zapier/save-mcp-url] update error:', updateError)
    return NextResponse.json({ error: 'Failed to save URL' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
