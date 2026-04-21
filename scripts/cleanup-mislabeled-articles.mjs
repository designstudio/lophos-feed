/**
 * Cleanup mislabeled articles from the feed.
 *
 * Default mode is dry-run. Use DELETE_CONFIRM=true to apply deletions.
 *
 * Examples:
 *   node scripts/cleanup-mislabeled-articles.mjs
 *   DELETE_CONFIRM=true node scripts/cleanup-mislabeled-articles.mjs
 *   DELETE_CONFIRM=true node scripts/cleanup-mislabeled-articles.mjs "Title 1" "Title 2"
 */

import { createClient } from '@supabase/supabase-js'
import { loadScriptEnvironment } from './script-env.mjs'

loadScriptEnvironment()

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const DEFAULT_TITLES = [
  'Windrose: Jogo de pirataria vende 1 milhão de cópias e atinge 222 mil jogadores simultâneos no Steam',
  'Windrose redefine padrões de qualidade em jogos de sobrevivência e crafting com gerenciamento de base e exploração integrados',
  "Bandai Namco anuncia 'Dragon Ball Xenoverse 3' com novo cenário e personagens originais de Akira Toriyama",
  'Call of Duty: Black Ops 7 Season 3 Reloaded é anunciado com novidades para Multiplayer, Zombies e Warzone',
  'Neverness to Everness apresenta sistema de gacha inovador com mecânica de tabuleiro e rolagem de dados',
]

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeLike(value) {
  return String(value || '').replace(/[%_]/g, '\\$&')
}

function parseCliTitles(argv) {
  return argv
    .map((arg) => String(arg || '').trim())
    .filter((arg) => arg && !arg.startsWith('DELETE_CONFIRM=') && !arg.startsWith('APPLY='))
}

async function fetchMatches(titles) {
  const normalizedNeedles = titles.map(normalizeText)

  const { data, error } = await db
    .from('articles')
    .select('id, title, topic, source_ids, cached_at, published_at')
    .order('cached_at', { ascending: false, nullsFirst: false })

  if (error) throw error

  const matches = (data || []).filter((article) => {
    const haystack = normalizeText(article.title)
    return normalizedNeedles.some((needle) => haystack === needle || haystack.includes(needle) || needle.includes(haystack))
  })

  return matches
}

async function deleteMatchingRows(table, matches) {
  const ids = matches.map((row) => row.id)
  if (ids.length === 0) return 0

  const { error } = await db.from(table).delete().in('id', ids)
  if (error) throw error

  return ids.length
}

async function resetSourceItems(matches) {
  const sourceIds = [...new Set(matches.flatMap((row) => Array.isArray(row.source_ids) ? row.source_ids : []).filter(Boolean))]
  if (sourceIds.length === 0) return 0

  const { error } = await db
    .from('raw_items')
    .update({ processed: false })
    .in('id', sourceIds)

  if (error) throw error

  return sourceIds.length
}

async function main() {
  const cliTitles = parseCliTitles(process.argv.slice(2))
  const titles = cliTitles.length > 0 ? cliTitles : DEFAULT_TITLES
  const shouldApply = process.env.DELETE_CONFIRM === 'true' || process.env.APPLY === 'true'

  console.log('\n🧹 Limpando artigos com tópico errado...\n')
  console.log(`Modo: ${shouldApply ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Títulos-alvo: ${titles.length}\n`)

  const matches = await fetchMatches(titles)

  if (matches.length === 0) {
    console.log('Nenhum artigo correspondente encontrado.')
    return
  }

  console.log(`Encontrados ${matches.length} artigos para limpeza:\n`)
  for (const article of matches) {
    console.log(`- ${article.id} | ${article.topic} | ${article.title}`)
  }

  const sourceIds = [...new Set(matches.flatMap((row) => Array.isArray(row.source_ids) ? row.source_ids : []).filter(Boolean))]
  console.log(`\nRaw items associados: ${sourceIds.length}`)

  if (!shouldApply) {
    console.log('\nDry-run apenas. Para aplicar, rode com DELETE_CONFIRM=true.')
    return
  }

  const deletedArticles = await deleteMatchingRows('articles', matches)
  const deletedCacheRows = await deleteMatchingRows('news_cache', matches)
  const resetRawItems = await resetSourceItems(matches)

  console.log('\n✅ Limpeza aplicada com sucesso.')
  console.log(`Artigos removidos: ${deletedArticles}`)
  console.log(`Cache removido: ${deletedCacheRows}`)
  console.log(`raw_items reabertos: ${resetRawItems}`)
}

main().catch((err) => {
  console.error('\n❌ Erro fatal na limpeza:', err?.message || err)
  process.exit(1)
})
