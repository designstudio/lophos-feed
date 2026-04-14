import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'
import { buildFaviconUrl } from '@/lib/news-preprocessing'

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

    console.log(`[convert-raw-to-articles] Starting conversion of unprocessed raw items`)

    const db = getSupabaseAdmin()

    // Get unprocessed raw items
    const { data: rawItems, error: fetchError } = await db
      .from('raw_items')
      .select('*')
      .eq('processed', false)
      .order('pub_date', { ascending: false })

    if (fetchError) {
      console.error(`[convert-raw-to-articles] Fetch error:`, fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!rawItems || rawItems.length === 0) {
      return NextResponse.json({
        status: 'complete',
        itemsConverted: 0,
        itemsSkipped: 0,
        message: 'No unprocessed raw items found'
      })
    }

    console.log(`[convert-raw-to-articles] Found ${rawItems.length} unprocessed items`)

    // Get all existing articles for duplicate checking
    const { data: existingArticles } = await db
      .from('articles')
      .select('id, title, sources')

    let itemsConverted = 0
    let itemsSkipped = 0
    const now = new Date().toISOString()

    // Convert each raw_item to an article
    for (const item of rawItems) {
      try {
        // Check if similar article exists
        const newSource = {
          name: item.source_name,
          url: item.source_url,
          favicon: buildFaviconUrl(item.source_url)
        }

        let similarArticle = null
        if (existingArticles) {
          for (const existing of existingArticles) {
            const similarity = stringSimilarity(
              item.title.toLowerCase(),
              existing.title.toLowerCase()
            )
            if (similarity >= 0.7) {
              similarArticle = existing
              break
            }
          }
        }

        if (similarArticle) {
          // Article already exists - add source and skip
          const existingSources = similarArticle.sources || []
          const sourceExists = existingSources.some((s: any) => s.url === newSource.url)

          if (!sourceExists) {
            const updatedSources = [...existingSources, newSource]
            await db
              .from('articles')
              .update({ sources: updatedSources })
              .eq('id', similarArticle.id)
            console.log(`[convert-raw-to-articles] Added source to existing article ${similarArticle.id}`)
          }

          // Mark raw_item as processed
          await db
            .from('raw_items')
            .update({ processed: true })
            .eq('id', item.id)

          itemsSkipped++
        } else {
          // Create new article
          const article = {
            id: randomUUID(),
            topic: item.topic || 'geral',
            title: item.title,
            summary: item.summary || item.content?.slice(0, 300) || '',
            sections: [
              {
                heading: 'Conteúdo',
                body: item.content || ''
              }
            ],
            conclusion: null,
            sources: [newSource],
            image_url: item.image_url,
            video_url: item.video_url,
            published_at: item.pub_date || now,
            cached_at: now,
            matched_topics: [item.topic]
          }

          const { error: insertError } = await db
            .from('articles')
            .upsert(article, { onConflict: 'id' })

          if (insertError) {
            console.error(`[convert-raw-to-articles] Insert error for ${item.id}:`, insertError)
          } else {
            await db
              .from('raw_items')
              .update({ processed: true })
              .eq('id', item.id)

            itemsConverted++
            console.log(`[convert-raw-to-articles] Created new article for ${item.id}`)
          }
        }
      } catch (err: any) {
        console.error(`[convert-raw-to-articles] Error:`, err.message)
      }
    }

    console.log(
      `[convert-raw-to-articles] Converted ${itemsConverted}, Skipped ${itemsSkipped} items`
    )

    return NextResponse.json({
      status: 'complete',
      itemsProcessed: rawItems.length,
      itemsConverted,
      itemsSkipped,
      message: `Successfully converted ${itemsConverted} new articles and added sources to ${itemsSkipped} existing articles`
    })
  } catch (err: any) {
    console.error(`[convert-raw-to-articles] Unexpected error:`, err)
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}
