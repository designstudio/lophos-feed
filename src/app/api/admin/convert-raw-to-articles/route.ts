import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export const maxDuration = 300

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
        message: 'No unprocessed raw items found'
      })
    }

    console.log(`[convert-raw-to-articles] Found ${rawItems.length} unprocessed items`)

    let itemsConverted = 0
    const now = new Date().toISOString()

    // Convert each raw_item to an article
    for (const item of rawItems) {
      try {
        // Create simple article from raw_item
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
          sources: [
            {
              name: item.source_name,
              url: item.source_url,
              favicon: `https://www.google.com/s2/favicons?domain=${item.source_url}&sz=32`
            }
          ],
          image_url: item.image_url,
          video_url: item.video_url,
          published_at: item.pub_date || now,
          cached_at: now,
          matched_topics: [item.topic]
        }

        // Insert or update article
        const { error: insertError } = await db
          .from('articles')
          .upsert(article, { onConflict: 'id' })

        if (insertError) {
          console.error(`[convert-raw-to-articles] Insert error for ${item.id}:`, insertError)
        } else {
          // Mark raw_item as processed
          await db
            .from('raw_items')
            .update({ processed: true })
            .eq('id', item.id)

          itemsConverted++
        }
      } catch (err: any) {
        console.error(`[convert-raw-to-articles] Error:`, err.message)
      }
    }

    console.log(`[convert-raw-to-articles] Converted ${itemsConverted} items`)

    return NextResponse.json({
      status: 'complete',
      itemsProcessed: rawItems.length,
      itemsConverted,
      message: `Successfully converted ${itemsConverted} raw items to articles`
    })
  } catch (err: any) {
    console.error(`[convert-raw-to-articles] Unexpected error:`, err)
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}
