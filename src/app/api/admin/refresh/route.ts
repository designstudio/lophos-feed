import { NextRequest } from 'next/server'
import { refreshAllFeeds, processRawFeeds } from '@/lib/cron'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ADMIN_SECRET = process.env.ADMIN_SECRET

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const phase = req.nextUrl.searchParams.get('phase') ?? 'all'

  if (phase === 'collect') {
    console.log('[admin] Manual collect triggered')
    await refreshAllFeeds()
    return new Response(JSON.stringify({ ok: true, phase: 'collect' }))
  }

  if (phase === 'process') {
    console.log('[admin] Manual process triggered')
    await processRawFeeds()
    return new Response(JSON.stringify({ ok: true, phase: 'process' }))
  }

  // phase === 'all' (default)
  console.log('[admin] Manual full refresh triggered (collect + process)')
  await refreshAllFeeds()
  await processRawFeeds()
  return new Response(JSON.stringify({ ok: true, phase: 'all' }))
}
