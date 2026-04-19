/**
 * Cleanup script: Remove articles processed today and reset raw_items
 * Run: node scripts/cleanup-today.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { loadScriptEnvironment } from './script-env.mjs'

loadScriptEnvironment()

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function cleanup() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  console.log(`\n🧹 Limpando dados processados a partir de ${todayISO}...\n`)

  // 1. Delete articles created today
  console.log('1️⃣  Deletando artigos de hoje...')
  const { data: articlesToDelete, error: fetchError } = await db
    .from('articles')
    .select('id, title')
    .gte('published_at', todayISO)

  if (fetchError) {
    console.error('❌ Erro ao buscar artigos:', fetchError.message)
    return
  }

  if (articlesToDelete?.length) {
    const { error: deleteError } = await db
      .from('articles')
      .delete()
      .gte('published_at', todayISO)

    if (deleteError) {
      console.error('❌ Erro ao deletar artigos:', deleteError.message)
      return
    }

    console.log(`   ✅ ${articlesToDelete.length} artigos deletados:`)
    articlesToDelete.forEach(a => console.log(`      - ${a.title}`))
  } else {
    console.log('   ℹ️  Nenhum artigo encontrado para hoje')
  }

  // 2. Reset raw_items fetched today
  console.log('\n2️⃣  Resetando raw_items processados de hoje...')
  const { data: rawItemsToReset, error: fetchRawError } = await db
    .from('raw_items')
    .select('id, topic, title')
    .eq('processed', true)
    .gte('fetched_at', todayISO)

  if (fetchRawError) {
    console.error('❌ Erro ao buscar raw_items:', fetchRawError.message)
    return
  }

  if (rawItemsToReset?.length) {
    const { error: updateError } = await db
      .from('raw_items')
      .update({ processed: false })
      .eq('processed', true)
      .gte('fetched_at', todayISO)

    if (updateError) {
      console.error('❌ Erro ao resetar raw_items:', updateError.message)
      return
    }

    console.log(`   ✅ ${rawItemsToReset.length} raw_items resetados:`)
    const byTopic = {}
    rawItemsToReset.forEach(item => {
      byTopic[item.topic] = (byTopic[item.topic] || 0) + 1
    })
    Object.entries(byTopic).forEach(([topic, count]) => {
      console.log(`      - ${topic}: ${count} items`)
    })
  } else {
    console.log('   ℹ️  Nenhum raw_item encontrado para resetar')
  }

  console.log('\n✨ Cleanup completo! Pronto para rodar novamente.\n')
}

cleanup().catch(err => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
