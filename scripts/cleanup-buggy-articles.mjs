/**
 * 🗑️ Cleanup: Delete buggy articles (same image + source reuse)
 *
 * Deleta artigos gerados com o bug de escopo de variáveis
 * onde todos tinham mesma imagem e fonte (Dread Central)
 */

import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function cleanupBuggyArticles() {
  console.log('🗑️  Procurando artigos com bug (mesma imagem reutilizada)...\n')

  // Buscar artigos recentes agrupados por imagem
  const { data: articles, error } = await db
    .from('articles')
    .select('id, title, image_url, sources, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
  }

  // Detectar imagens reutilizadas
  const imageCount = new Map()
  const articlesByImage = new Map()

  for (const article of articles || []) {
    const img = article.image_url
    if (!imageCount.has(img)) {
      imageCount.set(img, 0)
      articlesByImage.set(img, [])
    }
    imageCount.set(img, imageCount.get(img) + 1)
    articlesByImage.get(img).push(article)
  }

  // Encontrar imagens reutilizadas (bug indicator)
  const buggyArticleIds = []
  for (const [img, count] of imageCount.entries()) {
    if (count > 1 && !img.includes('placeholder')) {
      console.log(`⚠️  Imagem reutilizada ${count}x: ${img.substring(0, 50)}...`)
      const articlesWithImage = articlesByImage.get(img)
      articlesWithImage.forEach(a => {
        console.log(`   - ${a.id}: "${a.title.slice(0, 50)}"`)
        buggyArticleIds.push(a.id)
      })
      console.log('')
    }
  }

  if (buggyArticleIds.length === 0) {
    console.log('✅ Nenhum artigo com bug detectado (imagens reutilizadas).')
    console.log('\n💡 Dica: Se souber quais artigos deletar, use:')
    console.log('   node scripts/cleanup-buggy-articles.mjs <id1> <id2> <id3>\n')
    return
  }

  console.log(`\n🗑️  Encontrados ${buggyArticleIds.length} artigos com bug`)
  console.log(`IDs: ${buggyArticleIds.join(', ')}\n`)

  // Confirmar antes de deletar
  console.log('⚠️  Pronto para DELETAR? (se sim, rode com: DELETE_CONFIRM=true)\n')
  console.log('Comando:')
  console.log(`   DELETE_CONFIRM=true node scripts/cleanup-buggy-articles.mjs\n`)

  if (process.env.DELETE_CONFIRM !== 'true') {
    console.log('🟡 Dry run apenas. Para deletar realmente, use DELETE_CONFIRM=true')
    return
  }

  // Deletar
  const { error: deleteError } = await db
    .from('articles')
    .delete()
    .in('id', buggyArticleIds)

  if (deleteError) {
    console.error(`❌ Erro ao deletar: ${deleteError.message}`)
    process.exit(1)
  }

  console.log(`✅ ${buggyArticleIds.length} artigos deletados!\n`)
  console.log('Próximo passo: node scripts/process-news.mjs (com fix de escopo)')
}

// Suportar IDs via CLI
const cliIds = process.argv.slice(2).filter(arg => !arg.startsWith('DELETE_CONFIRM'))

if (cliIds.length > 0) {
  // Modo: deletar IDs específicos
  ;(async () => {
    console.log(`🗑️  Deletando ${cliIds.length} artigos específicos...\n`)
    cliIds.forEach(id => console.log(`   - ${id}`))

    if (process.env.DELETE_CONFIRM !== 'true') {
      console.log('\n⚠️  Para confirmar delete:')
      console.log(`   DELETE_CONFIRM=true node scripts/cleanup-buggy-articles.mjs ${cliIds.join(' ')}\n`)
      process.exit(0)
    }

    const { error } = await db
      .from('articles')
      .delete()
      .in('id', cliIds)

    if (error) {
      console.error(`❌ Erro: ${error.message}`)
      process.exit(1)
    }

    console.log(`✅ ${cliIds.length} artigos deletados!\n`)
  })().catch(console.error).finally(() => process.exit(0))
} else {
  // Modo: auto-detectar
  cleanupBuggyArticles().catch(console.error).finally(() => process.exit(0))
}
