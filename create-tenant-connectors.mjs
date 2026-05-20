const sql = `
CREATE TABLE IF NOT EXISTS public.tenant_connectors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, agent_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_connectors_tenant_id ON public.tenant_connectors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_connectors_status ON public.tenant_connectors(status);
`

const res = await fetch('https://api.supabase.com/v1/projects/bgzrcrftjkcfdszumywd/database/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

const data = await res.json()
console.log('status:', res.status)
console.log('result:', JSON.stringify(data, null, 2))
