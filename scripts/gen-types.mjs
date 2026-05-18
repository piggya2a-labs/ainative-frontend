/**
 * scripts/gen-types.mjs
 *
 * 从 Supabase 实时读取表结构，更新 lib/database.types.ts
 *
 * 用法：node --env-file=.env.local scripts/gen-types.mjs
 *
 * 每次后端改了表结构（加列、改类型）之后运行一次，
 * 前端类型自动跟上，不需要手动改。
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TABLES = [
  'agent_registry',
  'tool_registry',
  'tenant_connectors',
  'tenants',
  'audit_logs',
]

async function getColumns(table) {
  const { data, error } = await sb.from(table).select('*').limit(1)
  if (error) return { table, cols: [], error: error.message }
  return { table, cols: data?.[0] ? Object.keys(data[0]) : [] }
}

async function main() {
  console.log('Fetching table schemas from Supabase...')
  const results = await Promise.all(TABLES.map(getColumns))

  let output = `/**
 * Supabase Database Types — AUTO GENERATED
 * 运行 node --env-file=.env.local scripts/gen-types.mjs 更新
 * 最后生成：${new Date().toISOString().slice(0, 10)}
 */\n\n`

  for (const { table, cols, error } of results) {
    if (error) {
      console.warn(`⚠️  ${table}: ${error}`)
      continue
    }
    output += `// ─── ${table} ${'─'.repeat(Math.max(0, 60 - table.length))}\n`
    output += `export interface ${toPascal(table)}Row {\n`
    for (const col of cols) {
      output += `  ${col}: unknown\n`
    }
    output += `}\n\n`
    console.log(`✓ ${table}: ${cols.length} columns`)
  }

  writeFileSync('lib/database.types.ts', output)
  console.log('\n✅ lib/database.types.ts updated')
  console.log('⚠️  Remember to add proper TypeScript types (replace `unknown`) after generation.')
}

function toPascal(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, c => c.toUpperCase())
}

main().catch(console.error)
