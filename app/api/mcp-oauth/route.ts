/**
 * /api/mcp-oauth
 * Called by the /mcp-auth page after user authenticates.
 * Generates a one-time auth code, stores it in mcp_oauth_codes,
 * then redirects back to the client's redirect_uri with the code.
 *
 * API key strategy: stored directly in tenants.api_key (single-key design).
 * If the tenant already has an api_key, reuse it. Otherwise generate a new one.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { supabase_access_token, redirect_uri, client_id, state } = body

    if (!supabase_access_token || !redirect_uri) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify the Supabase token and get the user
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: userError } = await userClient.auth.getUser(supabase_access_token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Get tenant and existing api_key
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, api_key')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Reuse existing api_key or generate a new one
    let apiKey: string = tenant.api_key ?? ''
    if (!apiKey || !apiKey.startsWith('onit_')) {
      apiKey = `onit_${generateRandomHex(32)}`
      await supabase
        .from('tenants')
        .update({ api_key: apiKey })
        .eq('id', tenant.id)
    }

    // Generate a one-time auth code
    const code = generateRandomHex(32)
    await supabase.from('mcp_oauth_codes').insert({
      code,
      api_key: apiKey,
      tenant_id: tenant.id,
      redirect_uri,
      client_id: client_id ?? null,
    })

    // Build redirect URL
    const redirectUrl = new URL(redirect_uri)
    redirectUrl.searchParams.set('code', code)
    if (state) redirectUrl.searchParams.set('state', state)

    return NextResponse.json({ redirect_url: redirectUrl.toString() })
  } catch (err) {
    console.error('mcp-oauth error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateRandomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}
