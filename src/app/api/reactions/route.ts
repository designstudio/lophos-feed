import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const includeErrorDetails = process.env.NODE_ENV !== 'production'

function jsonError(status: number, message: string, err?: unknown) {
  return NextResponse.json(
    {
      error: message,
      ...(includeErrorDetails && err instanceof Error
        ? { detail: { message: err.message, stack: err.stack } }
        : {}),
    },
    { status },
  )
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return jsonError(401, 'Unauthorized')

    const db = getSupabaseAdmin()
    const { data, error } = await db
      .from('user_reactions')
      .select('article_id, reaction')
      .eq('user_id', userId)

    if (error) {
      console.error('[reactions] GET error:', error)
      return jsonError(500, 'Failed to load reactions', error)
    }

    const reactions: Record<string, 'like' | 'dislike'> = {}
    for (const row of data ?? []) {
      reactions[row.article_id] = row.reaction
    }

    return NextResponse.json({ reactions })
  } catch (err) {
    console.error('[reactions] GET failed:', err)
    return jsonError(500, 'Failed to load reactions', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return jsonError(401, 'Unauthorized')

    const { articleId, topic, reaction } = await req.json()
    const db = getSupabaseAdmin()

    if (!reaction) {
      const { error } = await db
        .from('user_reactions')
        .delete()
        .eq('user_id', userId)
        .eq('article_id', articleId)

      if (error) {
        console.error('[reactions] DELETE error:', error)
        return jsonError(500, 'Failed to delete reaction', error)
      }

      return NextResponse.json({ ok: true })
    }

    const { error } = await db.from('user_reactions').upsert(
      {
        user_id: userId,
        article_id: articleId,
        topic,
        reaction,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,article_id' },
    )

    if (error) {
      console.error('[reactions] UPSERT error:', error)
      return jsonError(500, 'Failed to save reaction', error)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[reactions] POST failed:', err)
    return jsonError(500, 'Failed to save reaction', err)
  }
}
