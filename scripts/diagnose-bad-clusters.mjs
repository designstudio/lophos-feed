/**
 * Diagnóstico: Identifica artigos com agrupamentos incorretos
 * Encontra Mario + Cape Fear + Fall 2 ou outros mishmashes
 */

import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function findBadClusters() {
  console.log('🔍 Procurando agrupamentos incorretos...\n')

  // Buscar artigos criados recentemente com source_ids
  const { data: articles, error } = await db
    .from('articles')
    .select('id, title, source_ids, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) { console.error('❌ Erro:', error.message); return }

  const badClusters = []

  for (const article of articles || []) {
    const title = article.title?.toLowerCase() || ''
    const sourceIds = article.source_ids || []

    // Detectar mishmashes: título contém múltiplos universos
    const hasMario = title.includes('mario') || title.includes('nintendo')
    const hasCapeFear = title.includes('cape fear') || title.includes('horror')
    const hasFall = title.includes('fall') || title.includes('filme') && title.includes('mistério')

    // Se o título sugere múltiplos universos, flag como problema
    const distinctSubjects = [hasMario, hasCapeFear, hasFall].filter(Boolean).length

    if (distinctSubjects > 1) {
      console.log(`\n⚠️  PROBLEMA DETECTADO:`)
      console.log(`   Título: "${article.title}"`)
      console.log(`   Data: ${article.created_at}`)
      console.log(`   source_ids (UUIDs para resetar): ${JSON.stringify(sourceIds)}`)
      badClusters.push({
        articleId: article.id,
        title: article.title,
        sourceIds: sourceIds,
        createdAt: article.created_at
      })
    }
  }

  if (badClusters.length === 0) {
    console.log('✅ Nenhum agrupamento incorreto detectado nos últimos 100 artigos.')
    return
  }

  console.log(`\n\n📊 RESUMO: ${badClusters.length} artigos com possíveis mishmashes\n`)

  // Gerar script SQL para reset
  console.log('🔧 Script para RESETAR esses UUIDs (execute com cuidado):\n')
  console.log(`-- RESET bad clusters`)

  const allSourceIds = badClusters.flatMap(c => c.sourceIds).filter(Boolean)
  if (allSourceIds.length > 0) {
    console.log(`UPDATE raw_items SET processed = false WHERE id = ANY('{"${allSourceIds.join('","')}"}');`)
    console.log(`\n-- Artigos afetados:`)
    badClusters.forEach(c => {
      console.log(`-- ${c.articleId}: ${c.title}`)
    })
  }

  console.log('\n⚠️  ANTES de executar o reset, verifique se esses artigos realmente são mishmashes.')
}

findBadClusters().catch(console.error).finally(() => process.exit(0))
