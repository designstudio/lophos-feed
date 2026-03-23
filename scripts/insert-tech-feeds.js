#!/usr/bin/env node
/**
 * Insert Tech category RSS feeds into Supabase
 * Usage: node scripts/insert-tech-feeds.js
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const techFeeds = [
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

async function insertFeeds() {
  try {
    console.log(`📡 Inserting ${techFeeds.length} Tech feeds into Supabase...`)

    const { data, error } = await supabase
      .from('rss_feeds')
      .insert(techFeeds.map(f => ({
        ...f,
        active: true,
        topics: f.topics, // Already an array
      })))
      .select()

    if (error) {
      console.error('❌ Insertion failed:', error.message)
      process.exit(1)
    }

    console.log(`✅ Successfully inserted ${data?.length || 0} feeds`)
    console.log(`📊 Feeds inserted:`)
    data?.forEach(f => console.log(`   - ${f.name} (${f.language})`))
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

insertFeeds()
