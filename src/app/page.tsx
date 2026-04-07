import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Home01,
  Heart,
  SearchLg,
  Clock,
  ChevronDown,
  FilterLines,
  MessageChatCircle,
} from '@untitledui/icons'
import { LophosLogo } from '@/components/LophosLogo'
import { HowItWorksRotator } from '@/components/landing/HowItWorksRotator'

export const metadata: Metadata = {
  title: 'Lophos - Voce nao precisa abrir mais dez abas',
  description:
    'O Lophos acompanha mais de 60 portais, junta coberturas repetidas, traduz o contexto e cria um espaco para voce explorar.',
}

function LandingHeader() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-40 flex justify-center px-4">
      <div className="pointer-events-auto header-blur flex h-[60px] w-full max-w-[44rem] items-center justify-between rounded-full border border-border px-5 shadow-[0_12px_40px_rgba(17,17,17,0.05)]">
        <Link href="/" className="flex items-center gap-3 text-ink-primary">
          <LophosLogo size={30} />
          <span className="text-[1.05rem] font-semibold tracking-[-0.04em]">Lophos</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/login" className="text-[0.98rem] font-medium text-ink-primary transition-opacity hover:opacity-65">
            Entrar
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-full bg-ink-primary px-4 py-2 text-[0.95rem] font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            Criar conta gratis
          </Link>
        </div>
      </div>
    </div>
  )
}

function HeroBlock() {
  return (
    <section className="px-5 pb-16 pt-28 md:px-8 md:pb-24 md:pt-32">
      <div className="mx-auto max-w-[960px] text-center">
        <div className="inline-flex rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink-secondary shadow-[0_8px_30px_rgba(17,17,17,0.04)]">
          +60 fontes. Uma experiencia
        </div>

        <h1 className="mt-8 text-[3.5rem] font-semibold leading-[0.94] tracking-[-0.09em] md:text-[6.1rem]">
          Voce nao precisa abrir mais dez abas.
        </h1>

        <p className="mx-auto mt-6 max-w-[860px] text-lg leading-8 text-ink-secondary md:text-[1.6rem] md:leading-[1.45]">
          A gente acompanha G1, TechCrunch, GameSpot e mais de 60 portais por voce — junta as coberturas repetidas,
          traduz o contexto e cria um espaco pra voce explorar.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-ink-primary px-6 py-3.5 text-base font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            Quero experimentar
            <ArrowRight size={16} />
          </Link>
          <Link
            href="#como-funciona"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-6 py-3.5 text-base font-medium text-ink-primary transition-colors hover:bg-bg-secondary"
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
    <section className="mx-auto max-w-[1500px] px-4 md:px-8">
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
                  { label: 'Meu Feed', icon: Home01, active: true },
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
                <p className="text-sm font-medium text-ink-tertiary">Historico</p>
              </div>
              <div className="space-y-1 px-3 pt-3 text-[0.92rem] text-ink-secondary">
                {[
                  'Sobre o que vai falar a 13ª...',
                  'Onde eu posso jogar Over...',
                  'Sobre o que fala o filme?',
                  'Sobre o que e o filme Afli...',
                ].map((item) => (
                  <div key={item} className="truncate rounded-xl px-2 py-2">
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-auto border-t border-border px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[linear-gradient(135deg,#6d4c41,#d7a37a)]" />
                  <span className="text-[0.95rem] text-ink-secondary">Usuario</span>
                </div>
              </div>
            </aside>

            <section className="min-w-0 bg-white">
              <div className="flex h-[60px] items-center justify-between border-b border-border px-7">
                <div className="text-[1rem] font-semibold text-ink-primary">Meu Feed</div>
                <div className="hidden items-center gap-10 md:flex">
                  <div className="border-b-2 border-ink-primary pb-4 pt-4 text-[0.95rem] font-medium text-ink-primary">Ultimas noticias</div>
                  <div className="flex items-center gap-2 text-[0.95rem] font-medium text-ink-tertiary">
                    Topicos
                    <ChevronDown size={14} />
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[0.92rem] text-ink-secondary">
                  <Clock size={16} />
                  Ultimas 48h
                </div>
              </div>

              <div className="grid gap-8 px-7 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-7">
                  <div className="grid gap-7 md:grid-cols-[1fr_286px]">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Horror</p>
                      <h3 className="mt-3 max-w-[470px] text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.05em] text-ink-primary">
                        Filme de Terror 'Primal Darkness' estreia gratuitamente em...
                      </h3>
                      <div className="mt-4 flex items-center gap-2 text-[0.92rem] text-ink-tertiary">
                        <Clock size={15} />
                        Publicado ha cerca de 6 horas
                      </div>
                      <p className="mt-4 max-w-[500px] text-[0.98rem] leading-8 text-ink-secondary">
                        O filme de terror found footage 'Primal Darkness', com tematica de criatura, esta disponivel para assistir gratuitamente...
                      </p>
                      <div className="mt-5 flex items-center gap-5 text-[0.92rem] text-ink-tertiary">
                        <span>1 fonte</span>
                        <Heart size={16} />
                        <span>👎</span>
                      </div>
                    </div>

                    <div className="h-[204px] rounded-[20px] bg-[linear-gradient(145deg,#0f1013,#1b1d24_40%,#56463d_100%)]" />
                  </div>

                  <div className="border-t border-border pt-6">
                    <div className="grid gap-5 md:grid-cols-3">
                      {[
                        { title: "Filme 'Sender' aborda o horror existencial...", tone: '#4a2740' },
                        { title: 'Kanye West impedido de viajar para o Reino Unido...', tone: '#5f4d39' },
                        { title: 'Daredevil: Born Again confirma reuniao da equipe...', tone: '#2f323a' },
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
                            <span>👎</span>
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
                        <p className="mt-1 text-sm text-ink-secondary">Parada Inglesa, Sao Paulo</p>
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
                    <p className="text-[1.05rem] font-semibold text-ink-primary">Minhas series</p>
                    <div className="mt-4 space-y-4">
                      {[
                        { title: 'Monarch - Legado de Monstros', meta: 'T2E7 - Teoria das cordas', date: '09 de abr' },
                        { title: 'Harry Potter', meta: 'T1E1 - Episodio 1', date: '25 de dez' },
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

                  <div className="rounded-[22px] border border-border p-5">
                    <p className="text-[1.05rem] font-semibold text-ink-primary">Valorant</p>
                    <div className="mt-4 space-y-4">
                      {['UCAM Es... vs DNSTY', 'eSports C... vs Dortmun...', 'ALTERNA... vs Eintracht ...'].map((match, index) => (
                        <div key={match} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                          <div className="flex items-center justify-between text-[0.92rem] text-ink-primary">
                            <span>{match}</span>
                            <span className="text-accent">Hoje {15 + index}:00</span>
                          </div>
                          <p className="mt-1 text-sm text-ink-tertiary">VCL</p>
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
  return (
    <section className="px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-[980px] text-center">
        <p className="text-lg font-medium text-ink-primary md:text-[2rem] md:leading-none">Uma biblioteca construida com</p>
        <div className="mt-4 space-y-1 text-[3.2rem] font-semibold leading-[0.94] tracking-[-0.09em] text-ink-primary md:text-[5.4rem]">
          <div>+60 feeds de noticias</div>
          <div>em um unico lugar.</div>
          <div>Sem repeticao, com contexto.</div>
        </div>
      </div>
    </section>
  )
}

function CtaBlock() {
  return (
    <section className="px-5 pb-24 pt-4 md:px-8 md:pb-28">
      <div className="mx-auto max-w-[980px] rounded-[34px] border border-border bg-bg-secondary px-8 py-14 text-center md:px-12 md:py-16">
        <h2 className="text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.05em] text-ink-primary md:text-[4.2rem]">
          Pronto para customizar seu feed?
        </h2>
        <p className="mx-auto mt-4 max-w-[680px] text-lg leading-8 text-ink-secondary md:text-[1.3rem]">
          Gratuito pra comecar. Sem cartao de credito.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-ink-primary px-6 py-3.5 text-base font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            Criar minha conta gratis
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="rounded-t-[34px] bg-[#151515] px-6 py-14 text-white md:px-8 md:py-20">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-col gap-4 text-sm text-white/55 md:flex-row md:items-center md:justify-between">
          <p>© Lophos 2026. Todos os direitos reservados.</p>
          <Link href="/politica-de-privacidade" className="text-white/55 transition-opacity hover:opacity-65">
            Termos e politicas
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-bg-primary text-ink-primary">
      <LandingHeader />
      <HeroBlock />
      <ProductShowcase />

      <section id="como-funciona" className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-[1320px]">
          <HowItWorksRotator />
        </div>
      </section>

      <LibraryBlock />
      <CtaBlock />
      <Footer />
    </main>
  )
}
