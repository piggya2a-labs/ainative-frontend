/**
 * /api/mcp-oauth
 * Called by the /mcp-auth page after user authenticates.
 * Generates a one-time auth code, stores it in mcp_oauth_codes,
 * then redirects back to the client's redirect_uri with the code.
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
    const { supabase_access_token, redirect_uri, client_id, state, code_challenge } = body

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

    // Get tenant_id from tenants table
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Get or create an API key for this tenant
    const { data: existingKeys } = await supabase
      .from('tenant_api_keys')
      .select('key_prefix, id')
      .eq('tenant_id', tenant.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)

    let apiKey: string

    if (existingKeys && existingKeys.length > 0) {
      // We can't recover the raw key from the hash, so we need to create a new one
      // for OAuth flow. Generate a fresh key.
      apiKey = `onit_${generateRandomHex(32)}`
      const keyHash = await sha256hex(apiKey)
      const keyPrefix = apiKey.slice(0, 12)
      await supabase.from('tenant_api_keys').insert({
        tenant_id: tenant.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name: `MCP OAuth (${new Date().toISOString().slice(0, 10)})`,
      })
    } else {
      apiKey = `onit_${generateRandomHex(32)}`
      const keyHash = await sha256hex(apiKey)
      const keyPrefix = apiKey.slice(0, 12)
      await supabase.from('tenant_api_keys').insert({
        tenant_id: tenant.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name: 'MCP OAuth',
      })
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

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
