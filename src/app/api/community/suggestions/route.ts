import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_ID = 'user_3BBgSW8X0ymh0nSEW0aPy05pp4g'

async function isMember(userId: string, db: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await db.from('community_members').select('user_id').eq('user_id', userId).single()
  return !!data
}

// GET — list: pending suggestions (admin) or articles missing images (member)
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseAdmin()
  if (!(await isMember(userId, db))) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const type = req.nextUrl.searchParams.get('type')

  if (type === 'pending') {
    // Admin: list pending suggestions
    const { data } = await db
      .from('image_suggestions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20)
    return NextResponse.json({ suggestions: data || [] })
  }

  // Member: list recent articles without images to suggest for
  const { data: cacheMissing } = await db
    .from('news_cache')
    .select('id, title, topic, cached_at')
    .is('image_url', null)
    .order('cached_at', { ascending: false })
    .limit(10)

  const { data: articlesMissing } = await db
    .from('articles')
    .select('id, title, topic, cached_at')
    .is('image_url', null)
    .order('cached_at', { ascending: false })
    .limit(10)

  // Merge + deduplicate by id
  const all = [...(cacheMissing || []), ...(articlesMissing || [])]
  const seen = new Set<string>()
  const articles = all.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true })
    .sort((a, b) => new Date(b.cached_at).getTime() - new Date(a.cached_at).getTime())
    .slice(0, 10)

  return NextResponse.json({ articles })
}

// POST — submit a suggestion
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseAdmin()
  if (!(await isMember(userId, db))) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const { articleId, articleTitle, imageUrl } = await req.json()
  if (!articleId || !imageUrl) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Check no pending suggestion already from this user for this article
  const { data: existing } = await db
    .from('image_suggestions')
    .select('id')
    .eq('article_id', articleId)
    .eq('suggested_by', userId)
    .eq('status', 'pending')
    .single()

  if (existing) return NextResponse.json({ error: 'Já existe uma sugestão pendente sua para este artigo.' }, { status: 409 })

  const { data, error } = await db.from('image_suggestions').insert({
    article_id: articleId,
    article_title: articleTitle,
    suggested_by: userId,
    image_url: imageUrl,
    status: 'pending',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ suggestion: data })
}

// PATCH — approve or reject (admin only)
export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (userId !== ADMIN_ID) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, action } = await req.json() // action: 'approve' | 'reject'
  if (!id || !['approve', 'reject'].includes(action))
    return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const db = getSupabaseAdmin()
  const status = action === 'approve' ? 'approved' : 'rejected'

  const { data: suggestion } = await db
    .from('image_suggestions')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // If approved, update both tables
  if (action === 'approve') {
    await Promise.allSettled([
      db.from('news_cache').update({ image_url: suggestion.image_url }).eq('id', suggestion.article_id),
      db.from('articles').update({ image_url: suggestion.image_url }).eq('id', suggestion.article_id),
    ])
  }

  return NextResponse.json({ ok: true, suggestion })
}
