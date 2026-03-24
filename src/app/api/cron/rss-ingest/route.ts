import { NextRequest, NextResponse } from 'next/server'
import { ingestAllFeeds } from '@/app/api/rss/ingest/ingest'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  // Vercel Cron authenticates with CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await ingestAllFeeds({})
  return NextResponse.json(result)
}
