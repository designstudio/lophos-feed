'use client'

import { useEffect, useState } from 'react'

const CASES = [
  {
    topic: 'Economia',
    summary: 'Quatro notícias viram uma. Com contexto.',
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
    summary: 'Coberturas repetidas se juntam em uma história só.',
    sources: [
      { name: 'IGN', headline: 'Overwatch revela novo visual para Anran' },
      { name: 'GameSpot', headline: 'Comunidade pressiona e Blizzard ajusta heroína' },
      { name: 'Critical Hits', headline: 'Anran ganha redesign após críticas da fanbase' },
      { name: 'Kotaku', headline: 'Blizzard responde ao feedback sobre Anran' },
    ],
    result: 'Anran recebe redesign — 4 fontes · contexto + thread',
  },
  {
    topic: 'Filmes',
    summary: 'A notícia principal ganha contexto e um espaço para continuar.',
    sources: [
      { name: 'Collider', headline: 'Primal Darkness chega em streaming gratuito' },
      { name: 'Bloody Disgusting', headline: 'Found footage ganha estreia aberta ao público' },
      { name: 'MovieMaker', headline: 'Novo terror de criatura chega sem custo' },
      { name: 'Dread Central', headline: 'Onde assistir Primal Darkness agora' },
    ],
    result: 'Primal Darkness estreia grátis — 4 fontes · contexto + thread',
  },
  {
    topic: 'Tecnologia',
    summary: 'Mais sinal, menos ruído, com o essencial em um só lugar.',
    sources: [
      { name: 'TechCrunch', headline: 'Apple acelera rollout de recursos de IA' },
      { name: 'The Verge', headline: 'Nova fase da Apple Intelligence ganha detalhes' },
      { name: 'Canaltech', headline: 'Apple deve expandir IA em novos produtos' },
      { name: 'Engadget', headline: 'Executivos detalham estratégia de IA da Apple' },
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
    <div>
      <div className="mx-auto max-w-[820px] text-center">
        <h3 className="text-[2.7rem] font-semibold leading-[0.98] tracking-[-0.06em] text-ink-primary md:text-[4.6rem]">
          Várias fontes, uma única notícia.
        </h3>
      </div>

      <div className="mt-12 grid gap-6 xl:grid-cols-3">
        <div className="rounded-[30px] bg-bg-secondary p-7 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Como funciona</p>
          <p className="mt-5 text-[1.08rem] leading-8 text-ink-secondary md:text-[1.15rem]">
            O Lophos acompanha fontes diferentes, detecta quando várias matérias estão falando da mesma coisa e
            transforma isso em uma única notícia para você.
          </p>
        </div>

        <div className="rounded-[30px] bg-bg-secondary p-5 md:p-6">
          <div className="mb-5 flex flex-wrap gap-2">
            {CASES.map((item, itemIndex) => (
              <button
                key={item.topic}
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

          <div className="space-y-3">
            {current.sources.map((source) => (
              <div key={source.name} className="rounded-[22px] bg-white p-4 shadow-[0_1px_0_rgba(17,17,17,0.02)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">{source.name}</p>
                <p className="mt-2 text-[1rem] font-medium leading-6 text-ink-primary">{source.headline}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] bg-[#151515] p-6 text-white md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Lophos</p>
          <h4 className="mt-4 text-[1.85rem] font-semibold leading-[1.08] tracking-[-0.05em]">{current.result}</h4>
          <p className="mt-5 text-base leading-8 text-white/72">{current.summary}</p>
        </div>
      </div>
    </div>
  )
}
