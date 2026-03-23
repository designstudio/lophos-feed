import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const TAVILY_KEY = process.env.TAVILY_API_KEY!

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const topic = req.nextUrl.searchParams.get('topic')
  if (!topic) return new Response(JSON.stringify({ error: 'Missing topic param' }), { status: 400 })

  try {
    // Test Tavily search for the topic
    const query = `${topic} news 2026`

    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query,
        search_depth: 'advanced',
        max_results: 8,
        time_range: 'day',
        topic: 'news',
        include_answer: false,
        include_raw_content: true,
        include_images: true,
      }),
    })

    if (!tavilyRes.ok) {
      return new Response(JSON.stringify({ error: `Tavily error: ${tavilyRes.status}` }), { status: 500 })
    }

    const tavilyData = await tavilyRes.json()
    const allResults = tavilyData.results || []

    return new Response(JSON.stringify({
      topic,
      query,
      time_range: 'day',
      totalResults: allResults.length,
      results: allResults.map((r: any) => ({
        url: r.url,
        title: r.title,
        contentLength: r.content?.length || 0,
        publishedDate: r.publish_date || null,
        hasImage: !!r.image,
      })),
      rawData: tavilyData,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[debug/tavily] error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch from Tavily' }), { status: 500 })
  }
}
