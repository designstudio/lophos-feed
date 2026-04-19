/**
 * Parses the backfill log file and injects keywords directly into the database,
 * bypassing the need to re-run synthesis.
 *
 * Usage: node scripts/inject-keywords-from-log.mjs <path-to-log-file>
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const logPath = process.argv[2]
if (!logPath) {
  console.error('Usage: node inject-keywords-from-log.mjs <path-to-log-file>')
  process.exit(1)
}

const log = readFileSync(logPath, 'utf-8')
const lines = log.split('\n')

// Parse pairs of (title, keywords) from log lines:
// ✅ Article title...
//    → keyword1, keyword2, keyword3
const entries = []
for (let i = 0; i < lines.length; i++) {
  const titleMatch = lines[i].match(/✅\s+(.+)/)
  if (titleMatch) {
    const keywordsLine = lines[i + 1]
    const kwMatch = keywordsLine?.match(/→\s+(.+)/)
    if (kwMatch) {
      const title = titleMatch[1].trim()
      const keywords = kwMatch[1].split(',').map(k => k.trim()).filter(Boolean)
      entries.push({ title, keywords })
    }
  }
}

console.log(`Parsed ${entries.length} entries from log`)

// Fetch all articles from articles to match by title prefix
const { data: articles, error } = await db
  .from('articles')
  .select('id, title, topic')

if (error) throw new Error('DB error: ' + error.message)

let updated = 0
let notFound = 0

for (const entry of entries) {
  // Match by title prefix (log truncates at ~60 chars)
  const article = articles.find(a =>
    a.title?.startsWith(entry.title) || entry.title.startsWith(a.title?.slice(0, 50))
  )

  if (!article) {
    console.warn(`⚠️  Not found: ${entry.title.slice(0, 60)}`)
    notFound++
    continue
  }

  const matched_topics = [...new Set([article.topic, ...entry.keywords])]

  const { error: updateError } = await db
    .from('articles')
    .update({ matched_topics })
    .eq('id', article.id)

  if (updateError) {
    console.error(`❌ ${article.title?.slice(0, 50)}: ${updateError.message}`)
  } else {
    console.log(`✅ ${article.title?.slice(0, 60)}`)
    updated++
  }
}

console.log(`\nDone! updated=${updated} notFound=${notFound}`)
