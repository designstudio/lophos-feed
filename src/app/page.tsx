import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  LayersThree01,
  Heart,
  SearchLg,
  Clock,
  ChevronDown,
  ThumbsDown,
} from '@untitledui/icons'
import { IconFeed } from '@/components/icons'
import { HowItWorksRotator } from '@/components/landing/HowItWorksRotator'
import { MarketingHeader } from '@/components/landing/MarketingHeader'
import { MarketingFooter } from '@/components/landing/MarketingFooter'
import { LophosLogo } from '@/components/LophosLogo'

const PORTAL_DOMAINS = [
  'g1.globo.com',
  'tecmundo.com.br',
  'engadget.com',
  'gamespot.com',
  'kotaku.com',
  'billboard.com',
  'techcrunch.com',
  'crunchyroll.com',
  'theverge.com',
  'androidauthority.com',
  'canaltech.com.br',
  'ign.com',
  'olhardigital.com.br',
  'moviemaker.com',
  'dreadcentral.com',
  'bookriot.com',
  'lithub.com',
  'nme.com',
  'businessinsider.com',
  'ycombinator.com',
  'rockpapershotgun.com',
  'criticalhits.com.br',
] as const

const PORTAL_ICON_POSITIONS = [
  { top: '8%', left: '4%', animation: 'landingFloat 8.5s ease-in-out infinite' },
  { top: '16%', left: '18%', animation: 'landingDrift 12.4s ease-in-out infinite' },
  { top: '9%', right: '20%', animation: 'landingFloat 9.2s ease-in-out infinite' },
  { top: '20%', right: '4%', animation: 'landingDrift 11.5s ease-in-out infinite' },
  { top: '50%', left: '7%', animation: 'landingFloat 10.4s ease-in-out infinite' },
  { top: '48%', right: '10%', animation: 'landingFloat 8.9s ease-in-out infinite' },
  { bottom: '12%', left: '17%', animation: 'landingDrift 12.8s ease-in-out infinite' },
  { bottom: '10%', right: '5%', animation: 'landingFloat 9.9s ease-in-out infinite' },
] as const

export const metadata: Metadata = {
  title: 'Lophos - Você não precisa abrir mais dez abas',
  description:
    'O Lophos acompanha mais de 60 portais, junta coberturas repetidas, traduz o contexto e cria um espaço para você explorar.',
}

export const dynamic = 'force-dynamic'

function pickRandomDomains(count: number) {
  const pool = [...PORTAL_DOMAINS]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

function HeroBlock() {
  return (
    <section className="px-5 pb-16 pt-28 md:px-8 md:pb-24 md:pt-32">
      <div className="mx-auto max-w-[960px] text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink-secondary shadow-[0_8px_30px_rgba(17,17,17,0.04)]">
          <LayersThree01 size={16} />
          +60 fontes. Uma experiência
        </div>

        <h1 className="mt-8 text-[3.5rem] font-semibold leading-[0.94] tracking-[-0.09em] md:text-[6.1rem]">
          Você não precisa abrir mais dez abas.
        </h1>

        <p className="mx-auto mt-6 max-w-[860px] text-lg leading-8 text-ink-secondary md:text-[1.5rem] md:leading-[1.45]">
          A gente acompanha G1, TechCrunch, GameSpot e mais de 60 portais por você — junta as coberturas repetidas,
          traduz o contexto e cria um espaço pra você explorar.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-ink-primary px-6 py-3.5 text-base font-medium text-white transition-opacity hover:opacity-85"
          >
            Quero experimentar
            <ArrowRight size={16} />
          </Link>
          <Link
            href="#como-funciona"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-6 py-3.5 text-base font-medium text-ink-primary transition-opacity hover:opacity-70"
          >
            Ver como funciona
          </Link>
        </div>
      </div>
    </section>
  )
}

function ProductShowcase() {
  return (
    <section className="mx-auto max-w-[1500px] cursor-default px-4 md:px-8">
      <div className="overflow-hidden rounded-[34px] bg-bg-secondary p-3 md:p-6">
        <div className="overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_18px_60px_rgba(17,17,17,0.05)]">
          <div className="grid min-h-[710px] lg:grid-cols-[224px_minmax(0,1fr)]">
            <aside className="flex flex-col border-r border-border bg-white">
              <div className="flex h-[60px] items-center justify-between border-b border-border px-4">
                <div className="flex items-center gap-3">
                  <LophosLogo size={30} />
                  <span className="text-[1.95rem] font-semibold leading-none tracking-[-0.06em]">lophos</span>
                </div>
                <span className="text-sm text-ink-tertiary">‹</span>
              </div>

              <div className="space-y-1 px-3 py-4">
                {[
                  { label: 'Meu Feed', icon: IconFeed, active: true },
                  { label: 'Minhas curtidas', icon: Heart, active: false },
                  { label: 'Buscar', icon: SearchLg, active: false },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.label}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-[0.95rem] font-medium ${
                        item.active ? 'bg-bg-secondary text-ink-primary' : 'text-ink-secondary'
                      }`}
                    >
                      <Icon size={18} />
                      {item.label}
                    </div>
                  )
                })}
              </div>

              <div className="px-4 pt-2">
                <p className="text-sm font-medium text-ink-tertiary">Histórico</p>
              </div>
              <div className="space-y-1 px-3 pt-3 text-[0.92rem] text-ink-secondary">
                {[
                  'Sobre o que vai falar a 13ª...',
                  'Onde eu posso jogar Over...',
                  'Sobre o que fala o filme?',
                  'Sobre o que é o filme Afli...',
                ].map((item) => (
                  <div key={item} className="truncate rounded-xl px-2 py-2">
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-auto border-t border-border px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[linear-gradient(135deg,#6d4c41,#d7a37a)]" />
                  <span className="text-[0.95rem] text-ink-secondary">Usuário</span>
                </div>
              </div>
            </aside>

            <section className="min-w-0 bg-white">
              <div className="flex h-[60px] items-center justify-between border-b border-border px-7">
                <div className="text-[1rem] font-semibold text-ink-primary">Meu Feed</div>
                <div className="hidden items-center gap-10 md:flex">
                  <div className="border-b-2 border-ink-primary pb-4 pt-4 text-[0.95rem] font-medium text-ink-primary">
                    Últimas notícias
                  </div>
                  <div className="flex items-center gap-2 text-[0.95rem] font-medium text-ink-tertiary">
                    Tópicos
                    <ChevronDown size={14} />
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[0.92rem] text-ink-secondary">
                  <Clock size={16} />
                  Últimas 48h
                </div>
              </div>

              <div className="grid gap-8 px-7 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-7">
                  <div className="grid gap-7 md:grid-cols-[1fr_286px]">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Horror</p>
                      <h3 className="mt-3 max-w-[470px] text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.05em] text-ink-primary">
                        Filme de Terror &apos;Primal Darkness&apos; estreia gratuitamente em...
                      </h3>
                      <div className="mt-4 flex items-center gap-2 text-[0.92rem] text-ink-tertiary">
                        <Clock size={15} />
                        Publicado há cerca de 6 horas
                      </div>
                      <p className="mt-4 max-w-[500px] text-[0.98rem] leading-8 text-ink-secondary">
                        O filme de terror found footage &apos;Primal Darkness&apos;, com temática de criatura, está
                        disponível para assistir gratuitamente...
                      </p>
                      <div className="mt-5 flex items-center gap-5 text-[0.92rem] text-ink-tertiary">
                        <span>1 fonte</span>
                        <Heart size={16} />
                        <ThumbsDown size={16} />
                      </div>
                    </div>

                    <div className="h-[204px] rounded-[20px] bg-[linear-gradient(145deg,#0f1013,#1b1d24_40%,#56463d_100%)]" />
                  </div>

                  <div className="border-t border-border pt-6">
                    <div className="grid gap-5 md:grid-cols-3">
                      {[
                        { title: "Filme 'Sender' aborda o horror existencial...", tone: '#4a2740' },
                        { title: 'Kanye West impedido de viajar para o Reino Unido...', tone: '#5f4d39' },
                        { title: 'Daredevil: Born Again confirma reunião da equipe...', tone: '#2f323a' },
                      ].map((item) => (
                        <article key={item.title}>
                          <div className="h-[132px] rounded-[18px]" style={{ background: `linear-gradient(145deg, ${item.tone}, #d3d0cb)` }} />
                          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Movies</p>
                          <h4 className="mt-2 text-[1.1rem] font-semibold leading-[1.25] tracking-[-0.03em] text-ink-primary">
                            {item.title}
                          </h4>
                          <div className="mt-3 flex items-center gap-4 text-[0.88rem] text-ink-tertiary">
                            <span>1 fonte</span>
                            <Heart size={15} />
                            <ThumbsDown size={15} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-[22px] border border-border p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[1.05rem] font-semibold text-ink-primary">29° F/C</p>
                        <p className="mt-1 text-sm text-ink-secondary">Parada Inglesa, São Paulo</p>
                      </div>
                      <div className="text-right text-sm text-ink-secondary">
                        <p>Parcialmente nublado</p>
                        <p className="mt-1">H: 29° L: 21°</p>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-5 gap-2 text-center text-[0.82rem] text-ink-secondary">
                      {['Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((day, index) => (
                        <div key={day}>
                          <div className="mx-auto mb-2 h-5 w-5 rounded-full bg-bg-secondary" />
                          <p>{28 - index}°</p>
                          <p className="mt-1">{day}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-border p-5">
                    <p className="text-[1.05rem] font-semibold text-ink-primary">Minhas séries</p>
                    <div className="mt-4 space-y-4">
                      {[
                        { title: 'Monarch - Legado de Monstros', meta: 'T2E7 - Teoria das cordas', date: '09 de abr' },
                        { title: 'Harry Potter', meta: 'T1E1 - Episódio 1', date: '25 de dez' },
                      ].map((show) => (
                        <div key={show.title} className="flex gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
                          <div className="h-14 w-10 rounded-[10px] bg-[linear-gradient(145deg,#4a6170,#9eb3bc)]" />
                          <div>
                            <p className="text-[0.95rem] font-medium text-ink-primary">{show.title}</p>
                            <p className="mt-1 text-sm text-ink-secondary">{show.meta}</p>
                            <p className="mt-1 text-sm text-accent">{show.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  )
}

function LibraryBlock() {
  const randomDomains = pickRandomDomains(PORTAL_ICON_POSITIONS.length)

  return (
    <section className="relative min-h-[780px] overflow-hidden px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-[1400px]">
        <div className="relative flex min-h-[620px] items-center justify-center">
          {PORTAL_ICON_POSITIONS.map((icon, index) => (
            <div
              key={`${randomDomains[index]}-${index}`}
              className="absolute hidden items-center justify-center md:flex"
              style={{
                ...icon,
                width: 60,
                height: 60,
                animation: icon.animation,
              }}
            >
              <img
                src={`https://www.google.com/s2/favicons?domain=${randomDomains[index]}&sz=128`}
                alt={randomDomains[index]}
                width={60}
                height={60}
                className="h-[60px] w-[60px] rounded-[18px] object-contain shadow-[0_18px_40px_rgba(17,17,17,0.08)]"
              />
            </div>
          ))}

          <div className="relative z-10 max-w-[860px] px-6 text-center">
            <p className="text-lg font-medium text-ink-primary md:text-[2rem] md:leading-none">Uma biblioteca construída com</p>
            <div className="mt-4 space-y-1 text-[3.2rem] font-semibold leading-[0.94] tracking-[-0.09em] text-ink-primary md:text-[5.4rem]">
              <div>+60 feeds de notícias</div>
              <div>em um único lugar.</div>
            </div>
            <p className="mt-4 text-lg font-medium text-ink-primary md:text-[2rem] md:leading-none">Sem repetição, com contexto.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function CtaBlock() {
  return (
    <section className="px-5 pb-24 pt-8 md:px-8 md:pb-28 md:pt-12">
      <div className="mx-auto flex max-w-[760px] flex-col items-center rounded-[30px] bg-bg-secondary px-6 py-12 text-center md:px-10 md:py-16">
        <h2 className="text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.06em] text-ink-primary">
          <span className="block">Pronto para</span>
          <span className="block">Customizar seu feed?</span>
        </h2>
        <p className="mx-auto mt-5 max-w-[620px] text-lg leading-8 text-ink-secondary md:text-[1.25rem]">
          Gratuito pra começar. Sem cartão de crédito.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-ink-primary px-6 py-3.5 text-base font-medium text-white transition-opacity hover:opacity-85"
          >
            Criar minha conta grátis
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-bg-primary text-ink-primary">
      <MarketingHeader />
      <HeroBlock />
      <ProductShowcase />

      <section id="como-funciona" className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-[1320px]">
          <HowItWorksRotator />
        </div>
      </section>

      <LibraryBlock />
      <CtaBlock />
      <MarketingFooter />
    </main>
  )
}
