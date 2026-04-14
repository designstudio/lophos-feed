/**
 * Reset UUIDs Queimados: Marca raw_items como NOT processed
 *
 * USO:
 * node scripts/reset-burned-ids.mjs <uuid1> <uuid2> <uuid3> ...
 *
 * Exemplo:
 * node scripts/reset-burned-ids.mjs e4462cf9-1234-5678-90ab-cdef12345678 f5573dga-2345-6789-01bc-def123456789
 */

import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function resetBurnedIds() {
  const uuidsToReset = process.argv.slice(2)

  if (uuidsToReset.length === 0) {
    console.log('❌ Erro: Forneça pelo menos um UUID.\n')
    console.log('Uso: node scripts/reset-burned-ids.mjs <uuid1> <uuid2> ...\n')
    console.log('Exemplo:')
    console.log('  node scripts/reset-burned-ids.mjs e4462cf9-1234-5678-90ab-cdef12345678\n')
    process.exit(1)
  }

  console.log(`🔄 Resetando ${uuidsToReset.length} raw_items para processed=false...\n`)

  const { data, error } = await db
    .from('raw_items')
    .update({ processed: false })
    .in('id', uuidsToReset)
    .select('id, title')

  if (error) {
    console.error(`❌ Erro: ${error.message}`)
    process.exit(1)
  }

  console.log(`✅ ${data?.length || 0} items resetados:\n`)
  data?.forEach(item => {
    console.log(`   ✓ ${item.id} - ${item.title?.slice(0, 50)}`)
  })

  console.log(`\n✅ Esses items podem ser reprocessados na próxima execução.`)
  console.log(`   Execute: npm run news:process\n`)
}

resetBurnedIds().catch(console.error).finally(() => process.exit(0))
