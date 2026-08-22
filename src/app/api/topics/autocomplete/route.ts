import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  getInterestTopicFilters,
  getInterestTopicLabel,
  INTEREST_TOPIC_CATEGORIES,
} from '@/lib/default-interest-topics'
import { getCanonicalTopicSuggestions, getCatalogSearchTerm } from '@/lib/matched-topic-catalog'

export const dynamic = 'force-dynamic'

function normalizeSearchValue(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ suggestions: [] }, { status: 401 })

  const query = (req.nextUrl.searchParams.get('q') ?? '')
    .trim()
    .slice(0, 80)
    .replace(/[%_]/g, '')

  if (query.length < 2) return NextResponse.json({ suggestions: [] })

  const includeDefaults = req.nextUrl.searchParams.get('includeDefaults') === 'true'
  const catalogSearchTerm = getCatalogSearchTerm(query)

  const { data, error } = await getSupabaseAdmin()
    .from('matched_topic_catalog')
    .select('topic, article_count')
    .ilike('topic', `%${catalogSearchTerm}%`)
    .gt('article_count', 0)
    .order('article_count', { ascending: false })
    .order('topic', { ascending: true })
    .limit(20)

  if (error) {
    console.error('[topics/autocomplete] Failed to search catalog:', error)
    return NextResponse.json({ suggestions: [] }, { status: 500 })
  }

  const catalogTopics = (data ?? []).flatMap((row: any) => {
    const topic = String(row.topic ?? '').trim()
    return topic ? [{ topic, article_count: Number(row.article_count ?? 0) }] : []
  })
  const catalogSuggestions = catalogTopics.length > 0
    ? getCanonicalTopicSuggestions(query, catalogTopics)
        .filter((topic) => includeDefaults || getInterestTopicFilters([topic]).articleTopics.length === 0)
        .map((topic) => includeDefaults ? getInterestTopicLabel(topic) : topic)
    : []

  const normalizedQuery = normalizeSearchValue(query)
  const defaultSuggestions = includeDefaults
    ? INTEREST_TOPIC_CATEGORIES
        .filter(({ label, aliases }) => [label, ...aliases]
          .some((topic) => normalizeSearchValue(topic).includes(normalizedQuery)))
        .map(({ label }) => label)
    : []

  const seenSuggestions = new Set<string>()
  const suggestions = [...defaultSuggestions, ...catalogSuggestions]
    .filter((topic) => {
      const key = normalizeSearchValue(topic)
      if (!key || seenSuggestions.has(key)) return false
      seenSuggestions.add(key)
      return true
    })
    .slice(0, 8)

  return NextResponse.json({ suggestions })
}
