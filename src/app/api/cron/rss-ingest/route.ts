import { NextRequest, NextResponse } from 'next/server'
import { ingestAllFeeds } from '@/app/api/rss/ingest/ingest'
import { getSupabaseAdmin } from '@/lib/supabase'
import { convertRawItemsToArticles } from '@/lib/raw-to-articles'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  // Vercel Cron authenticates with CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const ingestResult = await ingestAllFeeds({})
    if ((ingestResult as any).skipped) {
      return NextResponse.json({
        ...ingestResult,
        fallbackConversion: null,
      })
    }

    const db = getSupabaseAdmin()
    const convertResult = await convertRawItemsToArticles(db, { limit: 250 })

    return NextResponse.json({
      ...ingestResult,
      fallbackConversion: convertResult,
    })
  } catch (err: any) {
    console.error('[cron/rss-ingest] error:', err)
    return NextResponse.json(
      {
        error: err?.message || 'Internal server error',
      },
      { status: 500 }
    )
  }
}
