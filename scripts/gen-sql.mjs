import { readFileSync, writeFileSync } from 'fs'

const logPath = 'C:/Users/henri/Downloads/logs_61842728295/backfill/5_Backfill keywords.txt'
const log = readFileSync(logPath, 'utf-8')
const lines = log.split('\n')

const entries = []
for (let i = 0; i < lines.length; i++) {
  const titleMatch = lines[i].match(/✅\s+(.+)/)
  if (titleMatch) {
    const kwMatch = lines[i + 1]?.match(/→\s+(.+)/)
    if (kwMatch) {
      entries.push({
        title: titleMatch[1].trim(),
        keywords: kwMatch[1].split(',').map(k => k.trim()).filter(Boolean)
      })
    }
  }
}

console.log(`Parsed ${entries.length} entries`)

const sqls = entries.map(e => {
  const arr = 'ARRAY[' + e.keywords.map(k => `'${k.replace(/'/g, "''")}'`).join(',') + ']'
  const title = e.title.replace(/'/g, "''")
  return `UPDATE articles SET matched_topics = ${arr} WHERE title ILIKE '${title}%';`
})

const output = sqls.join('\n')
writeFileSync('C:/Users/henri/Downloads/inject-keywords.sql', output)
console.log('SQL written to C:/Users/henri/Downloads/inject-keywords.sql')
