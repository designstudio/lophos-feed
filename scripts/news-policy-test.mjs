import assert from 'node:assert/strict'
import { shouldRejectPreflightItem } from './news-pipeline-core.mjs'

const acceptedCases = [
  {
    title: 'AI proptech startup EliseAI is in talks to raise a new round of funding at a $3.7 billion valuation',
    description: 'Investors see the company as a big bet on autonomous construction technology.',
  },
  { title: 'Memristores: os chips que imitam o cérebro' },
  { title: "KPop Demon Hunters Enters The Criterion Collection This November" },
  {
    title: 'Apple lança iOS 26.6.1 com correção para mais de 20 falhas de segurança',
    description: 'A atualização também chega a aparelhos antigos, incluindo iPhone 11, e corrige componentes Intel.',
  },
  { title: "'Homem-Aranha: Um novo dia' entra para top 10 de maiores bilheterias da história; veja lista" },
  {
    title: 'Casas Bahia pede recuperação judicial: entenda a crise da varejista',
    description: 'A empresa apresentou uma oferta aos credores durante a negociação.',
  },
  { title: 'Discord suspende lives no Brasil após ordem da ANPD' },
  { title: '27 new COVID cases in Singapore, including 1 in community' },
  { title: "Lanterns Is Replacing House of the Dragon in HBO's Sunday Slot This Weekend" },
  { title: 'Filme mostra um Japão distópico que encoraja a eutanásia dos idosos' },
  { title: 'Jeep Avenger é o híbrido mais barato do Brasil por R$ 114.990' },
  {
    title: 'Will Green Day ever make the American Idiot movie or a full biopic?',
    description: 'The band discussed a poker scene and called the project a safe bet.',
  },
  { title: "'Roleta russa': trend na Irlanda provoca acidentes com mortes" },
]

const rejectedCases = [
  { title: 'Cupom Mercado Livre | Até 80% off', reason: 'blocked-deal' },
  { title: 'The 10 British universities with the most American students, ranked', reason: 'blocked-listicle' },
  { title: 'Best Apple Watch in 2026', reason: 'blocked-listicle' },
  { title: 'Where to watch the Cincinnati Open: Live streams, venue, players, and more', reason: 'blocked-listicle' },
  { title: "I've tried 10 wireless earbuds and ranked the best models", reason: 'blocked-listicle' },
  { title: 'Top 10 online casinos with no deposit bonus', reason: 'blocked-gambling' },
  { title: 'Best online slots and betting sites with casino bonus', reason: 'blocked-gambling' },
  { title: 'Originally published: the history of the first MacBook', reason: 'blocked-stale-launch' },
]

for (const item of acceptedCases) {
  const decision = shouldRejectPreflightItem(item)
  assert.equal(decision.reject, false, `expected accepted: ${item.title} (${decision.reason})`)
}

for (const item of rejectedCases) {
  const decision = shouldRejectPreflightItem(item)
  assert.equal(decision.reject, true, `expected rejected: ${item.title}`)
  assert.equal(decision.reason, item.reason, `unexpected reason for: ${item.title}`)
}

console.log(`PASS news policy: accepted=${acceptedCases.length} rejected=${rejectedCases.length}`)
