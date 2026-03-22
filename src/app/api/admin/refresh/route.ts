import { NextRequest } from 'next/server'
import { refreshAllFeeds } from '@/lib/cron'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ADMIN_SECRET = process.env.ADMIN_SECRET

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  console.log('[admin] Manual refresh triggered')
  await refreshAllFeeds()

  return new Response(JSON.stringify({ ok: true, message: 'Refresh completed' }))
}
