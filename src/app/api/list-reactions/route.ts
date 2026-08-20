import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { syncNegativeTopicsForReaction } from '@/lib/topic-signals'

type ListReaction = 'like' | 'dislike'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await getSupabaseAdmin()
    .from('editorial_list_reactions')
    .select('list_id, reaction')
    .eq('user_id', userId)

  if (error) {
    console.error('[list-reactions] GET error:', error)
    return NextResponse.json({ error: 'Failed to load reactions' }, { status: 500 })
  }

  const reactions: Record<string, ListReaction> = {}
  for (const row of data ?? []) reactions[row.list_id] = row.reaction as ListReaction
  return NextResponse.json({ reactions })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const listId = typeof body?.listId === 'string' ? body.listId : ''
  const reaction = body?.reaction === 'like' || body?.reaction === 'dislike'
    ? body.reaction as ListReaction
    : null

  if (!listId) return NextResponse.json({ error: 'Invalid list' }, { status: 400 })

  const db = getSupabaseAdmin()
  const [{ data: list, error: listError }, { data: current, error: currentError }] = await Promise.all([
    db.from('editorial_lists').select('topic, matched_topics').eq('id', listId).eq('status', 'published').maybeSingle(),
    db.from('editorial_list_reactions').select('reaction, matched_topics').eq('user_id', userId).eq('list_id', listId).maybeSingle(),
  ])

  if (listError || !list) return NextResponse.json({ error: 'List not found' }, { status: 404 })
  if (currentError) {
    console.error('[list-reactions] lookup error:', currentError)
    return NextResponse.json({ error: 'Failed to load current reaction' }, { status: 500 })
  }

  const listTopics = Array.isArray(list.matched_topics) && list.matched_topics.length > 0
    ? list.matched_topics
    : [list.topic]
  const storedTopics = Array.isArray(current?.matched_topics) && current.matched_topics.length > 0
    ? current.matched_topics
    : listTopics

  if (!reaction) {
    const { error } = await db
      .from('editorial_list_reactions')
      .delete()
      .eq('user_id', userId)
      .eq('list_id', listId)

    if (error) return NextResponse.json({ error: 'Failed to delete reaction' }, { status: 500 })
    if (current?.reaction === 'dislike') {
      try {
        await syncNegativeTopicsForReaction(db, userId, storedTopics, -1)
      } catch (error) {
        console.error('[list-reactions] negative topic sync error:', error)
      }
    }
    return NextResponse.json({ ok: true })
  }

  const { error } = await db.from('editorial_list_reactions').upsert({
    user_id: userId,
    list_id: listId,
    topic: list.topic,
    matched_topics: listTopics,
    reaction,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,list_id' })

  if (error) {
    console.error('[list-reactions] UPSERT error:', error)
    return NextResponse.json({ error: 'Failed to save reaction' }, { status: 500 })
  }

  const wasDislike = current?.reaction === 'dislike'
  const isDislike = reaction === 'dislike'
  if (wasDislike !== isDislike) {
    try {
      await syncNegativeTopicsForReaction(db, userId, wasDislike ? storedTopics : listTopics, isDislike ? 1 : -1)
    } catch (syncError) {
      console.error('[list-reactions] negative topic sync error:', syncError)
    }
  }

  return NextResponse.json({ ok: true })
}
