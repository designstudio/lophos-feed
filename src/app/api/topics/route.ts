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

// GET — fetch user's topics
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return jsonError(401, 'Unauthorized')

    const { data, error } = await getSupabaseAdmin()
      .from('user_topics')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[topics] GET error:', error)
      return jsonError(500, 'Failed to load topics', error)
    }

    return NextResponse.json({ topics: data })
  } catch (err) {
    console.error('[topics] GET failed:', err)
    return jsonError(500, 'Failed to load topics', err)
  }
}

// POST — save topics (replaces all existing)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return jsonError(401, 'Unauthorized')

    const { topics } = await req.json()
    if (!Array.isArray(topics) || topics.length === 0) {
      return jsonError(400, 'Topics required')
    }

    const db = getSupabaseAdmin()

    await db.from('user_topics').delete().eq('user_id', userId)

    console.log(`[topics] POST: user=${userId}, input topics=${JSON.stringify(topics)}`)
    const normalized = await Promise.all(
      topics.map(async (topic: string) => {
        try {
          const { data, error } = await db.rpc('normalize_topic', { p_topic: topic })
          if (error) {
            console.error(`[topics] ERROR normalizing "${topic}": ${error.message}`)
            return topic.toLowerCase().trim()
          }

          return String(data).toLowerCase().trim()
        } catch (err) {
          console.error(`[topics] Exception normalizing "${topic}":`, err)
          return topic.toLowerCase().trim()
        }
      }),
    )

    const uniqueTopics = [...new Set(normalized)]
    console.log(`[topics] Unique normalized topics: ${JSON.stringify(uniqueTopics)}`)

    const rows = uniqueTopics.map((topic: string) => ({ user_id: userId, topic }))
    const { error } = await db.from('user_topics').insert(rows)

    if (error) {
      console.error(`[topics] Insert error: ${error.message}`)
      return jsonError(500, 'Failed to save topics', error)
    }

    console.log(`[topics] Success: saved ${uniqueTopics.length} topics for user ${userId}`)
    return NextResponse.json({ ok: true, topicsSaved: uniqueTopics })
  } catch (err) {
    console.error('[topics] POST failed:', err)
    return jsonError(500, 'Failed to save topics', err)
  }
}
