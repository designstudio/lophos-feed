import assert from 'node:assert/strict'
import { buildArticleDuplicateGroups } from './article-dedupe-core.mjs'

const BASE_TIME = '2026-08-19T12:00:00Z'

function article(id, title, overrides = {}) {
  return {
    id,
    title,
    summary: `Resumo factual de ${title}`,
    topic: 'cinema',
    published_at: BASE_TIME,
    cached_at: BASE_TIME,
    sources: [{ name: 'Fonte compartilhada', url: 'https://example.com/noticia' }],
    ...overrides,
  }
}

function decision(overrides = {}) {
  return {
    merge: true,
    reason: 'semantic-high-confidence',
    semanticScore: 0.95,
    titleSemanticScore: 0.95,
    lexicalScore: 0.3,
    rareTokens: ['aurora', 'glass'],
    sharedTitleTokens: ['aurora', 'glass'],
    hoursApart: 1,
    conflictingTitleYears: false,
    conflictingTitleEventKinds: false,
    ...overrides,
  }
}

function result(entries, candidates = entries.filter(([, value]) => value.merge).map(([key]) => key)) {
  return {
    pairDecisions: new Map(entries),
    candidatePairKeys: new Set(candidates),
    options: { maxPairHours: 18 },
  }
}

function groups(articles, v2Result) {
  return buildArticleDuplicateGroups(articles, v2Result).duplicateGroups
}

const cases = [
  () => {
    const articles = [
      article('a', 'Sony anuncia o novo headset Aurora Glass'),
      article('b', 'Aurora Glass e o novo headset anunciado pela Sony'),
    ]
    assert.equal(groups(articles, result([['0:1', decision()]]))[0]?.articles.length, 2)
  },
  () => {
    const articles = [
      article('a', 'Filme Aurora ganha primeiro trailer oficial'),
      article('b', 'Primeiro trailer do filme Aurora e divulgado'),
      article('c', 'Filme Aurora supera marca global de bilheteria'),
    ]
    const duplicateGroups = groups(articles, result([
      ['0:1', decision({ semanticScore: 0.97 })],
      ['0:2', decision({ merge: false, reason: 'event-conflict:trailer!=boxoffice' })],
      ['1:2', decision({ semanticScore: 0.96 })],
    ], ['0:1', '1:2']))
    assert.equal(duplicateGroups.some((group) => group.articles.length === 3), false, 'complete-link must block transitive chains')
  },
  () => {
    const articles = [
      article('a', 'Aurora Glass Review: hardware ambicioso com falhas'),
      article('b', 'Sony Aurora Glass e anunciado por 799 dolares'),
    ]
    assert.equal(groups(articles, result([['0:1', decision()]])).length, 0, 'editorial articles must not be semantically deleted')
  },
  () => {
    const title = 'Aurora Glass Review: hardware ambicioso com falhas'
    const articles = [article('a', title), article('b', title)]
    assert.equal(groups(articles, result([['0:1', decision({ merge: false })]], []))[0]?.articles.length, 2, 'exact editorial duplicates should still merge')
  },
  () => {
    const articles = [
      article('a', 'Nintendo confirma preco e lancamento do Switch 2'),
      article('b', 'Switch 2 tem preco e lancamento confirmados pela Nintendo'),
    ]
    assert.equal(groups(articles, result([['0:1', decision()]]))[0]?.articles.length, 2, 'same-source duplicates must remain eligible')
  },
  () => {
    const title = 'Festival Lophos confirma a programacao completa'
    const articles = [
      article('a', title, { published_at: '2026-08-18T00:00:00Z', cached_at: '2026-08-18T00:00:00Z' }),
      article('b', title, { published_at: '2026-08-19T12:00:00Z', cached_at: '2026-08-19T12:00:00Z' }),
    ]
    assert.equal(groups(articles, result([['0:1', decision({ merge: false, hoursApart: 36 })]], [])).length, 0, 'exact titles outside the time window must stay separate')
  },
  () => {
    const articles = [
      article('a', 'Aurora Glass chega ao mercado em outubro'),
      article('b', 'Sony confirma o lancamento do Aurora Glass'),
      article('c', 'Headset Aurora Glass sera vendido em outubro'),
    ]
    const duplicateGroups = groups(articles, result([
      ['0:1', decision({ semanticScore: 0.97 })],
      ['0:2', decision({ semanticScore: 0.94 })],
      ['1:2', decision({ semanticScore: 0.96 })],
    ], ['0:1', '1:2']))
    assert.equal(duplicateGroups[0]?.articles.length, 3, 'non-top-k cross-pairs should be used by complete-link validation')
  },
  () => {
    const articles = [
      article('a', 'Teresina realiza campanha nacional de multivacinacao'),
      article('b', 'Macae mobiliza salas para atualizar vacinacao infantil'),
    ]
    const tooBroad = decision({
      semanticScore: 0.95,
      titleSemanticScore: 0.88,
      sharedTitleTokens: [],
    })
    assert.equal(groups(articles, result([['0:1', tooBroad]])).length, 0, 'broad semantic similarity without title anchors must not delete articles')
  },
]

let failures = 0
for (const [index, run] of cases.entries()) {
  try {
    run()
    console.log(`PASS article-dedupe-${index + 1}`)
  } catch (error) {
    failures += 1
    console.error(`FAIL article-dedupe-${index + 1}: ${error.message}`)
  }
}

console.log(`result=${cases.length - failures}/${cases.length}`)
if (failures) process.exitCode = 1
