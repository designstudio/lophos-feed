import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { processRawBatch } from '@/lib/news'
import { randomUUID } from 'crypto'

export const maxDuration = 300

// String similarity using Levenshtein distance
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  if (longer.length === 0) return 1.0
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = []
  for (let k = 0; k <= s1.length; k++) costs[k] = k
  for (let i = 1; i <= s2.length; i++) {
    costs[0] = i
    let nw = i - 1
    for (let j = 1; j <= s1.length; j++) {
      const cj = Math.min(
        1 + Math.min(costs[j], costs[j - 1]),
        nw + (s1[j - 1] === s2[i - 1] ? 0 : 1)
      )
      nw = costs[j]
      costs[j] = cj
    }
  }
  return costs[s1.length]
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const ingestSecret = process.env.RSS_INGEST_SECRET

    if (!ingestSecret || !authHeader.includes(ingestSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`[process-raw-items] Starting synthesis of all unprocessed items`)

    const db = getSupabaseAdmin()

    // Fetch all unprocessed raw items
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100')
    const { data: rawItems, error: fetchError } = await db
      .from('raw_items')
      .select('url, title, content, image_url, video_url, topic')
      .eq('processed', false)
      .limit(limit)
      .order('pub_date', { ascending: false })

    if (fetchError) {
      console.error(`[process-raw-items] Fetch error:`, fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!rawItems || rawItems.length === 0) {
      console.log(`[process-raw-items] No unprocessed items found`)
      return NextResponse.json({
        status: 'complete',
        itemsProcessed: 0,
        newsGenerated: 0,
        newsSaved: 0,
        message: 'No unprocessed items found'
      })
    }

    console.log(`[process-raw-items] Found ${rawItems.length} unprocessed items`)

    // Convert to format expected by processRawBatch
    const sourceResults = rawItems.map(item => ({
      url: item.url,
      title: item.title,
      content: item.content || '',
      image: item.image_url,
      video: item.video_url
    }))

    // Determine primary topic for context (most common or first)
    const topicCounts: Record<string, number> = {}
    for (const item of rawItems) {
      topicCounts[item.topic || 'geral'] = (topicCounts[item.topic || 'geral'] || 0) + 1
    }
    const primaryTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0][0]

    console.log(`[process-raw-items] Primary topic: ${primaryTopic}`)

    // Process all items together through Gemini
    const newsItems = await processRawBatch(
      primaryTopic,
      sourceResults,
      [],
      (stats) => {
        console.log(`[process-raw-items] Gemini stats:`, stats)
      }
    )

    console.log(`[process-raw-items] Generated ${newsItems.length} news items`)

    // Get all existing articles for duplicate checking
    const { data: existingArticles } = await db
      .from('articles')
      .select('id, title, sources')

    let articlesCreated = 0
    let sourceAdded = 0

    // Save to articles with duplicate detection
    if (newsItems.length > 0) {
      for (const newsItem of newsItems) {
        // Skip if title is missing
        if (!newsItem.title) {
          console.warn(`[process-raw-items] Skipping item with missing title`)
          continue
        }

        // Find corresponding raw item for source info
        const rawItem = rawItems.find(r => r.title.toLowerCase() === newsItem.title.toLowerCase())
        if (!rawItem) continue

        const newSource = {
          name: rawItem.topic || 'RSS',
          url: rawItem.url || '',
          favicon: ''
        }

        // Check if similar article exists
        let similarArticle = null
        if (existingArticles) {
          for (const existing of existingArticles) {
            const similarity = stringSimilarity(
              newsItem.title.toLowerCase(),
              existing.title.toLowerCase()
            )
            if (similarity >= 0.7) {
              similarArticle = existing
              break
            }
          }
        }

        if (similarArticle) {
          // Article already exists - add source if not already there
          const existingSources = similarArticle.sources || []
          const sourceExists = existingSources.some((s: any) => s.url === newSource.url)

          if (!sourceExists) {
            const updatedSources = [...existingSources, newSource]
            await db
              .from('articles')
              .update({ sources: updatedSources })
              .eq('id', similarArticle.id)
            console.log(`[process-raw-items] Added source to existing article ${similarArticle.id}`)
            sourceAdded++
          }
        } else {
          // Create new article
          const { error: insertError } = await db
            .from('articles')
            .insert({
              id: newsItem.id,
              topic: newsItem.topic,
              title: newsItem.title,
              summary: newsItem.summary,
              sections: newsItem.sections,
              conclusion: newsItem.conclusion,
              sources: [newSource],
              image_url: newsItem.imageUrl,
              video_url: newsItem.videoUrl,
              published_at: newsItem.publishedAt,
              cached_at: newsItem.cachedAt,
              matched_topics: newsItem.matchedTopics ?? [newsItem.topic],
            })

          if (!insertError) {
            articlesCreated++
            console.log(`[process-raw-items] Created new article for ${newsItem.id}`)
          } else {
            console.error(`[process-raw-items] Insert error for ${newsItem.id}:`, insertError)
          }
        }
      }
    }

    // Mark items as processed
    const { error: updateError } = await db
      .from('raw_items')
      .update({ processed: true })
      .in('url', rawItems.map(r => r.url))

    if (updateError) {
      console.error(`[process-raw-items] Update error:`, updateError)
      // Don't fail, just log
    }

    console.log(`[process-raw-items] Complete. Processed: ${rawItems.length}, Generated: ${newsItems.length}, Created: ${articlesCreated}, Source Added: ${sourceAdded}`)

    return NextResponse.json({
      status: 'complete',
      itemsProcessed: rawItems.length,
      newsGenerated: newsItems.length,
      articlesCreated: articlesCreated,
      sourceAdded: sourceAdded,
      newsItems: newsItems.map(item => ({
        title: item.title,
        summary: item.summary,
        sections: item.sections,
        conclusion: item.conclusion,
        sources: item.sources,
        imageUrl: item.imageUrl
      }))
    })

  } catch (err: any) {
    console.error('[process-raw-items] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
