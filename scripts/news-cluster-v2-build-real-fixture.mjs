/**
 * One-time, read-only Supabase fixture builder.
 * Labels below were manually reviewed from the near-miss and cluster reports.
 * The only write is the local JSON fixture file.
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { composeEventText } from './news-cluster-v2-core.mjs'
import { normalizeText } from './news-pipeline-core.mjs'
import { loadScriptEnvironment } from './script-env.mjs'

loadScriptEnvironment()

const SAME_EVENT = [
  ['bette the puppet introduced', 'saw genesis introduces bette'],
  ['bette the puppet introduced', 'video game will introduce a brand new puppet named bette'],
  ['saw genesis introduces bette', 'video game will introduce a brand new puppet named bette'],
  ['discord foi usado em ao menos 7 operacoes', 'discord em quatro anos ao menos sete operacoes'],
  ['quaest lula tem 43 e flavio bolsonaro 40', 'quaest 2 turno lula 43 flavio bolsonaro 40'],
  ['franca suspende lei que bania redes sociais', 'supremo tribunal da franca decide que proibir redes sociais'],
  ['mangione se declara culpado', 'luigi mangione admite em tribunal'],
  ['black mirror director turns down offer', 'harry potter hbo series lost 2 directors'],
  ['remove the watermark from gemini', 'visible watermarks'],
  ['lula diz que vencera eua pela narrativa', 'lula diz que vai vencer eua na narrativa'],
  ['modern warfare 4 beta will feature', 'modern warfare 4 beta will do something'],
  ['netflix orders sid zoey supernatural romance', 'netflix orders supernatural young adult series'],
  ['kingdom hearts is a billion dollar franchise', 'disney has 9 gaming franchises'],
  ['mark mckenna and stephen lang lead', 'stephen lang stars in music themed psychological thriller'],
  ['luigi mangione admits to shooting', 'luigi mangione admite em tribunal'],
  ['diretoras de black mirror e loki', 'harry potter hbo series lost 2 directors'],
  ['x files creator chris carter wanted', 'chris carter talks scarier'],
  ['terremoto na colombia numero de mortos sobe para 281', 'colombia sobe para 281 mortes'],
  ['como uma visita a uma ilha reacendeu', 'putin visita ilhas curilas'],
  ['brasil da inicio ao processo de reciprocidade', 'brasil abre processo para adotar reciprocidade'],
  ['o que e a lei da reciprocidade economica', 'brasil abre processo para adotar reciprocidade'],
  ['terremoto na colombia numero de mortos sobe para 281', 'colombia sobe para 273 mortes'],
  ['colombia sobe para 273 mortes', 'jornal nacional ouve relatos emocionados de sobreviventes do terremoto'],
  ['help build a monument', 'starbase is getting a few monuments'],
  ['juiz federal rejeita acao de trump contra harvard', 'justica dos eua rejeita acao de trump contra harvard'],
  ['matthew mcconaughey confirms he nearly played', 'matthew mcconaughey discusses passing on'],
  ['matthew mcconaughey confirms he nearly played', 'matthew mcconaughey explains why he turned down'],
  ['matthew mcconaughey discusses passing on', 'matthew mcconaughey explains why he turned down'],
  ['netflix closes two gaming studios', 'netflix is closing two game studios'],
  ['google lanca gemini 3 7 flash apenas', 'google lanca gemini 3 7 flash melhor'],
  ['ia pode adicionar quase r 1 tri', 'ia pode adicionar r 1 trilhao ao pib'],
  ['peacock reveals two new posters', 'crystal lake official posters'],
  ['openai is losing its second executive', 'openai shake up continues with second major departure'],
  ['skeet ulrich to play enigmatic cult leader', 'skeet ulrich to play a cult leader'],
  ['academy museum honors john carpenter', 'john carpenter colman domingo charlize theron'],
  ['quick behind the scenes promo for na hong', 'hope behind the scenes featurette'],
  ['dark hollow trailer unearths', 'dark hollow trailer unleashes'],
  ['the devils nc 17 re release', 'must see official trailer'],
  ['the devils nc 17 re release', 'the devils 4k restoration trailer brings'],
  ['the devils nc 17 re release', 'never before seen footage'],
  ['must see official trailer', 'the devils 4k restoration trailer brings'],
  ['must see official trailer', 'never before seen footage'],
  ['the devils 4k restoration trailer brings', 'never before seen footage'],
  ['tse adia debate sobre deepfakes', 'tse adia reuniao que discutiria proibicao'],
  ['scary first trailer for beware boiuna', 'beware boiuna trailer awakens'],
  ['ufo crashes in final invasion', 'to battle mutating extraterrestrial in final invasion'],
  ['final trailer for heart of the beast', 'heart of the beast official trailer 2'],
  ['jason voorhees revealed in first crystal lake', 'crystal lake official posters'],
  ['night school staff speak out', 'netflix closes two gaming studios'],
  ['night school staff speak out', 'netflix is closing two game studios'],
  ['scary first trailer for beware boiuna', 'beware boiuna trailer pits jessica rothe'],
  ['tv globinho volta a programacao', 'tv globinho volta com edicao especial'],
]

const HARD_DIFFERENT = [
  ['quaest lula tem 43 e flavio bolsonaro 40', 'quaest 48 desaprovam'],
  ['quaest lula tem 43 e flavio bolsonaro 40', 'quaest 33 apontam violencia'],
  ['governo lula ouvira empresarios', 'brasil notifica governo dos eua'],
  ['discord criptografia dificulta', 'discord demorou 25 minutos'],
  ['trump minimiza crise em porta avioes', 'lula diz que vencera eua pela narrativa'],
  ['mouse razer naga v3 pro', 'xiaomi anuncia hyperos 4'],
  ['terremoto na colombia governo anuncia reconstrucao', 'seis trabalhadores ficam presos apos explosao em mina'],
  ['google health now lets you remove', 'visible watermarks'],
  ['discord criptografia dificulta', 'discord em quatro anos ao menos sete operacoes'],
  ['ia chinesa pode ter superado a anthropic', 'xiaomi anuncia hyperos 4'],
  ['adolescente e apreendido apos esfaquear', 'historico do chatgpt entregou adolescente'],
  ['pokemon pokopia vende 5 milhoes', '1 milhao de copias em 1 semana'],
  ['kpop demon hunters sword', 'kpop demon hunters getting the criterion'],
  ['x files returns to comics', 'chris carter talks scarier'],
  ['xiaomi anuncia hyperos 4', 'one ui 9 5 vaza'],
  ['apple desenvolve modelo de ia', 'ia chinesa pode ter superado a anthropic'],
  ['eua ameacam ira com isolamento', 'vice de trump diz que principal objetivo'],
  ['pixel 11 pro is a slap', 'tensor g6 explained'],
  ['whatsapp testa reacoes', 'bumble muda regras'],
  ['macbook neo 2 pode ganhar', 'apple desenvolve modelo de ia'],
  ['five dinosaur movies to stream', 'the end of oak street ending'],
  ['end of oak street score gets vinyl', 'the end of oak street ending'],
  ['wolverine rodara a 60 fps', 'macbook neo 2 pode ganhar'],
  ['franca suspende lei que bania redes sociais', 'roblox is now the target'],
  ['pixel 11 pro xl vs galaxy', 'tensor g6 explained'],
  ['chatgpt que queria matar o filho', 'chatgpt vai lembrar'],
  ['netflix closes two more studios', 'separation from compulsion games'],
  ['trump e processado por vender', 'anpd suspende transmissoes'],
  ['the burger wars are heating', 'the rivals of amziah king review'],
  ['trump declares 100 percent tariffs', 'shane gillis expresses regret'],
]

const NEGATIVE_ANCHORS = [
  'franca suspende lei que bania redes sociais',
  'discord criptografia dificulta',
  'apple desenvolve modelo de ia',
  'xiaomi anuncia hyperos 4',
  'whatsapp testa reacoes',
  'bumble muda regras',
  'pokemon pokopia vende 5 milhoes',
  'kpop demon hunters sword',
  'x files returns to comics',
  'lua hoje confira a fase da lua desta sexta feira 14 08 2026',
  'terremoto na colombia numero de mortos sobe para 281',
  'dark hollow trailer unearths',
  'heart of the beast official trailer 2',
  'netflix closes two gaming studios',
  'google lanca gemini 3 7 flash apenas',
]

function folded(value) {
  return normalizeText(composeEventText({ title: value }))
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const since = '2026-08-12T00:00:00.000Z'
  const until = '2026-08-15T00:00:00.000Z'
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('raw_items')
      .select('title, summary, source_name, topic, pub_date')
      .gte('pub_date', since).lte('pub_date', until)
      .order('pub_date', { ascending: false }).range(offset, offset + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }

  const findItem = (needle) => {
    const target = folded(needle)
    const matches = rows.filter((row) => folded(row.title).includes(target))
    const distinctTitles = new Set(matches.map((row) => folded(row.title)))
    if (matches.length === 0 || distinctTitles.size !== 1) throw new Error(`Expected one title match for "${needle}", found ${matches.length} rows / ${distinctTitles.size} titles`)
    return matches[0]
  }

  const itemMap = new Map()
  const addItem = (needle) => {
    const row = findItem(needle)
    const key = folded(row.title)
    if (!itemMap.has(key)) itemMap.set(key, { key: `i${itemMap.size + 1}`, ...row })
    return itemMap.get(key).key
  }
  const pairs = []
  const addPair = (label, [left, right], provenance) => pairs.push({
    id: `p${pairs.length + 1}`,
    label,
    left: addItem(left),
    right: addItem(right),
    provenance,
  })
  SAME_EVENT.forEach((pair) => addPair('SAME_EVENT', pair, 'manual-real-cluster-or-near-miss'))
  HARD_DIFFERENT.forEach((pair) => addPair('DIFFERENT_EVENT', pair, 'manual-real-near-miss'))

  const anchors = NEGATIVE_ANCHORS.map(addItem)
  for (let left = 0; left < anchors.length && pairs.filter((pair) => pair.label === 'DIFFERENT_EVENT').length < 100; left += 1) {
    for (let right = left + 1; right < anchors.length && pairs.filter((pair) => pair.label === 'DIFFERENT_EVENT').length < 100; right += 1) {
      pairs.push({ id: `p${pairs.length + 1}`, label: 'DIFFERENT_EVENT', left: anchors[left], right: anchors[right], provenance: 'manual-real-distinct-event-anchor' })
    }
  }

  const fixture = {
    version: 1,
    createdAt: new Date().toISOString(),
    source: 'Supabase raw_items read-only snapshots from 2026-08-12 through 2026-08-15',
    labeling: 'Manual review of real cluster and near-miss reports; synthetic cases excluded.',
    items: [...itemMap.values()].map(({ key, title, summary, source_name, topic, pub_date }) => ({ key, title, summary: summary || '', source_name, topic, pub_date })),
    pairs,
  }
  const target = path.resolve('fixtures/news-cluster-v2-real-eval.json')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(fixture, null, 2)}\n`)
  console.log(`Wrote ${target}: items=${fixture.items.length} same=${pairs.filter((pair) => pair.label === 'SAME_EVENT').length} different=${pairs.filter((pair) => pair.label === 'DIFFERENT_EVENT').length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
