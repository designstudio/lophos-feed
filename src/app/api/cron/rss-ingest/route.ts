import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Validate Vercel cron signature
function isValidCronRequest(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || ''
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    console.warn('[cron/rss-ingest] CRON_SECRET not configured')
    return false
  }

  // Vercel sends: Bearer <deployment-token>
  const token = authHeader.replace(/^Bearer\s+/i, '')
  return token === expectedSecret
}

export async function GET(req: NextRequest) {
  // Validate request is from Vercel
  if (!isValidCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[cron/rss-ingest] Starting scheduled feed ingest')

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const ingestSecret = process.env.RSS_INGEST_SECRET

    if (!ingestSecret) {
      return NextResponse.json({ error: 'RSS_INGEST_SECRET not configured' }, { status: 500 })
    }

    // Call the RSS ingest endpoint
    const response = await fetch(`${baseUrl}/api/rss/ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ingestSecret}`,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('[cron/rss-ingest] Ingest failed:', result)
      return NextResponse.json(result, { status: response.status })
    }

    console.log('[cron/rss-ingest] ✓ Success:', {
      feedsProcessed: result.feedsProcessed,
      itemsAdded: result.itemsAdded,
      itemsSkipped: result.itemsSkipped,
      errors: result.errors?.length || 0,
    })

    return NextResponse.json({
      success: true,
      message: 'RSS feed ingest completed',
      ...result,
    })
  } catch (err: any) {
    console.error('[cron/rss-ingest] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
// Cron job configured
