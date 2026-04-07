import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MessageChatCircle, SearchLg } from '@untitledui/icons'
import { LophosLogo } from '@/components/LophosLogo'

const PORTAL_ICONS = [
  { domain: 'g1.globo.com', top: '9%', left: '9%', size: 76, animation: 'landingFloat 5.8s ease-in-out infinite alternate' },
  { domain: 'tecmundo.com.br', top: '18%', left: '28%', size: 72, animation: 'landingDrift 9s ease-in-out infinite' },
  { domain: 'engadget.com', top: '9%', right: '24%', size: 74, animation: 'landingFloat 6.2s ease-in-out infinite alternate-reverse' },
  { domain: 'gamespot.com', top: '23%', right: '11%', size: 78, animation: 'landingDrift 8.5s ease-in-out infinite' },
  { domain: 'kotaku.com', top: '48%', left: '13%', size: 78, animation: 'landingFloat 6.5s ease-in-out infinite alternate' },
  { domain: 'billboard.com', top: '54%', right: '20%', size: 74, animation: 'landingFloat 5.4s ease-in-out infinite alternate-reverse' },
  { domain: 'techcrunch.com', bottom: '12%', left: '25%', size: 74, animation: 'landingDrift 8.2s ease-in-out infinite' },
  { domain: 'crunchyroll.com', bottom: '10%', right: '14%', size: 76, animation: 'landingFloat 6.8s ease-in-out infinite alternate' },
] as const

export const metadata: Metadata = {
  title: 'Lophos - Descubra o que importa sem nadar em ruído',
  description:
    'O Lophos cruza notícias relacionadas, organiza o contexto e abre uma thread para cada artigo, para você explorar o assunto em vez de só acumular links.',
}

function LandingHeader() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-40 flex justify-center px-4">
      <div className="pointer-events-auto header-blur flex w-full max-w-[36.5rem] items-center justify-between rounded-full border border-border px-5 py-3 shadow-[0_12px_40px_rgba(17,17,17,0.05)]">
        <Link href="/" className="flex items-center gap-3 text-ink-primary">
          <LophosLogo size={26} />
          <span className="text-[1.05rem] font-semibold tracking-[-0.04em]">Lophos</span>
        </Link>

        <Link href="/login" className="text-[0.98rem] font-medium text-ink-primary transition-opacity hover:opacity-65">
          Login
        </Link>
      </div>
    </div>
  )
}

function ProductShowcase() {
  return (
    <div className="mx-auto mt-8 max-w-[1400px] px-4 md:mt-12 md:px-8">
      <div className="rounded-[34px] bg-bg-secondary px-4 py-5 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1080px] rounded-[28px] border border-border bg-white p-4 shadow-[0_18px_60px_rgba(17,17,17,0.05)] md:p-6">
          <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-2 rounded-full bg-bg-secondary px-3 py-2 text-sm font-medium text-ink-primary">
              <LophosLogo size={18} />
              Meu Feed
            </div>
            <div className="hidden h-10 flex-1 items-center rounded-full bg-bg-secondary px-4 text-sm text-ink-tertiary md:flex">
              Buscar por tópico, assunto ou palavra-chave...
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="rounded-full border border-border px-3 py-2 text-sm text-ink-secondary">Últimas 48h</div>
              <div className="rounded-full bg-ink-primary px-3 py-2 text-sm font-medium text-white">Atualizar</div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
            <aside className="rounded-[24px] bg-bg-primary p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Tópicos</p>
              <div className="mt-4 space-y-2">
                {['Games', 'Tecnologia', 'Filmes', 'Séries', 'Anime', 'Economia'].map((topic) => (
                  <div key={topic} className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-ink-primary">
                    {topic}
                  </div>
                ))}
              </div>
            </aside>

            <section className="space-y-4">
              <div className="rounded-[24px] border border-border p-4 md:p-5">
                <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Overwatch</p>
                    <h3 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.04em] text-ink-primary">
                      Anran recebe redesign após pedidos da comunidade
                    </h3>
                    <p className="mt-3 text-[15px] leading-7 text-ink-secondary">
                      O Lophos cruza fontes, resume o contexto e conecta a conversa ao artigo para você continuar a exploração sem sair do fluxo.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2 text-sm text-ink-secondary">
                      <span className="rounded-full bg-bg-secondary px-3 py-1.5">5 fontes</span>
                      <span className="rounded-full bg-bg-secondary px-3 py-1.5">Publicado há 2h</span>
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-[linear-gradient(135deg,#3b1d55,#111827_58%,#ca774b)]" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] bg-[#161616] p-5 text-white">
                  <div className="inline-flex rounded-full bg-white/10 p-2">
                    <MessageChatCircle size={18} />
                  </div>
                  <h4 className="mt-4 text-xl font-semibold tracking-[-0.03em]">Thread contextual</h4>
                  <p className="mt-3 text-sm leading-7 text-white/72">
                    “Onde eu posso jogar Overwatch?”<br />
                    “Quais plataformas e lojas têm o jogo hoje?”
                  </p>
                </div>

                <div className="rounded-[24px] bg-bg-primary p-5">
                  <div className="inline-flex rounded-full bg-white p-2 text-ink-primary shadow-[0_6px_20px_rgba(17,17,17,0.05)]">
                    <SearchLg size={18} />
                  </div>
                  <h4 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-ink-primary">Camadas de descoberta</h4>
                  <p className="mt-3 text-sm leading-7 text-ink-secondary">
                    Busca, merge de notícias equivalentes, widgets e histórico de threads em uma interface só.
                  </p>
                </div>
              </div>
            </section>

            <aside className="rounded-[24px] bg-bg-primary p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Widgets</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-sm font-medium text-ink-primary">Valorant</p>
                  <p className="mt-1 text-sm text-ink-secondary">Partidas do dia e horários em um relance.</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-sm font-medium text-ink-primary">League of Legends</p>
                  <p className="mt-1 text-sm text-ink-secondary">Acompanhe campeonatos sem sair do feed.</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-sm font-medium text-ink-primary">Clima</p>
                  <p className="mt-1 text-sm text-ink-secondary">Contexto rápido para o seu dia.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

function LibraryBlock() {
  return (
    <section className="relative min-h-[780px] overflow-hidden px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-[1400px]">
        <div className="relative flex min-h-[620px] items-center justify-center">
          {PORTAL_ICONS.map((icon) => (
            <div
              key={icon.domain}
              className="absolute hidden items-center justify-center md:flex"
              style={{
                ...icon,
                width: icon.size,
                height: icon.size,
                animation: icon.animation,
              }}
            >
              <div className="flex h-full w-full items-center justify-center rounded-[26px] border border-border bg-white shadow-[0_18px_50px_rgba(17,17,17,0.06)]">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${icon.domain}&sz=128`}
                  alt={icon.domain}
                  width={icon.size - 26}
                  height={icon.size - 26}
                  className="h-auto w-auto max-h-[46px] max-w-[46px] rounded-[14px]"
                />
              </div>
            </div>
          ))}

          <div className="max-w-[900px] px-6 text-center">
            <p className="text-lg font-medium text-ink-primary md:text-[2rem] md:leading-none">
              Uma biblioteca construída com
            </p>
            <div className="mt-4 space-y-1 text-[3.2rem] font-semibold leading-[0.94] tracking-[-0.09em] text-ink-primary md:text-[6.4rem]">
              <div>67 feeds de notícias</div>
              <div>curadoria por IA</div>
              <div>threads por artigo</div>
            </div>
            <p className="mx-auto mt-6 max-w-[620px] text-base leading-8 text-ink-secondary md:text-lg">
              De G1 a TechCrunch, de GameSpot a Billboard: o Lophos acompanha portais em tempo real, identifica cobertura duplicada
              e transforma tudo em uma experiência editorial mais navegável, mais limpa e muito menos repetitiva.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="rounded-t-[34px] bg-[#151515] px-6 py-14 text-white md:px-8 md:py-20">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <LophosLogo size={28} className="text-white" />
              <span className="text-xl font-semibold tracking-[-0.04em] text-white">Lophos</span>
            </div>
            <p className="mt-5 max-w-sm text-[1.02rem] leading-8 text-white/66">
              Descubra notícias com mais contexto, menos ruído e uma thread pronta para continuar a leitura.
            </p>
          </div>

          <div className="flex gap-6 text-[1.02rem] text-white">
            <Link href="/politica-de-privacidade" className="transition-opacity hover:opacity-65">
              Termos e políticas
            </Link>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-8 text-sm text-white/55 md:flex-row md:items-center md:justify-between">
          <p>© Lophos 2026. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-bg-primary text-ink-primary">
      <LandingHeader />

      <section className="px-5 pb-16 pt-28 md:px-8 md:pb-24 md:pt-32">
        <div className="mx-auto max-w-[920px] text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-border bg-white shadow-[0_18px_40px_rgba(17,17,17,0.05)]">
            <LophosLogo size={42} />
          </div>

          <h1 className="mt-10 text-[3.5rem] font-semibold leading-[0.94] tracking-[-0.09em] md:text-[6.2rem]">
            Descubra o que importa sem nadar em ruído.
          </h1>

          <p className="mx-auto mt-6 max-w-[820px] text-lg leading-8 text-ink-secondary md:text-[1.75rem] md:leading-[1.45]">
            O Lophos cruza notícias relacionadas, organiza o contexto e abre uma thread para cada artigo, para você
            explorar o assunto em vez de só acumular links.
          </p>

          <div className="mt-10 flex justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-ink-primary px-6 py-3.5 text-base font-medium text-white transition-transform hover:-translate-y-0.5"
            >
              Cadastre-se agora
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <ProductShowcase />
      <LibraryBlock />
      <Footer />
    </main>
  )
}
