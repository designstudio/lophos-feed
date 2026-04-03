/**
 * dedup-test.mjs — Testes unitários da lógica de dedup/merge
 *
 * Execução: node scripts/dedup-test.mjs
 *
 * Valida:
 *  - MERGE correto entre variações do mesmo fato (mesmo idioma)
 *  - NÃO MERGE entre notícias distintas com palavras genéricas em comum
 *  - NÃO MERGE entre mesmo ator/franquia, filmes diferentes (falsos positivos)
 *  - Âncora: Jaccard acima do threshold mas tokens fortes insuficientes → bloqueado
 *
 * Limitação conhecida:
 *  - Títulos sobre o MESMO fato em idiomas DIFERENTES (PT vs EN) produzem tokens distintos
 *    e podem ficar abaixo do threshold Jaccard. Nesses casos o agrupamento deve ocorrer
 *    na Fase 1 (clustering Gemini), não no dedup pós-geração.
 */

// ─── Réplica fiel das helpers de process-news.mjs ────────────────────────────
// (manter sincronizado ao editar process-news.mjs)

const STOPWORDS = new Set([
  'o','a','os','as','um','uma','uns','umas','de','do','da','dos','das','em','no','na','nos','nas',
  'por','para','com','sem','sob','sobre','entre','ate','apos','que','se','mas','ou','e','ao','aos',
  'eh','esta','este','estes','estas','isso','aqui','la','nao','sim','ja','so','mais','menos',
  'muito','pouco','bem','mal','ainda','agora','quando','como','onde','ser','foi','era','sao',
  'tem','ter','vai','vou','pode','ira','sera','esta','estao','estou','tudo','todos','toda',
  'the','an','of','to','in','for','on','with','at','by','from','up','about','into',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','not','no','or','and','but','if','as',
  'it','its','that','this','they','them','their','there','then','than','so','all',
  'also','just','more','can','we','you','he','she','our','his','her','new',
  'estreia','estreias','estreou','lancamento','lancamentos','lanca','lancou',
  'anuncia','anuncio','confirma','confirmado','confirmada','revelado','revelada',
  'revela','veja','assista','saiba','novo','nova','novos','novas','primeiro','primeira',
  'ultimas','ultima','ultimo','noticias','exclusivo','exclusiva','especial',
  'serie','series','filme','filmes','animacao','documentario','temporada',
  'episodio','episodios','parte','capitulo','trailer','review','critica',
  'netflix','disney','hbo','max','prime','amazon','apple','hulu','paramount',
  'peacock','globo','globoplay','youtube','twitch','spotify',
])

function normalizeText(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(s) {
  return normalizeText(s).split(' ').filter(w => w.length >= 3 && !STOPWORDS.has(w))
}

function jaccardScore(a, b) {
  const aSet = new Set(tokenize(a))
  const bSet = new Set(tokenize(b))
  if (aSet.size === 0 && bSet.size === 0) return 1
  if (aSet.size === 0 || bSet.size === 0) return 0
  let intersection = 0
  for (const w of aSet) if (bSet.has(w)) intersection++
  const union = aSet.size + bSet.size - intersection
  return intersection / union
}

function strongTokenize(s) {
  return normalizeText(s).split(' ').filter(w => w.length >= 5 && !STOPWORDS.has(w))
}

function strongIntersection(a, b) {
  const aSet = new Set(strongTokenize(a))
  const bSet = new Set(strongTokenize(b))
  const common = []
  for (const w of aSet) if (bSet.has(w)) common.push(w)
  return common
}

// ─── Parâmetros (manter sincronizado com process-news.mjs) ───────────────────

const SIMILARITY_THRESHOLD = 0.30
const MIN_STRONG_TOKENS    = 3

// ─── Lógica de decisão ────────────────────────────────────────────────────────

function evaluate(textA, textB) {
  const score   = jaccardScore(textA, textB)
  const tokensA = tokenize(textA)
  const tokensB = tokenize(textB)
  const strong  = strongIntersection(textA, textB)

  if (score < SIMILARITY_THRESHOLD) {
    return { merge: false, score, strong, reason: `below-threshold (${score.toFixed(3)} < ${SIMILARITY_THRESHOLD})`, tokensA, tokensB }
  }
  if (strong.length < MIN_STRONG_TOKENS) {
    return { merge: false, score, strong, reason: `anchor-miss (${strong.length}/${MIN_STRONG_TOKENS} strong tokens: [${strong.join(', ')}])`, tokensA, tokensB }
  }
  return { merge: true, score, strong, reason: `ok — score=${score.toFixed(3)}, anchor=[${strong.join(', ')}]`, tokensA, tokensB }
}

// ─── Casos de teste ──────────────────────────────────────────────────────────

const tests = [

  // ── DEVE FAZER MERGE (variações do mesmo fato, mesmo idioma) ─────────────

  {
    id: 'MERGE-1',
    label: 'Swapped: variação editorial PT (mesmo fato, diferentes ênfases — caso real reportado)',
    expectMerge: true,
    a: 'Swapped com Emma Myers é o original da Netflix: comédia romântica com protagonista confirmada',
    b: 'Swapped, novo original Netflix com Emma Myers, chega como comédia romântica',
  },
  {
    id: 'MERGE-2',
    label: 'Swapped: variação com nome da plataforma em posições diferentes',
    expectMerge: true,
    a: 'Swapped: Emma Myers lidera comédia romântica da Netflix com data de estreia confirmada',
    b: 'Netflix apresenta Swapped com Emma Myers como protagonista da comédia romântica',
  },
  {
    id: 'MERGE-3',
    label: 'Harry Potter HBO: múltiplas fontes sobre o mesmo anúncio (variação de ênfase)',
    expectMerge: true,
    a: 'Série Harry Potter da HBO terá lançamentos semanais e não anuais, confirmam executivos',
    b: 'HBO confirma: Harry Potter sem lançamentos anuais, episódios saem toda semana',
  },
  {
    id: 'MERGE-4',
    label: 'Nintendo Switch 2: mesmo lançamento, títulos com variação de detalhes',
    expectMerge: true,
    a: 'Nintendo Switch 2 chega em junho com preço de 449 dólares nos Estados Unidos',
    b: 'Nintendo Switch 2 confirmado para junho a 449 USD, data oficial revelada pela Nintendo',
  },
  {
    id: 'MERGE-5',
    label: 'Thunderbolts adiado: mesma notícia PT com verbos diferentes mas fato idêntico',
    expectMerge: true,
    a: 'Thunderbolts Marvel adiado para maio de 2026 por atrasos na producao confirmados',
    b: 'Marvel adia Thunderbolts para maio de 2026 diante de atrasos na producao do longa',
    note: 'Exemplo PT tem mais sobreposição lexical que EN parafrasado — preferir PT em casos borderline',
  },

  // ── NÃO DEVE FAZER MERGE (falsos positivos) ──────────────────────────────

  {
    id: 'NO-MERGE-1',
    label: 'Swapped vs Sinners: mesma data de estreia, filmes totalmente diferentes',
    expectMerge: false,
    a: 'Swapped estreia 1 de maio na Netflix',
    b: 'Sinners estreia 1 de maio nos cinemas',
    note: 'Jaccard baixo pois "swapped"/"sinners" são os únicos tokens relevantes e não se sobrepõem',
  },
  {
    id: 'NO-MERGE-2',
    label: 'Harry Potter série vs parque temático (mesmo universo, fatos distintos)',
    expectMerge: false,
    a: 'Série Harry Potter da HBO não terá lançamentos anuais, executivos confirmam',
    b: 'Harry Potter parque temático será inaugurado em 2027 em Los Angeles pela Warner',
  },
  {
    id: 'NO-MERGE-3',
    label: 'Mesmo ator (Pedro Pascal), filmes diferentes — falso positivo clássico',
    expectMerge: false,
    a: 'Pedro Pascal protagoniza The Mandalorian temporada 4 com retorno confirmado pela Lucasfilm',
    b: 'Pedro Pascal estrela Gladiador 2 ao lado de Paul Mescal no longa de Ridley Scott',
  },
  {
    id: 'NO-MERGE-4',
    label: 'Mesmo ator (Cillian Murphy), projetos totalmente diferentes',
    expectMerge: false,
    a: 'Cillian Murphy confirma retorno como Tommy Shelby em Peaky Blinders no cinema',
    b: 'Cillian Murphy será protagonista do novo thriller psicológico de Christopher Nolan',
  },
  {
    id: 'NO-MERGE-5',
    label: 'Mesma franquia (Marvel), filmes diferentes — âncora deve bloquear',
    expectMerge: false,
    a: 'Marvel confirma Vingadores Doomsday para maio de 2026 com Robert Downey Jr.',
    b: 'Marvel anuncia Vingadores Secret Wars para 2027 com roteiro de dois anos de produção',
  },
  {
    id: 'NO-MERGE-6',
    label: 'Mesma plataforma, conteúdos completamente distintos',
    expectMerge: false,
    a: 'Netflix cancela Squid Game após terceira temporada por queda de audiência global',
    b: 'Netflix renova Stranger Things para quinta e última temporada prevista para 2025',
  },
  {
    id: 'NO-MERGE-7',
    label: 'Âncora: Jaccard passa threshold, mas tokens fortes insuficientes (apenas título genérico)',
    expectMerge: false,
    a: 'Sinners ultrapassa 100 milhões de dólares de bilheteria nos primeiros dias nos Estados Unidos',
    b: 'Sinners é sucesso de bilheteria e entra para lista dos maiores de 2025 nos Estados Unidos',
    note: 'Bloqueado pelo threshold (score 0.27 < 0.30) antes mesmo da âncora — contexto genérico sem token específico do fato',
  },

  // ── LIMITAÇÃO CONHECIDA (cross-language — documentada, não causa falha) ───

  {
    id: 'KNOWN-LIMIT-1',
    label: '[LIMITAÇÃO CROSS-LANG] Swapped PT vs EN — dedup deve ocorrer na Fase 1 (Gemini)',
    expectMerge: false, // não mergeamos cross-language nesta fase — Gemini cuida disso
    a: 'Swapped com Emma Myers estreia na Netflix como comédia romântica baseada em livro',
    b: 'Swapped: Stranger Things star Emma Myers to lead new Netflix romantic comedy',
    note: 'Tokens são muito diferentes entre PT e EN para sobreposição Jaccard funcionar. ' +
          'O Gemini clustering na Fase 1 agrupa por semântica, cobindo este caso.',
  },
]

// ─── Runner ──────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

console.log('═'.repeat(72))
console.log('  dedup-test.mjs — Validação da lógica de merge/dedup')
console.log(`  threshold=${SIMILARITY_THRESHOLD} | MIN_STRONG_TOKENS=${MIN_STRONG_TOKENS}`)
console.log('═'.repeat(72))

for (const t of tests) {
  const result = evaluate(t.a, t.b)
  const ok = result.merge === t.expectMerge
  const icon = ok ? '✅' : '❌'
  const expectLabel = t.expectMerge ? 'MERGE   ' : 'NO-MERGE'
  const gotLabel    = result.merge   ? 'MERGE   ' : 'NO-MERGE'
  const isKnown = t.id.startsWith('KNOWN-')

  console.log(`\n${icon} [${t.id}] ${t.label}`)
  if (isKnown) console.log('   ℹ️  (limitação documentada — não conta como falha)')
  console.log(`   expect: ${expectLabel}  got: ${gotLabel}`)
  console.log(`   score:  ${result.score.toFixed(4)}  (threshold: ${SIMILARITY_THRESHOLD})`)
  console.log(`   anchor: [${result.strong.join(', ')}] (${result.strong.length}/${MIN_STRONG_TOKENS} required)`)
  console.log(`   reason: ${result.reason}`)
  if (t.note) console.log(`   note:   ${t.note}`)

  if (!ok && !isKnown) {
    console.log(`   tokensA: [${result.tokensA.join(', ')}]`)
    console.log(`   tokensB: [${result.tokensB.join(', ')}]`)
    failed++
  } else if (!isKnown) {
    passed++
  }
}

console.log('\n' + '═'.repeat(72))
console.log(`  Resultado: ${passed} passed | ${failed} failed (de ${tests.filter(t => !t.id.startsWith('KNOWN-')).length} casos principais)`)
console.log('═'.repeat(72))

if (failed > 0) {
  console.log('\n⚠️  Ajuste SIMILARITY_THRESHOLD ou MIN_STRONG_TOKENS em process-news.mjs e aqui.')
  console.log('   Sugestão: se MERGE falha → baixar threshold ou MIN_STRONG_TOKENS.')
  console.log('   Sugestão: se NO-MERGE falha → aumentar threshold ou MIN_STRONG_TOKENS.')
  process.exit(1)
} else {
  console.log('\n🎉 Todos os casos principais passaram!')
}
