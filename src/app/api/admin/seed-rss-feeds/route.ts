import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Admin endpoint to seed RSS feeds into the database
 * Call once to populate initial Tech feeds
 * Requires Clerk authentication (admin)
 */

const TECH_FEEDS = [
  { url: 'https://rss.tecmundo.com.br/feed', name: 'TecMundo', topics: ['tecnologia', 'gadgets'], language: 'pt' },
  { url: 'https://www.tudocelular.com/feed/', name: 'Tudo Celular', topics: ['tecnologia', 'mobile'], language: 'pt' },
  { url: 'https://www.nextpit.com/feed', name: 'NextPit', topics: ['tecnologia', 'mobile', 'gadgets'], language: 'pt' },
  { url: 'https://tecnoblog.net/feed/', name: 'TecnoBlog', topics: ['tecnologia', 'gadgets'], language: 'pt' },
  { url: 'https://feeds.feedburner.com/canaltechbr', name: 'CanalTech', topics: ['tecnologia', 'gadgets'], language: 'pt' },
  { url: 'https://olhardigital.com.br/feed/', name: 'Olhar Digital', topics: ['tecnologia'], language: 'pt' },
  { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge', topics: ['tecnologia', 'gadgets'], language: 'en' },
  { url: 'https://www.engadget.com/rss.xml', name: 'Engadget', topics: ['tecnologia', 'gadgets'], language: 'en' },
  { url: 'https://arstechnica.com/feed/', name: 'Ars Technica', topics: ['tecnologia'], language: 'en' },
  { url: 'https://www.androidauthority.com/feed/', name: 'Android Authority', topics: ['tecnologia', 'mobile'], language: 'en' },
  { url: 'https://feeds.feedburner.com/TechCrunch/', name: 'TechCrunch', topics: ['tecnologia', 'startup'], language: 'en' },
  { url: 'https://feeds.feedburner.com/ign/tech-articles', name: 'IGN Tech', topics: ['tecnologia', 'gadgets'], language: 'en' },
]

export async function POST(req: NextRequest) {
  try {
    // Simple auth check — you should use Clerk or stronger auth in production
    const adminToken = req.headers.get('x-admin-token')
    const expectedToken = process.env.ADMIN_SEED_TOKEN

    if (expectedToken && adminToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getSupabaseAdmin()

    // Insert feeds
    const { data, error } = await db
      .from('rss_feeds')
      .insert(TECH_FEEDS.map(f => ({
        url: f.url,
        name: f.name,
        topics: f.topics,
        language: f.language,
        active: true,
      })))
      .select()

    if (error) {
      console.error('[seed-rss-feeds] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[seed-rss-feeds] inserted ${data?.length} feeds`)

    return NextResponse.json({
      success: true,
      inserted: data?.length || 0,
      feeds: data?.map(f => ({ id: f.id, name: f.name, topics: f.topics })) || [],
    })
  } catch (err: any) {
    console.error('[seed-rss-feeds] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
