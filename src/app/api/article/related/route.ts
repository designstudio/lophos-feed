import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { loadBlockedTopics } from '@/lib/topic-signals'

function normalizeTopic(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeTopics(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map(normalizeTopic).filter(Boolean))]
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ items: [] })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const db = getSupabaseAdmin()

  // Fetch current article, user topics, and hidden articles in parallel
  const [{ data: current }, { data: userTopicsRows }, { data: hiddenRows }] = await Promise.all([
    db.from('articles').select('matched_topics').eq('id', id).single(),
    db.from('user_topics').select('topic').eq('user_id', userId),
    db.from('user_reactions').select('article_id').eq('user_id', userId).eq('reaction', 'dislike'),
  ])

  const userTopics = normalizeTopics((userTopicsRows ?? []).map((row: any) => row.topic))
  const currentTopics = normalizeTopics(current?.matched_topics)
  const hiddenIds = new Set((hiddenRows ?? []).map((r: any) => r.article_id))
  const blockedTopics = new Set(await loadBlockedTopics(db, userId, userTopics))

  if (currentTopics.length === 0 || userTopics.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const userTopicSet = new Set(userTopics)
  const interestAnchors = currentTopics.filter((topic) => userTopicSet.has(topic))

  // First collect articles that overlap any matched topic from the current
  // article. The user's topics remain an eligibility boundary below, but do
  // not replace the article's more specific similarity signals.
  const { data: rows, error } = await db
    .from('articles')
    .select('id, topic, title, summary, image_url, video_url, published_at, matched_topics')
    .overlaps('matched_topics', currentTopics)
    .neq('id', id)
    .order('published_at', { ascending: false })
    .limit(60)

  if (error) {
    console.error('[related] Failed to load candidates:', error)
    return NextResponse.json({ items: [] })
  }

  const items = (rows || [])
    .filter((row: any) => !hiddenIds.has(row.id))
    .map((row: any) => {
      const candidateTopics = normalizeTopics(row.matched_topics)
      const candidateTopicSet = new Set(candidateTopics)
      const sharedTopics = currentTopics.filter((topic) => candidateTopicSet.has(topic))
      const sharedInterestTopics = sharedTopics.filter((topic) => userTopicSet.has(topic))

      return {
        row,
        candidateTopics,
        sharedTopics,
        sharedInterestTopics,
        similarity: sharedTopics.length / Math.sqrt(currentTopics.length * candidateTopics.length),
      }
    })
    .filter(({ candidateTopics, sharedTopics, sharedInterestTopics }) => {
      if (sharedTopics.length === 0) return false
      if (interestAnchors.length > 0 && sharedInterestTopics.length === 0) return false
      return !candidateTopics.some((topic) => blockedTopics.has(topic))
    })
    .sort((a, b) => {
      const aSpecificMatches = a.sharedTopics.length - a.sharedInterestTopics.length
      const bSpecificMatches = b.sharedTopics.length - b.sharedInterestTopics.length

      return bSpecificMatches - aSpecificMatches
        || b.sharedTopics.length - a.sharedTopics.length
        || b.similarity - a.similarity
        || new Date(b.row.published_at).getTime() - new Date(a.row.published_at).getTime()
    })
    .slice(0, 4)
    .map(({ row }) => ({
      id: row.id,
      topic: row.topic,
      title: row.title,
      summary: row.summary,
      imageUrl: row.image_url,
      publishedAt: row.published_at,
    }))

  return NextResponse.json({ items })
}
