import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const db = getSupabaseAdmin()

    // Get count by topic
    const { data: allItems, error: allError } = await db
      .from('articles')
      .select('topic', { count: 'exact' })

    if (allError) {
      return NextResponse.json({ error: allError.message }, { status: 500 })
    }

    // Count by topic
    const topicCounts: Record<string, number> = {}
    if (allItems) {
      for (const item of allItems) {
        topicCounts[item.topic] = (topicCounts[item.topic] || 0) + 1
      }
    }

    // Get sample item
    const { data: sample } = await db
      .from('articles')
      .select('*')
      .limit(1)

    return NextResponse.json({
      totalItems: allItems?.length || 0,
      topicCounts,
      sampleItem: sample?.[0] || null,
      tableStructure: sample?.[0] ? Object.keys(sample[0]) : [],
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error querying articles' },
      { status: 500 }
    )
  }
}
