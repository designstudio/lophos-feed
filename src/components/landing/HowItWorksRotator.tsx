'use client'

import { useEffect, useState } from 'react'

const CASES = [
  {
    topic: 'Economia',
    title: 'Selic sobe 0,25 ponto',
    summary: 'Quatro noticias viram uma. Com contexto.',
    sources: [
      { name: 'G1', headline: 'Banco Central sobe juros pela terceira vez' },
      { name: 'Valor', headline: 'Selic sobe 0,25 ponto, diz Banco Central' },
      { name: 'InfoMoney', headline: 'Copom decide novo patamar da Selic' },
      { name: 'Exame', headline: 'Por que o BC voltou a aumentar os juros?' },
    ],
    result: 'Selic sobe 0,25 ponto — 4 fontes · contexto + thread',
  },
  {
    topic: 'Games',
    title: 'Anran recebe redesign',
    summary: 'Coberturas repetidas se juntam em uma historia so.',
    sources: [
      { name: 'IGN', headline: 'Overwatch revela novo visual para Anran' },
      { name: 'GameSpot', headline: 'Comunidade pressiona e Blizzard ajusta heroina' },
      { name: 'Critical Hits', headline: 'Anran ganha redesign apos criticas da fanbase' },
      { name: 'Kotaku', headline: 'Blizzard responde ao feedback sobre Anran' },
    ],
    result: 'Anran recebe redesign — 4 fontes · contexto + thread',
  },
  {
    topic: 'Filmes',
    title: 'Primal Darkness estreia gratis',
    summary: 'A noticia principal ganha contexto e um espaco para continuar.',
    sources: [
      { name: 'Collider', headline: 'Primal Darkness chega em streaming gratuito' },
      { name: 'Bloody Disgusting', headline: 'Found footage ganha estreia aberta ao publico' },
      { name: 'MovieMaker', headline: 'Novo terror de criatura chega sem custo' },
      { name: 'Dread Central', headline: 'Onde assistir Primal Darkness agora' },
    ],
    result: 'Primal Darkness estreia gratis — 4 fontes · contexto + thread',
  },
  {
    topic: 'Tecnologia',
    title: 'Apple prepara nova leva de IA',
    summary: 'Mais sinal, menos ruido, com o essencial em um so lugar.',
    sources: [
      { name: 'TechCrunch', headline: 'Apple acelera rollout de recursos de IA' },
      { name: 'The Verge', headline: 'Nova fase da Apple Intelligence ganha detalhes' },
      { name: 'Canaltech', headline: 'Apple deve expandir IA em novos produtos' },
      { name: 'Engadget', headline: 'Executivos detalham estrategia de IA da Apple' },
    ],
    result: 'Apple prepara nova leva de IA — 4 fontes · contexto + thread',
  },
] as const

export function HowItWorksRotator() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % CASES.length)
    }, 4200)

    return () => window.clearInterval(interval)
  }, [])

  const current = CASES[index]

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[28px] bg-bg-secondary p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Como funciona</p>
        <h3 className="mt-4 text-[2rem] font-semibold leading-[1.02] tracking-[-0.05em] text-ink-primary md:text-[3rem]">
          Explore o caminho completo de uma historia.
        </h3>
        <p className="mt-4 max-w-xl text-base leading-8 text-ink-secondary md:text-lg">
          O Lophos acompanha fontes diferentes, detecta quando varias materias estao falando da mesma coisa e transforma isso
          em uma leitura unica com contexto e thread.
        </p>

        <div className="mt-8 flex gap-2">
          {CASES.map((item, itemIndex) => (
            <button
              key={item.title}
              type="button"
              onClick={() => setIndex(itemIndex)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                itemIndex === index ? 'bg-ink-primary text-white' : 'bg-white text-ink-secondary'
              }`}
            >
              {item.topic}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[28px] bg-bg-secondary p-5 md:p-6">
          <div className="space-y-4">
            {current.sources.map((source) => (
              <div key={source.name} className="rounded-[22px] bg-white p-4 shadow-[0_1px_0_rgba(17,17,17,0.02)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">{source.name}</p>
                <p className="mt-2 text-[1rem] font-medium leading-6 text-ink-primary">{source.headline}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] bg-[#151515] p-5 text-white md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Lophos</p>
          <h4 className="mt-3 text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.04em]">{current.result}</h4>
          <p className="mt-4 text-base leading-8 text-white/72">{current.summary}</p>

          <div className="mt-8 rounded-[22px] bg-white/8 p-4">
            <p className="text-sm text-white/62">Resultado</p>
            <p className="mt-2 text-sm leading-7 text-white/80">
              Mesma historia, menos repeticao, mais contexto e um lugar pronto para aprofundar com perguntas.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
