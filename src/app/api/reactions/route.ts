import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getArticleMatchedTopics, syncNegativeTopicsForReaction } from '@/lib/topic-signals'

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
    const { data: currentReaction, error: currentReactionError } = await db
      .from('user_reactions')
      .select('reaction, matched_topics')
      .eq('user_id', userId)
      .eq('article_id', articleId)
      .maybeSingle()

    if (currentReactionError) {
      console.error('[reactions] lookup error:', currentReactionError)
      return jsonError(500, 'Failed to load current reaction', currentReactionError)
    }

    const storedMatchedTopics = Array.isArray(currentReaction?.matched_topics) ? currentReaction.matched_topics : []
    const articleMatchedTopics = await getArticleMatchedTopics(db, articleId, [topic])

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

      if (currentReaction?.reaction === 'dislike') {
        try {
          await syncNegativeTopicsForReaction(
            db,
            userId,
            storedMatchedTopics.length > 0 ? storedMatchedTopics : articleMatchedTopics,
            -1,
          )
        } catch (syncError) {
          console.error('[reactions] negative topic sync error:', syncError)
        }
      }

      return NextResponse.json({ ok: true })
    }

    const wasDislike = currentReaction?.reaction === 'dislike'
    const isDislike = reaction === 'dislike'

    const { error } = await db.from('user_reactions').upsert(
      {
        user_id: userId,
        article_id: articleId,
        topic,
        matched_topics: articleMatchedTopics,
        reaction,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,article_id' },
    )

    if (error) {
      console.error('[reactions] UPSERT error:', error)
      return jsonError(500, 'Failed to save reaction', error)
    }

    if (wasDislike !== isDislike) {
      try {
        await syncNegativeTopicsForReaction(
          db,
          userId,
          wasDislike ? (storedMatchedTopics.length > 0 ? storedMatchedTopics : articleMatchedTopics) : articleMatchedTopics,
          isDislike ? 1 : -1,
        )
      } catch (syncError) {
        console.error('[reactions] negative topic sync error:', syncError)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[reactions] POST failed:', err)
    return jsonError(500, 'Failed to save reaction', err)
  }
}
