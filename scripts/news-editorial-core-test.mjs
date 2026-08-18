import assert from 'node:assert/strict'
import { getContentCharsPerSource, normalizeSourceIndexList, parseGeneratedArticles } from './news-mistral-core.mjs'

const article = {
  title: 'Título',
  summary: 'Resumo',
  sections: [],
  sourceIndexes: [1],
  keywords: ['teste'],
  relevance: 1,
}

assert.deepEqual(parseGeneratedArticles(JSON.stringify([article]), 'Test'), [article])
assert.deepEqual(parseGeneratedArticles(`\`\`\`json\n${JSON.stringify([article])}\n\`\`\``, 'Test'), [article])
assert.deepEqual(parseGeneratedArticles(`Resposta:\n${JSON.stringify([article])}`, 'Test'), [article])
assert.throws(() => parseGeneratedArticles('[{"title":"quebrado"}', 'Test'))

assert.deepEqual(normalizeSourceIndexList([1, 2, 3], 3), {
  original: [1, 2, 3],
  normalized: [0, 1, 2],
  mode: 'one-based',
})
assert.deepEqual(normalizeSourceIndexList([0, 1, 2], 3), {
  original: [0, 1, 2],
  normalized: [0, 1, 2],
  mode: 'zero-based',
})

assert.equal(getContentCharsPerSource(1), 12000)
assert.equal(getContentCharsPerSource(3), 12000)
assert.equal(getContentCharsPerSource(4), 10000)
assert.equal(getContentCharsPerSource(10), 4000)

console.log('PASS editorial core: JSON parsing, source indexes, and dynamic source budgets')
