/**
 * news-embedding-test.mjs
 *
 * Benchmarks embeddings against the current lexical dedupe/clustering logic.
 *
 * What this checks:
 * - semantic duplicates across PT / EN / IT
 * - clustering behavior on a small mixed-language batch
 * - why promo / gambling rules should stay as hard filters
 *
 * Run:
 *   node scripts/news-embedding-test.mjs
 *
 * Optional env:
 *   EMBEDDING_MODEL=intfloat/multilingual-e5-small
 *   EMBEDDING_MERGE_THRESHOLD=0.82
 */

import {
  clusterDeterministicItems,
  strongIntersection,
  textOverlapScore,
} from './news-pipeline-core.mjs'

const MODEL_ID = process.env.EMBEDDING_MODEL || 'Xenova/multilingual-e5-small'
const DEFAULT_MERGE_THRESHOLD = Number(process.env.EMBEDDING_MERGE_THRESHOLD || 0.82)
const INPUT_MODE = process.env.EMBEDDING_INPUT_MODE || 'title-summary'

const PAIR_CASES = [
  {
    id: 'PT-PT-1',
    label: 'Same fact in PT with editorial variation',
    expectMerge: true,
    titleA: 'Nintendo Switch 2 chega em junho com preco de 449 dolares nos Estados Unidos',
    summaryA: 'A Nintendo confirmou a janela de lancamento e o preco oficial do console nos Estados Unidos.',
    titleB: 'Nintendo Switch 2 confirmado para junho a 449 USD, data oficial revelada pela Nintendo',
    summaryB: 'A empresa revelou a data e o valor do novo videogame para o mercado americano.',
  },
  {
    id: 'PT-EN-1',
    label: 'Same fact PT vs EN',
    expectMerge: true,
    titleA: 'Swapped com Emma Myers e o original da Netflix: comedia romantica com protagonista confirmada',
    summaryA: 'A producao original da Netflix aposta em uma comedia romantica com Emma Myers no papel principal.',
    titleB: 'Swapped, new Netflix original with Emma Myers, arrives as a romantic comedy',
    summaryB: 'Netflix presents the film as a romantic comedy led by Emma Myers.',
  },
  {
    id: 'PT-IT-1',
    label: 'Same fact PT vs IT',
    expectMerge: true,
    titleA: 'Serie Harry Potter da HBO tera lancamentos semanais e nao anuais, confirmam executivos',
    summaryA: 'Os executivos da HBO disseram que a nova serie sera exibida semanalmente.',
    titleB: 'La serie HBO di Harry Potter avra uscite settimanali e non annuali, confermano i dirigenti',
    summaryB: 'I dirigenti HBO hanno confermato un rilascio settimanale della serie.',
  },
  {
    id: 'NEG-1',
    label: 'Same actor, different works',
    expectMerge: false,
    titleA: 'Pedro Pascal protagoniza The Mandalorian temporada 4 com retorno confirmado pela Lucasfilm',
    summaryA: 'A noticia trata do retorno do ator em Star Wars e da confirmacao da Lucasfilm.',
    titleB: 'Pedro Pascal estrela Gladiador 2 ao lado de Paul Mescal no longa de Ridley Scott',
    summaryB: 'O filme de Ridley Scott traz Pedro Pascal no elenco ao lado de Paul Mescal.',
  },
  {
    id: 'NEG-2',
    label: 'Same platform, different titles',
    expectMerge: false,
    titleA: 'Netflix cancela Squid Game apos terceira temporada por queda de audiencia global',
    summaryA: 'A plataforma teria encerrado a serie depois da terceira temporada.',
    titleB: 'Netflix renova Stranger Things para quinta e ultima temporada prevista para 2025',
    summaryB: 'A nova temporada encerra a historia de Stranger Things em 2025.',
  },
  {
    id: 'NEG-3',
    label: 'Promo should not rely on embeddings',
    expectMerge: false,
    titleA: 'Promoacao de 50% no plano premium por tempo limitado, aproveite agora',
    summaryA: 'Oferta promocional e desconto por tempo limitado.',
    titleB: 'Netflix confirma nova serie com Emma Myers e estreia marcada para junho',
    summaryB: 'A serie e uma producao original com estreia marcada para junho.',
  },
  {
    id: 'NEG-4',
    label: 'Gambling should remain a hard rule',
    expectMerge: false,
    titleA: 'Cassino online oferece bonus sem deposito para novos jogadores',
    summaryA: 'Oferta ligada a apostas e bonus de cadastro.',
    titleB: 'Nintendo Switch 2 chega em junho com preco de 449 dolares nos Estados Unidos',
    summaryB: 'A Nintendo confirmou a janela de lancamento e o preco oficial do console.',
  },
]

const CLUSTER_CASES = [
  {
    id: 'cluster-switch-pt',
    cluster: 'switch-2',
    title: 'Nintendo Switch 2 chega em junho com preco de 449 dolares nos Estados Unidos',
    summary: 'A Nintendo confirmou a janela de lancamento e o preco oficial do console nos Estados Unidos.',
    source_name: 'source-a',
  },
  {
    id: 'cluster-switch-en',
    cluster: 'switch-2',
    title: 'Nintendo Switch 2 confirmed for June with a 449 USD price tag in the United States',
    summary: 'Nintendo confirmed the launch window and the official price for the console.',
    source_name: 'source-b',
  },
  {
    id: 'cluster-switch-it',
    cluster: 'switch-2',
    title: 'Nintendo Switch 2 arriva a giugno con prezzo di 449 dollari negli Stati Uniti',
    summary: 'Nintendo ha confermato la finestra di lancio e il prezzo ufficiale della console.',
    source_name: 'source-c',
  },
  {
    id: 'cluster-mandalorian',
    cluster: 'mandalorian',
    title: 'Pedro Pascal retorna em The Mandalorian temporada 4 com a Lucasfilm confirmando o elenco',
    summary: 'A noticia trata do retorno do ator em Star Wars e da confirmacao da Lucasfilm.',
    source_name: 'source-d',
  },
  {
    id: 'cluster-gladiator',
    cluster: 'gladiator-2',
    title: 'Pedro Pascal estrela Gladiador 2 ao lado de Paul Mescal no longa de Ridley Scott',
    summary: 'O filme de Ridley Scott traz Pedro Pascal no elenco ao lado de Paul Mescal.',
    source_name: 'source-e',
  },
  {
    id: 'cluster-promo',
    cluster: 'promo-block',
    title: 'Promoacao de 50% no plano premium por tempo limitado, aproveite agora',
    summary: 'Oferta promocional e desconto por tempo limitado.',
    source_name: 'source-f',
  },
]

function cosineSimilarity(a, b) {
  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function composeInputText(item) {
  if (INPUT_MODE === 'title-only') {
    return item.title || ''
  }

  if (INPUT_MODE === 'title-summary') {
    return [item.title, item.summary].filter(Boolean).join(' ')
  }

  return item.text || [item.title, item.summary, item.content].filter(Boolean).join(' ')
}

function normalizeVector(output) {
  if (!output) {
    throw new Error('Empty embedding output')
  }

  if (Array.isArray(output)) {
    return Array.isArray(output[0]) ? output[0] : output
  }

  if (typeof output.tolist === 'function') {
    const list = output.tolist()
    return Array.isArray(list?.[0]) ? list[0] : list
  }

  if (output.data) {
    return Array.from(output.data)
  }

  throw new Error('Unsupported embedding output shape')
}

async function loadExtractor() {
  let pipeline
  try {
    ({ pipeline } = await import('@xenova/transformers'))
  } catch (error) {
    console.error('Missing dependency: @xenova/transformers')
    console.error('Run: npm install')
    throw error
  }

  return pipeline('feature-extraction', MODEL_ID, { quantized: true })
}

async function embedText(extractor, text) {
  const output = await extractor(`query: ${text}`, {
    pooling: 'mean',
    normalize: true,
  })
  return normalizeVector(output)
}

async function embedMany(extractor, texts) {
  const vectors = []
  for (const text of texts) {
    vectors.push(await embedText(extractor, text))
  }
  return vectors
}

function lexicalDecision(a, b, threshold = 0.3, minStrongTokens = 3) {
  const score = textOverlapScore(a, b)
  const strong = strongIntersection(a, b)
  return {
    merge: score >= threshold && strong.length >= minStrongTokens,
    score,
    strong,
  }
}

function bestThreshold(cases, scoredCases) {
  let best = {
    threshold: 0,
    correct: -1,
    precision: 0,
    recall: 0,
    f1: 0,
  }

  for (let threshold = 0.5; threshold <= 0.99; threshold += 0.005) {
    let tp = 0
    let fp = 0
    let fn = 0
    let tn = 0

    for (const scored of scoredCases) {
      const predicted = scored.score >= threshold
      const expected = scored.case.expectMerge

      if (predicted && expected) tp++
      else if (predicted && !expected) fp++
      else if (!predicted && expected) fn++
      else tn++
    }

    const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
    const correct = tp + tn

    if (correct > best.correct || (correct === best.correct && f1 > best.f1)) {
      best = { threshold, correct, precision, recall, f1 }
    }
  }

  return best
}

function greedyCluster(items, vectors, threshold) {
  const clusters = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const vector = vectors[i]
    let bestCluster = null
    let bestScore = -1

    for (const cluster of clusters) {
      const score = cosineSimilarity(vector, cluster.centroid)
      if (score > bestScore) {
        bestScore = score
        bestCluster = cluster
      }
    }

    if (!bestCluster || bestScore < threshold) {
      clusters.push({
        ids: [item.id],
        clusterNames: [item.cluster],
        centroid: vector.slice(),
      })
      continue
    }

    bestCluster.ids.push(item.id)
    bestCluster.clusterNames.push(item.cluster)

    const memberVectors = bestCluster.members
      ? [...bestCluster.members, vector]
      : [bestCluster.centroid, vector]

    bestCluster.members = memberVectors
    const centroid = new Array(vector.length).fill(0)
    for (const member of memberVectors) {
      for (let j = 0; j < member.length; j++) {
        centroid[j] += member[j]
      }
    }
    const scale = 1 / memberVectors.length
    for (let j = 0; j < centroid.length; j++) centroid[j] *= scale
    const norm = Math.sqrt(centroid.reduce((sum, value) => sum + value * value, 0)) || 1
    bestCluster.centroid = centroid.map((value) => value / norm)
  }

  return clusters.map((cluster) => ({
    ids: cluster.ids,
    clusterNames: cluster.clusterNames,
  }))
}

function printPairSummary(label, rows) {
  console.log(`\n${label}`)
  for (const row of rows) {
    const score = row.score.toFixed(4)
    const strong = row.strong?.join(', ') || '-'
    const verdict = row.predicted === row.case.expectMerge ? 'OK' : 'MISS'
    const titleA = row.case.titleA || row.case.a || 'N/A'
    const titleB = row.case.titleB || row.case.b || 'N/A'
    const summaryA = row.case.summaryA || ''
    const summaryB = row.case.summaryB || ''
    console.log(`- [${row.case.id}] ${verdict} score=${score} expected=${row.case.expectMerge ? 'merge' : 'split'} predicted=${row.predicted ? 'merge' : 'split'} strong=[${strong}]`)
    console.log(`  A: ${titleA}${summaryA ? ` | ${summaryA}` : ''}`)
    console.log(`  B: ${titleB}${summaryB ? ` | ${summaryB}` : ''}`)
  }
}

async function main() {
  const extractor = await loadExtractor()

  console.log('='.repeat(80))
  console.log(`  Embedding benchmark using ${MODEL_ID}`)
  console.log('='.repeat(80))
  console.log('\nReminder: promo / gambling / deal filters should stay rule-based. Embeddings help with semantic duplicates and clustering, not hard policy blocks.')

  const pairTexts = [...new Set(PAIR_CASES.flatMap((item) => [
    composeInputText({ title: item.titleA, summary: item.summaryA }),
    composeInputText({ title: item.titleB, summary: item.summaryB }),
  ]))]
  const pairVectors = new Map()
  for (const text of pairTexts) {
    pairVectors.set(text, await embedText(extractor, text))
  }

  const scoredCases = PAIR_CASES.map((testCase) => {
    const aText = composeInputText({ title: testCase.titleA, summary: testCase.summaryA })
    const bText = composeInputText({ title: testCase.titleB, summary: testCase.summaryB })
    const aVector = pairVectors.get(aText)
    const bVector = pairVectors.get(bText)
    const score = cosineSimilarity(aVector, bVector)
    const lexical = lexicalDecision(aText, bText)
    return {
      case: testCase,
      score,
      lexicalMerge: lexical.merge,
      lexicalScore: lexical.score,
      lexicalStrong: lexical.strong,
      predicted: score >= DEFAULT_MERGE_THRESHOLD,
      strong: strongIntersection(aText, bText),
    }
  })

  const threshold = bestThreshold(PAIR_CASES, scoredCases)

  console.log('\nPair evaluation')
  console.log(`- default embedding threshold: ${DEFAULT_MERGE_THRESHOLD.toFixed(3)}`)
  console.log(`- best threshold on this sample: ${threshold.threshold.toFixed(3)} (correct=${threshold.correct}/${PAIR_CASES.length}, precision=${threshold.precision.toFixed(3)}, recall=${threshold.recall.toFixed(3)}, f1=${threshold.f1.toFixed(3)})`)

  printPairSummary('Lexical baseline vs embeddings', scoredCases.map((row) => ({
    ...row,
    predicted: row.lexicalMerge,
    score: row.lexicalScore,
    strong: row.lexicalStrong,
  })))

  printPairSummary('Embedding decision at best threshold', scoredCases.map((row) => ({
    ...row,
    predicted: row.score >= threshold.threshold,
  })))

  const lexicalCorrect = scoredCases.filter((row) => row.lexicalMerge === row.case.expectMerge).length
  const embeddingCorrect = scoredCases.filter((row) => (row.score >= threshold.threshold) === row.case.expectMerge).length

  console.log('\nSummary')
  console.log(`- lexical baseline: ${lexicalCorrect}/${PAIR_CASES.length}`)
  console.log(`- embeddings:       ${embeddingCorrect}/${PAIR_CASES.length}`)

  const clusterVectors = await embedMany(extractor, CLUSTER_CASES.map((item) => composeInputText(item)))
  const embeddingClusters = greedyCluster(CLUSTER_CASES, clusterVectors, threshold.threshold)
  const lexicalClusters = clusterDeterministicItems(
    CLUSTER_CASES.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.summary || '',
      source_name: item.source_name,
    })),
    { similarityThreshold: 0.3, minStrongTokens: 3 },
  )

  console.log('\nCluster demo')
  console.log(`- lexical clusters:   ${lexicalClusters.length}`)
  lexicalClusters.forEach((cluster, index) => {
    console.log(`  [lex ${index + 1}] ${cluster.join(', ')}`)
  })

  console.log(`- embedding clusters: ${embeddingClusters.length}`)
  embeddingClusters.forEach((cluster, index) => {
    const labels = cluster.clusterNames.join(', ')
    const items = cluster.ids
      .map((id) => {
        const item = CLUSTER_CASES.find((caseItem) => caseItem.id === id)
        if (!item) return id
        const title = item.title || 'N/A'
        const summary = item.summary ? ` | ${item.summary}` : ''
        return `${title}${summary}`
      })
      .join(' || ')
    console.log(`  [emb ${index + 1}] ${cluster.ids.join(', ')} | labels=${labels}`)
    console.log(`    ${items}`)
  })

  console.log('\nInterpretation')
  console.log('- If embeddings capture the PT/EN/IT Switch 2 cases together, they are helping the false negatives you saw.')
  console.log('- The promo and gambling examples should still be blocked before clustering, because similarity alone is not a policy filter.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
