import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getInterestTopicFilters } from '@/lib/default-interest-topics'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ suggestions: [] }, { status: 401 })

  const query = (req.nextUrl.searchParams.get('q') ?? '')
    .trim()
    .slice(0, 80)
    .replace(/[%_]/g, '')

  if (query.length < 2) return NextResponse.json({ suggestions: [] })

  const { data, error } = await getSupabaseAdmin()
    .from('matched_topic_catalog')
    .select('topic, article_count')
    .ilike('topic', `%${query}%`)
    .gt('article_count', 0)
    .order('article_count', { ascending: false })
    .order('topic', { ascending: true })
    .limit(20)

  if (error) {
    console.error('[topics/autocomplete] Failed to search catalog:', error)
    return NextResponse.json({ suggestions: [] }, { status: 500 })
  }

  const suggestions = (data ?? [])
    .map((row: any) => String(row.topic ?? '').trim())
    .filter((topic) => topic && getInterestTopicFilters([topic]).articleTopics.length === 0)
    .slice(0, 8)

  return NextResponse.json({ suggestions })
}
