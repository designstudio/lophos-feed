import {
  DEFAULT_V2_OPTIONS,
  clusterItemsV2,
  composeEventText,
  embedEventTexts,
  loadLocalEmbeddingExtractor,
} from './news-cluster-v2-core.mjs'

const now = '2026-08-14T12:00:00Z'
const pair = (id, expectMerge, a, b) => ({ id, expectMerge, a: { id: `${id}-a`, pub_date: now, ...a }, b: { id: `${id}-b`, pub_date: '2026-08-14T14:00:00Z', ...b } })

const CASES = [
  pair('positive-pt-pt', true,
    { topic: 'cinema', source_name: 'Fonte A', title: 'Nintendo Switch 2 chega em junho por US$ 449', summary: 'Nintendo confirmou a data e o preço oficial do console nos Estados Unidos.' },
    { topic: 'tecnologia', source_name: 'Fonte B', title: 'Preço e lançamento do Switch 2 são revelados pela Nintendo', summary: 'O novo videogame será lançado em junho por 449 dólares no mercado americano.' }),
  pair('positive-pt-en', true,
    { topic: 'movies', source_name: 'Deadline', title: 'Curry Barker vai dirigir novo Massacre da Serra Elétrica', summary: 'A A24 confirmou o cineasta no próximo filme da franquia.' },
    { topic: 'horror', source_name: 'Bloody Disgusting', title: 'Curry Barker to direct new Texas Chainsaw Massacre movie', summary: 'A24 has confirmed Barker as director of the next franchise installment.' }),
  pair('positive-en-en', true,
    { topic: 'movies', source_name: 'Variety', title: 'Curry Barker Boards A24 Texas Chainsaw Massacre Film as Director', summary: 'The filmmaker will helm the studio next entry in the horror franchise.' },
    { topic: 'cultura', source_name: 'Collider', title: 'The Texas Chainsaw Massacre Is Back With Curry Barker Behind the Camera', summary: 'A24 selected Barker to direct the upcoming horror movie.' }),
  pair('positive-cross-topic', true,
    { topic: 'Tecnologia', source_name: 'Site A', title: 'Apple anuncia Vision Air por US$ 1.999', summary: 'Novo headset mais leve chega em outubro.' },
    { topic: 'entretenimento', source_name: 'Site B', title: 'Vision Air é o novo headset leve da Apple', summary: 'Produto anunciado custa 1.999 dólares e será lançado em outubro.' }),
  pair('positive-product', true,
    { topic: 'tech', source_name: 'The Verge', title: 'Sony unveils WH-1000XM7 headphones with longer battery life', summary: 'The new noise-canceling model costs $449 and launches Friday.' },
    { topic: 'gadgets', source_name: 'Engadget', title: 'Sony announces its $449 WH-1000XM7 noise-canceling headphones', summary: 'The latest headphones add battery life and go on sale Friday.' }),
  pair('negative-same-actor', false,
    { source_name: 'A', title: 'Pedro Pascal retorna em The Mandalorian', summary: 'Lucasfilm confirmou o ator na quarta temporada.' },
    { source_name: 'B', title: 'Pedro Pascal estrela Gladiador 2', summary: 'Ator integra o filme de Ridley Scott com Paul Mescal.' }),
  pair('negative-franchise-facts', false,
    { source_name: 'A', title: 'Marvel divulga trailer de Quarteto Fantástico', summary: 'Vídeo mostra os heróis em ação.' },
    { source_name: 'B', title: 'Quarteto Fantástico arrecada US$ 120 milhões', summary: 'Filme lidera a bilheteria no fim de semana.' }),
  pair('negative-company-products', false,
    { source_name: 'A', title: 'Apple anuncia novo MacBook Air M5', summary: 'Notebook chega em outubro com chip M5.' },
    { source_name: 'B', title: 'Apple apresenta iPhone 18 Pro', summary: 'Celular ganha novas câmeras e processador.' }),
  pair('negative-trailer-boxoffice', false,
    { source_name: 'A', title: 'Sinners ganha trailer final', summary: 'Warner divulga novo vídeo do filme.' },
    { source_name: 'B', title: 'Sinners supera US$ 100 milhões em bilheteria', summary: 'Longa alcança marca global nas salas.' }),
  pair('negative-renewal-casting', false,
    { source_name: 'A', title: 'Netflix renova Wednesday para terceira temporada', summary: 'Plataforma confirmou a continuação da série.' },
    { source_name: 'B', title: 'Lady Gaga entra no elenco de Wednesday', summary: 'Cantora foi contratada para papel na série da Netflix.' }),
  pair('negative-interview-hiring', false,
    { source_name: 'A', title: 'James Gunn fala sobre o futuro da DC em entrevista', summary: 'Executivo comentou seus planos para o estúdio.' },
    { source_name: 'B', title: 'Warner contrata James Gunn para comandar DC Studios', summary: 'Cineasta assume novo cargo na empresa.' }),
  pair('negative-platform-content', false,
    { source_name: 'A', title: 'Netflix cancela Squid Game após terceira temporada', summary: 'Série será encerrada pela plataforma.' },
    { source_name: 'B', title: 'Netflix renova Stranger Things para temporada final', summary: 'Produção retorna com novos episódios.' }),
  pair('negative-politics', false,
    { source_name: 'A', title: 'Senado aprova reforma tributária após votação', summary: 'Texto segue agora para sanção presidencial.' },
    { source_name: 'B', title: 'Presidente anuncia troca no Ministério da Fazenda', summary: 'Novo ministro assume o cargo na próxima semana.' }),
  pair('negative-similar-words-different-date', false,
    { source_name: 'A', title: 'Festival Lophos confirma edição para 12 de setembro de 2026', summary: 'Evento acontecerá em São Paulo.' },
    { source_name: 'B', title: 'Festival Lophos confirma edição para 18 de novembro de 2027', summary: 'Evento acontecerá no Rio de Janeiro.' }),
]

async function main() {
  const modelId = process.env.EMBEDDING_MODEL || DEFAULT_V2_OPTIONS.modelId
  const threshold = Number(process.env.EMBEDDING_MERGE_THRESHOLD || DEFAULT_V2_OPTIONS.semanticThreshold)
  const started = performance.now()
  const extractor = await loadLocalEmbeddingExtractor(modelId)
  const loadMs = performance.now() - started
  const items = CASES.flatMap((test) => [test.a, test.b])
  const embeddingStarted = performance.now()
  const vectors = await embedEventTexts(extractor, items.map(composeEventText))
  const titleVectors = await embedEventTexts(extractor, items.map((item) => item.title || ''))
  const embeddingMs = performance.now() - embeddingStarted
  let failures = 0

  console.log(`V2 synthetic precision suite | model=${modelId} threshold=${threshold}`)
  for (let index = 0; index < CASES.length; index += 1) {
    const test = CASES[index]
    const result = clusterItemsV2([test.a, test.b], vectors.slice(index * 2, index * 2 + 2), { semanticThreshold: threshold, titleVectors: titleVectors.slice(index * 2, index * 2 + 2) })
    const merged = result.clusters.length === 1
    const decision = result.clusters[0]?.merges?.[0] || result.pairDecisions.get('0:1')
    const ok = merged === test.expectMerge
    if (!ok) failures += 1
    console.log(`${ok ? 'PASS' : 'FAIL'} ${test.id}: expected=${test.expectMerge ? 'merge' : 'split'} got=${merged ? 'merge' : 'split'} score=${decision?.semanticScore?.toFixed(4) || '-'} reason=${decision?.reason || 'no accepted edge'} rare=[${decision?.rareTokens?.join(', ') || ''}]`)
  }
  console.log(`\nresult=${CASES.length - failures}/${CASES.length} | model_load=${(loadMs / 1000).toFixed(2)}s | embeddings=${(embeddingMs / 1000).toFixed(2)}s | throughput=${(items.length / (embeddingMs / 1000)).toFixed(2)} items/s`)
  if (failures) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
