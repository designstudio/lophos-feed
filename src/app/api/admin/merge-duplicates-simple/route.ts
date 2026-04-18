import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300

interface DuplicatePair {
  id1: string
  id2: string
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const ingestSecret = process.env.RSS_INGEST_SECRET

    if (!ingestSecret || !authHeader.includes(ingestSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const duplicatePairs: DuplicatePair[] = body.duplicatePairs || []

    if (!Array.isArray(duplicatePairs) || duplicatePairs.length === 0) {
      return NextResponse.json({
        error: 'duplicatePairs must be a non-empty array',
        example: {
          duplicatePairs: [{ id1: 'uuid1', id2: 'uuid2' }]
        }
      }, { status: 400 })
    }

    console.log(`[merge-duplicates-simple] Starting merge of ${duplicatePairs.length} pairs`)

    const db = getSupabaseAdmin()
    let mergedCount = 0
    let deletedCount = 0
    const errors: string[] = []

    for (const pair of duplicatePairs) {
      try {
        const { id1, id2 } = pair

        // Fetch both articles
        const { data: articles, error: fetchError } = await db
          .from('articles')
          .select('*')
          .in('id', [id1, id2])

        if (fetchError || !articles || articles.length < 2) {
          errors.push(`Could not fetch articles for pair ${id1}/${id2}`)
          continue
        }

        // Keep the older article as canonical and add the newer one as source.
        const article1 = articles.find(a => a.id === id1)!
        const article2 = articles.find(a => a.id === id2)!

        const olderArticle = new Date(article1.published_at) <= new Date(article2.published_at) ? article1 : article2
        const newerArticle = olderArticle.id === article1.id ? article2 : article1

        console.log(`[merge-duplicates-simple] Merging ${olderArticle.id} (older) with ${newerArticle.id} (newer)`)

        // Combine sources
        const olderSources = olderArticle.sources || []
        const newerSources = newerArticle.sources || []

        // Remove duplicates by URL
        const uniqueSources = [
          ...olderSources,
          ...newerSources.filter((ns: any) => !olderSources.some((os: any) => os.url === ns.url))
        ]

        // Update older article with combined sources
        const { error: updateError } = await db
          .from('articles')
          .update({ sources: uniqueSources })
          .eq('id', olderArticle.id)

        if (updateError) {
          errors.push(`Could not update article ${olderArticle.id}: ${updateError.message}`)
          continue
        }

        // Delete newer article
        const { error: deleteError } = await db
          .from('articles')
          .delete()
          .eq('id', newerArticle.id)

        if (deleteError) {
          errors.push(`Could not delete article ${newerArticle.id}: ${deleteError.message}`)
          continue
        }

        mergedCount++
        deletedCount++

        console.log(`[merge-duplicates-simple] Successfully merged pair: ${olderArticle.id} + ${newerArticle.id}`)
      } catch (err: any) {
        errors.push(`Error processing pair: ${err.message}`)
      }
    }

    console.log(`[merge-duplicates-simple] Completed: ${mergedCount} merged, ${deletedCount} deleted`)

    return NextResponse.json({
      status: 'complete',
      pairsProcessed: duplicatePairs.length,
      articlesMerged: mergedCount,
      articlesDeleted: deletedCount,
      errors: errors.length > 0 ? errors : [],
      message: `Successfully merged ${mergedCount} pairs and deleted ${deletedCount} duplicate articles`
    })
  } catch (err: any) {
    console.error(`[merge-duplicates-simple] Unexpected error:`, err)
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}
