import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET — fetch user's topics
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await getSupabaseAdmin()
    .from('user_topics')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ topics: data })
}

// POST — save topics (replaces all existing)
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topics } = await req.json()
  if (!Array.isArray(topics) || topics.length === 0) {
    return NextResponse.json({ error: 'Topics required' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  // Delete existing topics for this user
  await db.from('user_topics').delete().eq('user_id', userId)

  // Normalizar tópicos: converter aliases para canônicos
  // Usa a função normalize_topic do banco de dados
  console.log(`[topics] POST: user=${userId}, input topics=${JSON.stringify(topics)}`)
  const normalized = await Promise.all(
    topics.map(async (topic: string) => {
      try {
        const { data, error } = await db.rpc('normalize_topic', { p_topic: topic })
        if (error) {
          console.error(`[topics] ERROR normalizing "${topic}": ${error.message}`)
          const fallback = topic.toLowerCase().trim()
          console.log(`[topics] Fallback: "${topic}" -> "${fallback}"`)
          return fallback
        }
        // A RPC retorna a string diretamente
        const normalized = String(data).toLowerCase().trim()
        console.log(`[topics] RPC success: "${topic}" -> "${normalized}"`)
        return normalized
      } catch (err) {
        console.error(`[topics] Exception normalizing "${topic}":`, err)
        const fallback = topic.toLowerCase().trim()
        console.log(`[topics] Exception fallback: "${topic}" -> "${fallback}"`)
        return fallback
      }
    })
  )

  // Insert new topics (deduplicated)
  const uniqueTopics = [...new Set(normalized)]
  console.log(`[topics] Unique normalized topics: ${JSON.stringify(uniqueTopics)}`)

  const rows = uniqueTopics.map((topic: string) => ({ user_id: userId, topic }))
  console.log(`[topics] Rows to insert: ${JSON.stringify(rows)}`)
  const { error } = await db.from('user_topics').insert(rows)

  if (error) {
    console.error(`[topics] Insert error: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[topics] Success: saved ${uniqueTopics.length} topics for user ${userId}`)
  return NextResponse.json({ ok: true, topicsSaved: uniqueTopics })
}
