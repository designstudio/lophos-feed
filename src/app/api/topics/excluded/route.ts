import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET — fetch user's excluded topics
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await getSupabaseAdmin()
    .from('user_excluded_topics')
    .select('topic')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ excludedTopics: (data ?? []).map((r: any) => r.topic) })
}

// POST — save excluded topics (replaces all existing)
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { excludedTopics } = await req.json()
  if (!Array.isArray(excludedTopics)) {
    return NextResponse.json({ error: 'excludedTopics must be an array' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  // Delete existing excluded topics for this user
  await db.from('user_excluded_topics').delete().eq('user_id', userId)

  // Insert new excluded topics (normalized to lowercase)
  if (excludedTopics.length > 0) {
    const rows = excludedTopics.map((topic: string) => ({
      user_id: userId,
      topic: topic.toLowerCase().trim(),
    }))
    const { error } = await db.from('user_excluded_topics').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
