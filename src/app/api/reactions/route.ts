import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleId, topic, reaction } = await req.json()
  const db = getSupabaseAdmin()

  if (!reaction) {
    await db.from('user_reactions').delete()
      .eq('user_id', userId).eq('article_id', articleId)
    return NextResponse.json({ ok: true })
  }

  await db.from('user_reactions').upsert({
    user_id: userId,
    article_id: articleId,
    topic,
    reaction,
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id,article_id' })

  return NextResponse.json({ ok: true })
}
