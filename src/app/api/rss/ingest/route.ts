import { NextRequest, NextResponse } from 'next/server'
import { ingestAllFeeds } from './ingest'


export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!process.env.RSS_INGEST_SECRET || token !== process.env.RSS_INGEST_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const result = await ingestAllFeeds({
      topic: url.searchParams.get('topic'),
      source: url.searchParams.get('source'),
      retryFailed: url.searchParams.get('retry') === 'failed',
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[rss/ingest] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
