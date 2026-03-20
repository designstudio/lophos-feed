import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET — fetch user's topics
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
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

  // Delete existing topics for this user
  await supabaseAdmin.from('user_topics').delete().eq('user_id', userId)

  // Insert new topics
  const rows = topics.map((topic: string) => ({ user_id: userId, topic }))
  const { error } = await supabaseAdmin.from('user_topics').insert(rows)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
