import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { convertRawItemsToArticles } from '@/lib/raw-to-articles'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const ingestSecret = process.env.RSS_INGEST_SECRET

    if (!ingestSecret || !authHeader.includes(ingestSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[convert-raw-to-articles] Starting conversion of unprocessed raw items')

    const db = getSupabaseAdmin()
    const result = await convertRawItemsToArticles(db)

    console.log(
      `[convert-raw-to-articles] Processed ${result.itemsProcessed}, converted ${result.itemsConverted}, skipped ${result.itemsSkipped}`,
    )

    return NextResponse.json({
      status: 'complete',
      ...result,
    })
  } catch (err: any) {
    console.error('[convert-raw-to-articles] Unexpected error:', err)
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}
