import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300

// Simple string similarity function (Levenshtein distance)
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) return 1.0

  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = []
  for (let k = 0; k <= s1.length; k++) costs[k] = k
  for (let i = 1; i <= s2.length; i++) {
    costs[0] = i
    let nw = i - 1
    for (let j = 1; j <= s1.length; j++) {
      const cj = Math.min(
        1 + Math.min(costs[j], costs[j - 1]),
        nw + (s1[j - 1] === s2[i - 1] ? 0 : 1)
      )
      nw = costs[j]
      costs[j] = cj
    }
  }
  return costs[s1.length]
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const ingestSecret = process.env.RSS_INGEST_SECRET

    if (!ingestSecret || !authHeader.includes(ingestSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get threshold from query params (default 0.7 = 70%)
    const threshold = parseFloat(req.nextUrl.searchParams.get('threshold') || '0.7')
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100')

    console.log(`[find-duplicates] Starting with threshold: ${threshold}`)

    const db = getSupabaseAdmin()

    // Get all articles
    const { data: articles, error } = await db
      .from('articles')
      .select('id, title, published_at')
      .order('published_at', { ascending: false })

    if (error) {
      console.error(`[find-duplicates] Fetch error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!articles || articles.length === 0) {
      return NextResponse.json({
        status: 'complete',
        totalArticles: 0,
        duplicates: [],
        message: 'No articles found'
      })
    }

    console.log(`[find-duplicates] Found ${articles.length} articles`)

    interface Duplicate {
      similarity: number
      id1: string
      title1: string
      published_at1: string
      id2: string
      title2: string
      published_at2: string
    }

    const duplicates: Duplicate[] = []

    // Compare each pair of articles
    for (let i = 0; i < articles.length; i++) {
      for (let j = i + 1; j < articles.length; j++) {
        const similarity = stringSimilarity(
          articles[i].title.toLowerCase(),
          articles[j].title.toLowerCase()
        )

        if (similarity >= threshold) {
          duplicates.push({
            similarity: Math.round(similarity * 100) / 100,
            id1: articles[i].id,
            title1: articles[i].title,
            published_at1: articles[i].published_at,
            id2: articles[j].id,
            title2: articles[j].title,
            published_at2: articles[j].published_at
          })
        }
      }

      // Log progress
      if ((i + 1) % 50 === 0) {
        console.log(`[find-duplicates] Processed ${i + 1}/${articles.length} articles`)
      }
    }

    // Sort by similarity descending
    duplicates.sort((a, b) => b.similarity - a.similarity)

    // Limit results
    const limitedDuplicates = duplicates.slice(0, limit)

    console.log(
      `[find-duplicates] Found ${duplicates.length} duplicates (showing ${limitedDuplicates.length})`
    )

    return NextResponse.json({
      status: 'complete',
      totalArticles: articles.length,
      threshold,
      totalDuplicatesFound: duplicates.length,
      duplicatesShown: limitedDuplicates.length,
      duplicates: limitedDuplicates,
      message: `Found ${duplicates.length} duplicate pairs with ${Math.round(threshold * 100)}%+ similarity`
    })
  } catch (err: any) {
    console.error(`[find-duplicates] Unexpected error:`, err)
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}
