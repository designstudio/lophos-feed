'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

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

const CARD_HEIGHT = 'h-[23.375rem]'

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
          <span className="block">Várias fontes</span>
          <span className="block">uma única notícia</span>
        </h3>
      </div>

      <div className="mt-12 grid gap-6 xl:grid-cols-3">
        <article className={`rounded-[30px] bg-bg-secondary p-5 md:p-6 ${CARD_HEIGHT}`}>
          <div className="flex h-full items-center justify-center">
            <div className="w-full max-w-[17.5rem] rounded-[26px] bg-white p-6 shadow-[0_20px_50px_rgba(17,17,17,0.06)]">
              <p className="text-[1.45rem] font-semibold leading-tight tracking-[-0.04em] text-ink-primary">
                Como funciona
              </p>
              <p className="mt-4 text-[0.98rem] leading-7 text-ink-secondary">
                O Lophos acompanha fontes diferentes, detecta quando várias matérias estão falando da mesma coisa e
                transforma isso em uma única notícia para você.
              </p>
            </div>
          </div>
        </article>

        <article className={`rounded-[30px] bg-bg-secondary p-5 md:p-6 ${CARD_HEIGHT}`}>
          <div className="flex h-full items-center justify-center">
            <div className="flex h-full w-full max-w-[18rem] flex-col overflow-hidden rounded-[26px] bg-white shadow-[0_20px_50px_rgba(17,17,17,0.06)]">
              <div className="border-b border-border px-4 pb-3 pt-4">
                <div className="flex flex-wrap gap-2">
                  {CASES.map((item, itemIndex) => (
                    <button
                      key={item.topic}
                      type="button"
                      onClick={() => setIndex(itemIndex)}
                      className={`rounded-full px-3 py-1.5 text-[0.78rem] font-medium transition-opacity ${
                        itemIndex === index ? 'bg-ink-primary text-white' : 'bg-bg-secondary text-ink-secondary hover:opacity-70'
                      }`}
                    >
                      {item.topic}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-hidden px-4 py-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.topic}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="space-y-3"
                  >
                    {current.sources.map((source) => (
                      <div key={source.name} className="rounded-[18px] bg-bg-secondary px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">{source.name}</p>
                        <p className="mt-2 text-[0.92rem] font-medium leading-6 text-ink-primary">{source.headline}</p>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </article>

        <article className={`rounded-[30px] bg-bg-secondary p-5 md:p-6 ${CARD_HEIGHT}`}>
          <div className="flex h-full items-center justify-center">
            <div className="relative flex h-full w-full max-w-[18rem] items-center justify-center overflow-hidden rounded-[26px] bg-[#151515] px-5 py-6 text-white shadow-[0_20px_50px_rgba(17,17,17,0.08)]">
              <motion.div
                className="absolute inset-x-10 top-[4.3rem] h-px bg-white/15"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.25, 0.6, 0.25] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />

              <div className="relative flex w-full flex-col items-center">
                <div className="flex w-full items-start justify-between">
                  <motion.div
                    className="flex w-[5.4rem] flex-col gap-2"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {current.sources.slice(0, 3).map((source) => (
                      <div key={source.name} className="rounded-full bg-white/10 px-3 py-1.5 text-center text-[0.68rem] font-medium text-white/88">
                        {source.name}
                      </div>
                    ))}
                  </motion.div>

                  <motion.div
                    className="mt-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[1.15rem] font-semibold"
                    animate={{ scale: [1, 1.08, 1], rotate: [0, -4, 4, 0] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    +
                  </motion.div>

                  <motion.div
                    className="w-[6.6rem] rounded-[22px] bg-white px-3 py-3 text-left text-ink-primary"
                    initial={{ opacity: 0.8, x: 0 }}
                    animate={{ opacity: [0.82, 1, 0.82], x: [0, 4, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Lophos</p>
                    <p className="mt-2 text-[0.82rem] font-semibold leading-5">{current.result}</p>
                  </motion.div>
                </div>

                <motion.div
                  className="mt-10 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[0.76rem] text-white/72"
                  animate={{ opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                >
                  fontes → agrupamento → uma notícia só
                </motion.div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
