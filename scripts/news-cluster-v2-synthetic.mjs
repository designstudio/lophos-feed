import {
  DEFAULT_V2_OPTIONS,
  SOURCE_ROLES,
  classifyEditorialSource,
  clusterItemsV2,
  clusterItemsV2WithRoles,
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
  pair('positive-summary-event-centrality', true,
    { source_name: 'IGN', title: 'First Trailer for Star Wars: Starfighter Shown at D23', summary: 'The Starfighter footage features Ryan Gosling piloting through a typhoon.' },
    { source_name: 'TheWrap', title: 'Ryan Gosling Star Wars: Starfighter First Look Features Typhoons', summary: 'The Starfighter first look was presented by director Shawn Levy and stars Ryan Gosling.' }),
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
  pair('negative-summary-event-conflict-without-factual-confirmation', false,
    { source_name: 'A', title: 'Solaris Legacy Gets Its First Trailer', summary: 'The studio released a trailer showing the science fiction colony.' },
    { source_name: 'B', title: 'Solaris Legacy Reaches a New Milestone', summary: 'The film crossed 150 million dollars at the worldwide box office.' }),
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

const ROLE_CLASSIFICATION_CASES = [
  {
    id: 'hard-news-primary',
    expectedRole: SOURCE_ROLES.PRIMARY,
    item: { title: 'First Frozen III Footage Teases New Villain at D23', summary: 'Disney showed the first footage and introduced the new villain.' },
  },
  {
    id: 'structured-roundup-supporting',
    expectedRole: SOURCE_ROLES.SUPPORTING,
    expectedKind: 'roundup',
    item: { title: 'Disney D23: Everything announced for Star Wars, Marvel, and more', summary: 'A roundup of trailers, casting news, and footage shown during the event.' },
  },
  {
    id: 'everything-is-not-a-single-word-rule',
    expectedRole: SOURCE_ROLES.PRIMARY,
    item: { title: 'Everything Everywhere All at Once sequel announced by A24', summary: 'The studio confirmed a sequel to the Oscar-winning film.' },
  },
  {
    id: 'analysis-supporting',
    expectedRole: SOURCE_ROLES.SUPPORTING,
    expectedKind: 'analysis',
    item: { title: "Who Needs Wolverine? Why We're Pumped for Marvel's X-Men Reboot", summary: 'An analysis of the newly revealed cast and creative direction.' },
  },
  {
    id: 'review-supporting',
    expectedRole: SOURCE_ROLES.SUPPORTING,
    expectedKind: 'review',
    item: { title: 'Sony Aurora Glass Review: ambitious hardware with rough edges', summary: 'We tested the newly released headset.' },
  },
  {
    id: 'factual-trailer-with-opinion-primary',
    expectedRole: SOURCE_ROLES.PRIMARY,
    item: { title: 'Special D23 Trailer for Avengers: Doomsday Still Looks Unexciting', summary: 'Marvel premiered a new Avengers: Doomsday trailer at D23.' },
  },
]

const ROLE_ITEMS = [
  { id: 'frozen-a', source_name: 'IGN', topic: 'movies', pub_date: now, title: 'Frozen 3 Footage Teases New Villain at D23', summary: 'Disney premiered the first Frozen III footage at D23, revealing Varek during a snowstorm in Arendelle.' },
  { id: 'frozen-b', source_name: 'TheWrap', topic: 'cinema', pub_date: '2026-08-14T12:20:00Z', title: 'First Frozen III Footage Reveals New Villain Varek', summary: 'The Frozen 3 footage introduced Varek attacking Arendelle during a magical snowstorm.' },
  { id: 'avengers-a', source_name: 'FirstShowing', topic: 'movies', pub_date: '2026-08-14T12:40:00Z', title: 'Special D23 Trailer for Avengers: Doomsday', summary: 'Marvel premiered a new Avengers Doomsday trailer during D23 with Doctor Doom facing the Avengers.' },
  { id: 'avengers-b', source_name: 'TheWrap', topic: 'cultura', pub_date: '2026-08-14T13:00:00Z', title: 'Avengers: Doomsday Trailer Debuts at D23', summary: 'A new Avengers Doomsday trailer premiered at D23 and showed Doctor Doom confronting the team.' },
  { id: 'd23-roundup', source_name: 'The Verge', topic: 'entertainment', pub_date: '2026-08-14T13:10:00Z', title: 'Disney D23: Everything announced for Star Wars, Marvel, Frozen, and more', summary: 'Disney showed Frozen III footage with villain Varek and premiered an Avengers Doomsday trailer with Doctor Doom, alongside many other announcements.' },
  { id: 'xmen-a', source_name: 'The Verge', topic: 'movies', pub_date: '2026-08-14T13:20:00Z', title: 'Marvel reveals the new X-Men cast at D23', summary: 'Marvel officially announced Connor Driver, Inde Navarrette, and Lola Tung as mutant recruits in the new X-Men reboot cast.' },
  { id: 'xmen-b', source_name: 'TheWrap', topic: 'cinema', pub_date: '2026-08-14T13:30:00Z', title: 'New X-Men Reboot Cast Includes Connor Driver and Inde Navarrette', summary: 'The X-Men reboot cast adds Connor Driver, Inde Navarrette, and Lola Tung as young mutant recruits.' },
  { id: 'xmen-analysis', source_name: 'IGN', topic: 'features', pub_date: '2026-08-14T14:00:00Z', title: "Who Needs Wolverine? Why We're Pumped for Marvel's X-Men Reboot", summary: 'We analyze Marvel new X-Men reboot after the D23 cast reveal of Connor Driver and Inde Navarrette.' },
  { id: 'aurora-a', source_name: 'TechOne', topic: 'tech', pub_date: '2026-08-14T14:10:00Z', title: 'Sony Announces Aurora Glass Headset for $799', summary: 'Sony unveiled the Aurora Glass mixed reality headset at D23 with an October launch date.' },
  { id: 'aurora-b', source_name: 'GadgetTwo', topic: 'gadgets', pub_date: '2026-08-14T14:20:00Z', title: 'Aurora Glass Is Sony New $799 Mixed Reality Headset', summary: 'The Sony Aurora Glass headset was announced for October and will cost 799 dollars.' },
  { id: 'aurora-review', source_name: 'ReviewsNow', topic: 'reviews', pub_date: '2026-08-14T14:30:00Z', title: 'Sony Aurora Glass Review: Ambitious Hardware With Rough Edges', summary: 'Our review tests Sony Aurora Glass mixed reality headset after its $799 October launch announcement.' },
  { id: 'moonfall-a', source_name: 'FilmOne', topic: 'movies', pub_date: '2026-08-14T14:40:00Z', title: 'Moonfall Legacy Gets First Trailer at D23', summary: 'The Moonfall Legacy trailer revealed astronaut Nia Vale commanding the Selene spacecraft on a lunar mission.' },
  { id: 'moonfall-b', source_name: 'FilmTwo', topic: 'cinema', pub_date: '2026-08-14T14:50:00Z', title: 'First Moonfall Legacy Trailer Reveals New Lunar Mission', summary: 'D23 debuted astronaut Nia Vale aboard the Selene spacecraft in the Moonfall Legacy trailer.' },
  { id: 'moonfall-analysis', source_name: 'FilmAnalysis', topic: 'features', pub_date: '2026-08-14T15:00:00Z', title: 'Why We Are Excited About Moonfall Legacy', summary: 'Our analysis explores the lunar mission shown in the first Moonfall Legacy trailer premiered at D23.' },
]

function roleClusterContaining(result, id) {
  return result.primaryClusters.find((cluster) => cluster.ids.includes(id))
}

function hasSupporting(cluster, id) {
  return Boolean(cluster?.supporting.some((entry) => entry.item.id === id))
}

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

  console.log('\nV2 source-role classification suite')
  for (const test of ROLE_CLASSIFICATION_CASES) {
    const profile = classifyEditorialSource(test.item)
    const ok = profile.role === test.expectedRole && (!test.expectedKind || profile.kind === test.expectedKind)
    if (!ok) failures += 1
    console.log(`${ok ? 'PASS' : 'FAIL'} ${test.id}: expected=${test.expectedRole}${test.expectedKind ? `/${test.expectedKind}` : ''} got=${profile.role}/${profile.kind} reasons=[${profile.reasons.join(', ')}]`)
  }

  const roleEmbeddingStarted = performance.now()
  const roleVectors = await embedEventTexts(extractor, ROLE_ITEMS.map(composeEventText))
  const roleTitleVectors = await embedEventTexts(extractor, ROLE_ITEMS.map((item) => item.title || ''))
  const roleEmbeddingMs = performance.now() - roleEmbeddingStarted
  const roleResult = clusterItemsV2WithRoles(ROLE_ITEMS, roleVectors, { semanticThreshold: threshold, titleVectors: roleTitleVectors })
  const frozen = roleClusterContaining(roleResult, 'frozen-a')
  const avengers = roleClusterContaining(roleResult, 'avengers-a')
  const xmen = roleClusterContaining(roleResult, 'xmen-a')
  const aurora = roleClusterContaining(roleResult, 'aurora-a')
  const moonfall = roleClusterContaining(roleResult, 'moonfall-a')
  const roleAssertions = [
    ['two-hard-news-same-fact', frozen?.ids.includes('frozen-b')],
    ['hard-news-plus-roundup', hasSupporting(frozen, 'd23-roundup')],
    ['two-events-cited-by-same-roundup-stay-distinct', frozen && avengers && frozen !== avengers && hasSupporting(avengers, 'd23-roundup')],
    ['roundup-with-multiple-announcements-never-primary', !roleResult.primaryClusters.some((cluster) => cluster.ids.includes('d23-roundup'))],
    ['hard-news-plus-analysis', xmen?.ids.includes('xmen-b') && hasSupporting(xmen, 'xmen-analysis')],
    ['casting-plus-opinion-on-reboot', hasSupporting(xmen, 'xmen-analysis')],
    ['review-plus-product-announcement', aurora?.ids.includes('aurora-b') && hasSupporting(aurora, 'aurora-review')],
    ['trailer-plus-film-analysis', moonfall?.ids.includes('moonfall-b') && hasSupporting(moonfall, 'moonfall-analysis')],
  ]
  console.log('\nV2 source-role cluster safety suite')
  for (const [id, passed] of roleAssertions) {
    const ok = Boolean(passed)
    if (!ok) failures += 1
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id}`)
  }
  if (roleAssertions.some(([, passed]) => !passed)) {
    console.log('role-debug primary-clusters=', roleResult.primaryClusters.map((cluster) => cluster.ids.join(',')))
    console.log('role-debug supporting-relations=', roleResult.supportRelations.filter((relation) => relation.attach).map((relation) => `${relation.supportingId}->${roleResult.primaryClusters[relation.primaryClusterIndex]?.ids.join('+')}(${relation.reason},${relation.semanticScore.toFixed(4)})`))
    for (const [key, decision] of roleResult.pairDecisions) {
      const [left, right] = key.split(':').map(Number)
      if (ROLE_ITEMS[left].id.endsWith('-a') && ROLE_ITEMS[right].id.endsWith('-b')) {
        console.log(`role-debug ${ROLE_ITEMS[left].id}/${ROLE_ITEMS[right].id}: merge=${decision.merge} score=${decision.semanticScore.toFixed(4)} lexical=${decision.lexicalScore.toFixed(3)} rare=[${decision.rareTokens.join(',')}] reason=${decision.reason}`)
      }
    }
  }
  console.log(`role events=${roleResult.eventClusters.length} support_attachments=${roleResult.eventClusters.reduce((sum, cluster) => sum + cluster.supporting.length, 0)}`)

  const totalCases = CASES.length + ROLE_CLASSIFICATION_CASES.length + roleAssertions.length
  const totalEmbeddingMs = embeddingMs + roleEmbeddingMs
  console.log(`\nresult=${totalCases - failures}/${totalCases} | model_load=${(loadMs / 1000).toFixed(2)}s | embeddings=${(totalEmbeddingMs / 1000).toFixed(2)}s | throughput=${((items.length + ROLE_ITEMS.length) * 2 / (totalEmbeddingMs / 1000)).toFixed(2)} vectors/s`)
  if (failures) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
