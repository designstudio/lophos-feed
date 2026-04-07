'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const CASES = [
  {
    topic: 'Economia',
    sources: [
      { name: 'G1', headline: 'Banco Central sobe juros pela terceira vez' },
      { name: 'Valor', headline: 'Selic sobe 0,25 ponto, diz Banco Central' },
      { name: 'InfoMoney', headline: 'Copom decide novo patamar da Selic' },
      { name: 'Exame', headline: 'Por que o BC voltou a aumentar os juros?' },
    ],
    resultTitle: 'Selic sobe 0,25 ponto',
    resultSummary: 'O Banco Central elevou a Selic e o Lophos reuniu 4 fontes com contexto + thread.',
  },
  {
    topic: 'Games',
    sources: [
      { name: 'IGN', headline: 'Overwatch revela novo visual para Anran' },
      { name: 'GameSpot', headline: 'Comunidade pressiona e Blizzard ajusta heroína' },
      { name: 'Critical Hits', headline: 'Anran ganha redesign após críticas da fanbase' },
      { name: 'Kotaku', headline: 'Blizzard responde ao feedback sobre Anran' },
    ],
    resultTitle: 'Anran recebe redesign',
    resultSummary: 'O Lophos agrupou a cobertura do redesign em uma única notícia com contexto e continuidade.',
  },
  {
    topic: 'Filmes',
    sources: [
      { name: 'Collider', headline: 'Primal Darkness chega em streaming gratuito' },
      { name: 'Bloody Disgusting', headline: 'Found footage ganha estreia aberta ao público' },
      { name: 'MovieMaker', headline: 'Novo terror de criatura chega sem custo' },
      { name: 'Dread Central', headline: 'Onde assistir Primal Darkness agora' },
    ],
    resultTitle: 'Primal Darkness estreia grátis',
    resultSummary: 'Quatro fontes viram uma única leitura pronta para continuar explorando.',
  },
  {
    topic: 'Tecnologia',
    sources: [
      { name: 'TechCrunch', headline: 'Apple acelera rollout de recursos de IA' },
      { name: 'The Verge', headline: 'Nova fase da Apple Intelligence ganha detalhes' },
      { name: 'Canaltech', headline: 'Apple deve expandir IA em novos produtos' },
      { name: 'Engadget', headline: 'Executivos detalham estratégia de IA da Apple' },
    ],
    resultTitle: 'Apple prepara nova leva de IA',
    resultSummary: 'As coberturas se juntam para reduzir ruído e deixar só o que importa.',
  },
] as const

const CARD_HEIGHT = 'h-[23.375rem]'
const FLOW_LABELS = ['Fonts RSS', 'Agrupamento Lophos', 'Notícia'] as const

function ChatbotGlyph() {
  return (
    <motion.div
      className="relative h-[74px] w-[74px]"
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="absolute inset-0 rounded-[24px] bg-white/10 backdrop-blur-sm" />
      <div className="absolute left-1/2 top-[14px] h-[42px] w-[42px] -translate-x-1/2 rounded-[16px] border border-white/18 bg-white/8" />
      <div className="absolute left-1/2 top-[26px] flex -translate-x-1/2 items-center gap-2">
        <motion.span
          className="h-2.5 w-2.5 rounded-full bg-white"
          animate={{ scale: [1, 0.7, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.2 }}
        />
        <motion.span
          className="h-2.5 w-2.5 rounded-full bg-white"
          animate={{ scale: [1, 0.7, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.18, repeatDelay: 0.2 }}
        />
      </div>
      <motion.div
        className="absolute left-1/2 top-[42px] h-1.5 w-5 -translate-x-1/2 rounded-full bg-white/85"
        animate={{ width: [20, 13, 20] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-1/2 top-[6px] h-3 w-px -translate-x-1/2 bg-white/60"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-1/2 top-[2px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white"
        animate={{ scale: [1, 0.82, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  )
}

export function HowItWorksRotator() {
  const [index, setIndex] = useState(0)
  const [newsStage, setNewsStage] = useState(2)
  const [flowStage, setFlowStage] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNewsStage((current) => {
        const next = current + 1
        if (next > 4) {
          setIndex((caseIndex) => (caseIndex + 1) % CASES.length)
          return 2
        }
        return next
      })
    }, 1150)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFlowStage((current) => (current + 1) % 4)
    }, 1200)

    return () => window.clearInterval(interval)
  }, [])

  const current = CASES[index]
  const visibleNews = useMemo(() => current.sources.slice(0, newsStage), [current.sources, newsStage])
  const currentFlowLabel = FLOW_LABELS[Math.min(flowStage, 2)]
  const showGeneratedCard = flowStage === 3

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
            <div className="w-full max-w-[17.75rem] rounded-[26px] bg-white p-6 shadow-[0_20px_50px_rgba(17,17,17,0.06)]">
              <p className="text-[0.98rem] leading-7 text-ink-secondary">
                O Lophos acompanha fontes diferentes, detecta quando várias matérias estão falando da mesma coisa e
                transforma isso em uma única notícia para você.
              </p>
            </div>
          </div>
        </article>

        <article className={`rounded-[30px] bg-bg-secondary p-5 md:p-6 ${CARD_HEIGHT}`}>
          <div className="flex h-full items-center justify-center">
            <div className="flex h-full w-full max-w-[18.2rem] flex-col overflow-hidden rounded-[26px] bg-white shadow-[0_20px_50px_rgba(17,17,17,0.06)]">
              <div className="overflow-hidden border-b border-border px-4 pb-3 pt-4">
                <div className="flex flex-nowrap gap-2 overflow-hidden">
                  {CASES.map((item, itemIndex) => (
                    <button
                      key={item.topic}
                      type="button"
                      onClick={() => {
                        setIndex(itemIndex)
                        setNewsStage(2)
                      }}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[0.78rem] font-medium transition-opacity ${
                        itemIndex === index ? 'bg-ink-primary text-white' : 'bg-bg-secondary text-ink-secondary hover:opacity-70'
                      }`}
                    >
                      {item.topic}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-hidden px-4 py-4">
                <motion.div layout className="space-y-3">
                  <AnimatePresence initial={false}>
                    {visibleNews.map((source) => (
                      <motion.div
                        key={`${current.topic}-${source.name}`}
                        layout
                        initial={{ opacity: 0, y: 28, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -22, scale: 0.98 }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                        className="rounded-[18px] bg-bg-secondary px-4 py-3"
                      >
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">
                          {source.name}
                        </p>
                        <p className="mt-2 line-clamp-2 text-[0.92rem] font-medium leading-6 text-ink-primary">
                          {source.headline}
                        </p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </div>
            </div>
          </div>
        </article>

        <article className={`rounded-[30px] bg-bg-secondary p-5 md:p-6 ${CARD_HEIGHT}`}>
          <div className="flex h-full items-center justify-center">
            <div className="relative flex h-full w-full max-w-[18.2rem] flex-col items-center justify-center overflow-hidden rounded-[26px] bg-[#151515] px-5 py-6 text-white shadow-[0_20px_50px_rgba(17,17,17,0.08)]">
              <ChatbotGlyph />

              <div className="mt-6 min-h-[2.5rem]">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentFlowLabel}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="text-center text-[0.92rem] font-medium text-white/72"
                  >
                    {currentFlowLabel}
                  </motion.p>
                </AnimatePresence>
              </div>

              <motion.div
                className="mt-4 h-px w-24 bg-white/14"
                animate={{ opacity: [0.2, 0.65, 0.2], width: [72, 96, 72] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              />

              <div className="mt-8 min-h-[13.5rem] w-full">
                <AnimatePresence mode="wait">
                  {showGeneratedCard ? (
                    <motion.div
                      key={`${current.topic}-generated`}
                      initial={{ opacity: 0, y: 18, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.98 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="grid gap-4 md:grid-cols-[1fr_132px]"
                    >
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Lophos</p>
                        <h4 className="mt-3 text-[1.82rem] font-semibold leading-[1.03] tracking-[-0.05em] text-white">
                          {current.resultTitle}
                        </h4>
                        <div className="mt-4 flex items-center gap-2 text-[0.84rem] text-white/62">
                          <span>Publicado há cerca de 2 horas</span>
                        </div>
                        <p className="mt-4 text-[0.98rem] leading-7 text-white/72">{current.resultSummary}</p>
                        <p className="mt-5 text-[0.88rem] text-white/58">{current.sources.length} fontes</p>
                      </div>

                      <div className="h-[170px] rounded-[22px] bg-[linear-gradient(145deg,#0f1013,#1b1d24_40%,#56463d_100%)]" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`${current.topic}-processing`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex h-full items-center justify-center"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex gap-2">
                          {[0, 1, 2].map((dot) => (
                            <motion.span
                              key={dot}
                              className="h-2.5 w-2.5 rounded-full bg-white/70"
                              animate={{ y: [0, -5, 0], opacity: [0.45, 1, 0.45] }}
                              transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.12, ease: 'easeInOut' }}
                            />
                          ))}
                        </div>
                        <p className="text-[0.82rem] text-white/55">Gerando a notícia consolidada...</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
