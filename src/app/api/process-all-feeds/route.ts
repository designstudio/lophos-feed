import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { processRawBatch, findDuplicateTitle } from '@/lib/news'
import { randomUUID } from 'crypto'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const ingestSecret = process.env.RSS_INGEST_SECRET

    if (!ingestSecret || !authHeader.includes(ingestSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`[process-all-feeds] Starting feed processing for all topics`)

    const db = getSupabaseAdmin()

    // Get all unique topics
    const { data: topicRows, error: topicError } = await db
      .from('raw_items')
      .select('topic')
      .not('topic', 'is', null)

    if (topicError) {
      console.error(`[process-all-feeds] Error fetching topics:`, topicError)
      return NextResponse.json({ error: topicError.message }, { status: 500 })
    }

    const uniqueTopics = Array.from(new Set((topicRows || []).map((r: any) => r.topic).filter(Boolean)))
    console.log(`[process-all-feeds] Found ${uniqueTopics.length} unique topics:`, uniqueTopics)

    let totalProcessed = 0
    let totalGenerated = 0
    let totalSaved = 0
    const results: any[] = []

    for (const topic of uniqueTopics) {
      try {
        console.log(`[process-all-feeds] Processing topic: ${topic}`)

        // Fetch raw items for this topic
        const { data: rawItems, error: fetchError } = await db
          .from('raw_items')
          .select('url, title, content, image_url')
          .eq('topic', topic)
          .limit(20)
          .order('pub_date', { ascending: false })

        if (fetchError) {
          console.error(`[process-all-feeds] Fetch error for ${topic}:`, fetchError)
          results.push({ topic, status: 'error', error: fetchError.message })
          continue
        }

        if (!rawItems || rawItems.length === 0) {
          console.log(`[process-all-feeds] No raw items for ${topic}`)
          results.push({ topic, status: 'skipped', reason: 'no_items' })
          continue
        }

        totalProcessed += rawItems.length

        // Fetch existing articles for this topic (to detect duplicates)
        const { data: existingArticles, error: existingError } = await db
          .from('articles')
          .select('id, title')
          .eq('topic', topic)
          .order('published_at', { ascending: false })
          .limit(50)

        if (existingError) {
          console.warn(`[process-all-feeds] Could not fetch existing articles for ${topic}:`, existingError)
        }

        const existingTitles = (existingArticles || []).map(a => a.title)

        // Convert to format expected by processRawBatch
        const sourceResults = rawItems.map(item => ({
          url: item.url,
          title: item.title,
          content: item.content || '',
          image: item.image_url
        }))

        // Process through Gemini
        const newsItems = await processRawBatch(
          topic,
          sourceResults,
          existingTitles,
          (stats) => {
            console.log(`[process-all-feeds] Gemini stats for ${topic}:`, stats)
          }
        )

        totalGenerated += newsItems.length

        // Save to articles with duplicate detection and merge
        if (newsItems.length > 0) {
          let itemsToInsert = []
          let duplicateMerges = 0

          for (const newsItem of newsItems) {
            // Check if this is a duplicate of an existing article
            const duplicate = findDuplicateTitle(newsItem.title, existingArticles || [])

            if (duplicate && duplicate.id) {
              // Merge: add sources to existing article
              const { data: existingArticle } = await db
                .from('articles')
                .select('sources')
                .eq('id', duplicate.id)
                .single()

              if (existingArticle) {
                const existingSources = existingArticle.sources || []
                const mergedSources = [
                  ...existingSources,
                  ...newsItem.sources.filter((ns: any) =>
                    !existingSources.some((es: any) => es.url === ns.url)
                  )
                ]

                const { error: mergeError } = await db
                  .from('articles')
                  .update({ sources: mergedSources })
                  .eq('id', duplicate.id)

                if (!mergeError) {
                  duplicateMerges++
                  console.log(`[process-all-feeds] Merged sources for existing article ${duplicate.id} (similarity: ${(duplicate.score * 100).toFixed(0)}%)`)
                }
              }
            } else {
              // New article
              itemsToInsert.push({
                id: newsItem.id,
                topic: newsItem.topic,
                title: newsItem.title,
                summary: newsItem.summary,
                sections: newsItem.sections,
                conclusion: newsItem.conclusion,
                sources: newsItem.sources,
                image_url: newsItem.imageUrl,
                published_at: newsItem.publishedAt,
                cached_at: newsItem.cachedAt,
              })
            }
          }

          // Insert new articles
          if (itemsToInsert.length > 0) {
            const { error: saveError } = await db
              .from('articles')
              .upsert(itemsToInsert, { onConflict: 'id' })

            if (saveError) {
              console.error(`[process-all-feeds] Save error for ${topic}:`, saveError)
              results.push({ topic, status: 'error', error: saveError.message, generated: newsItems.length, merged: duplicateMerges })
            } else {
              totalSaved += itemsToInsert.length
              results.push({
                topic,
                status: 'success',
                itemsProcessed: rawItems.length,
                itemsGenerated: newsItems.length,
                itemsSaved: itemsToInsert.length,
                merged: duplicateMerges
              })
            }
          } else if (duplicateMerges > 0) {
            results.push({
              topic,
              status: 'success',
              itemsProcessed: rawItems.length,
              itemsGenerated: newsItems.length,
              itemsSaved: 0,
              merged: duplicateMerges
            })
          }
        } else {
          results.push({ topic, status: 'no_output', itemsProcessed: rawItems.length })
        }

      } catch (err: any) {
        console.error(`[process-all-feeds] Error processing ${topic}:`, err.message)
        results.push({ topic, status: 'error', error: err.message })
      }
    }

    console.log(`[process-all-feeds] Complete. Processed: ${totalProcessed}, Generated: ${totalGenerated}, Saved: ${totalSaved}`)

    return NextResponse.json({
      status: 'complete',
      topicsProcessed: uniqueTopics.length,
      itemsProcessed: totalProcessed,
      newsGenerated: totalGenerated,
      newsSaved: totalSaved,
      results
    })

  } catch (err: any) {
    console.error('[process-all-feeds] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
