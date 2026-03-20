import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_ID = 'user_3BBgSW8X0ymh0nSEW0aPy05pp4g'

async function isMember(userId: string, db: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await db.from('community_members').select('user_id').eq('user_id', userId).single()
  return !!data
}

// GET — list pending edits (admin only)
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (userId !== ADMIN_ID) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getSupabaseAdmin()
  const { data } = await db
    .from('article_edits')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(30)

  return NextResponse.json({ edits: data || [] })
}

// POST — submit an edit
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseAdmin()
  if (!(await isMember(userId, db))) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const { articleId, original, changes } = await req.json()
  if (!articleId || !original || !changes) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Check no pending edit from this user for this article
  const { data: existing } = await db
    .from('article_edits')
    .select('id')
    .eq('article_id', articleId)
    .eq('edited_by', userId)
    .eq('status', 'pending')
    .single()

  if (existing) return NextResponse.json({ error: 'Já existe uma edição pendente sua para este artigo.' }, { status: 409 })

  const { data, error } = await db.from('article_edits').insert({
    article_id: articleId,
    edited_by: userId,
    original,
    changes,
    status: 'pending',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ edit: data })
}

// PATCH — approve or reject (admin only)
export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (userId !== ADMIN_ID) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, action } = await req.json()
  if (!id || !['approve', 'reject'].includes(action))
    return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const db = getSupabaseAdmin()
  const status = action === 'approve' ? 'approved' : 'rejected'

  const { data: edit } = await db
    .from('article_edits')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (!edit) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (action === 'approve') {
    const changes = edit.changes as any
    const update: any = {}
    if (changes.title)    update.title     = changes.title
    if (changes.summary)  update.summary   = changes.summary
    if (changes.sections) update.sections  = changes.sections
    if (changes.imageUrl) update.image_url = changes.imageUrl

    await Promise.allSettled([
      db.from('news_cache').update(update).eq('id', edit.article_id),
      db.from('articles').update(update).eq('id', edit.article_id),
    ])
  }

  return NextResponse.json({ ok: true })
}
