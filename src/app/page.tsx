import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MessageChatCircle, SearchLg, Stars02 } from '@untitledui/icons'
import { LophosLogo } from '@/components/LophosLogo'

const FLOATING_BADGES = [
  { label: 'RSS', top: '6%', left: '8%', bg: '#ffffff' },
  { label: 'IA', top: '12%', left: '64%', bg: '#fff3eb' },
  { label: 'TV', top: '28%', left: '18%', bg: '#f5f5f3' },
  { label: 'LOL', top: '25%', right: '12%', bg: '#fff7d9' },
  { label: 'NEWS', top: '54%', left: '10%', bg: '#eef5ff' },
  { label: 'CHAT', top: '58%', right: '18%', bg: '#f4efff' },
  { label: 'TEC', bottom: '12%', left: '24%', bg: '#eef7f2' },
  { label: 'FILM', bottom: '6%', right: '10%', bg: '#fff0f2' },
] as const

const FOOTER_GROUPS = [
  {
    title: 'Produto',
    links: [
      { href: '/login', label: 'Cadastre-se agora' },
      { href: '/login', label: 'Log in' },
      { href: '/notas-de-versao', label: 'Notas de versão' },
    ],
  },
  {
    title: 'Institucional',
    links: [
      { href: '/politica-de-privacidade', label: 'Política de Privacidade' },
      { href: '/termos-de-uso', label: 'Termos de Uso' },
    ],
  },
]

export const metadata: Metadata = {
  title: 'Lophos - Descubra o que importa sem nadar em ruído',
  description:
    'O Lophos cruza notícias relacionadas, organiza o contexto e abre uma thread para cada artigo, para você explorar o assunto em vez de só acumular links.',
}

function LandingHeader() {
  return (
    <div className="mx-auto flex max-w-[1040px] justify-center px-5 pt-5 md:px-8 md:pt-8">
      <div className="flex w-full max-w-[972px] items-center justify-between rounded-full border border-[#ece9e4] bg-[#f7f5f1] px-6 py-4 shadow-[0_1px_0_rgba(17,17,17,0.02)]">
        <Link href="/" className="flex items-center gap-3 text-ink-primary">
          <LophosLogo size={28} />
          <span className="text-[1.05rem] font-semibold tracking-[-0.04em]">Lophos</span>
        </Link>

        <nav className="hidden items-center gap-10 text-[1.02rem] font-medium text-ink-primary md:flex">
          <Link href="/notas-de-versao" className="transition-opacity hover:opacity-65">
            Notas
          </Link>
          <Link href="/politica-de-privacidade" className="transition-opacity hover:opacity-65">
            Políticas
          </Link>
          <Link href="/login" className="transition-opacity hover:opacity-65">
            Log in
          </Link>
        </nav>
      </div>
    </div>
  )
}

function ProductShowcase() {
  return (
    <div className="mx-auto mt-8 max-w-[1400px] px-4 md:mt-12 md:px-8">
      <div className="rounded-[34px] bg-[#f4f1ec] px-4 py-5 md:px-8 md:py-8">
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
            <aside className="rounded-[24px] bg-[#faf8f5] p-4">
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

                <div className="rounded-[24px] bg-[#faf8f5] p-5">
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

            <aside className="rounded-[24px] bg-[#faf8f5] p-4">
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
    <section className="relative overflow-hidden px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-[1200px]">
        <div className="relative flex min-h-[540px] items-center justify-center rounded-[40px] bg-white">
          {FLOATING_BADGES.map((badge) => (
            <div
              key={badge.label}
              className="absolute hidden h-20 w-20 items-center justify-center rounded-[26px] border border-[#efebe5] text-sm font-semibold tracking-[0.04em] text-ink-primary shadow-[0_18px_50px_rgba(17,17,17,0.06)] md:flex"
              style={badge}
            >
              <div
                className="flex h-full w-full items-center justify-center rounded-[26px]"
                style={{ backgroundColor: badge.bg }}
              >
                {badge.label}
              </div>
            </div>
          ))}

          <div className="max-w-[760px] px-6 text-center">
            <p className="text-lg font-medium text-ink-primary md:text-[2rem] md:leading-none">
              Uma biblioteca construída com
            </p>
            <div className="mt-4 space-y-1 text-[3.4rem] font-semibold leading-[0.95] tracking-[-0.08em] text-ink-primary md:text-[6rem]">
              <div>67 feeds de notícias</div>
              <div>curadoria por IA</div>
              <div>threads por artigo</div>
            </div>
            <p className="mx-auto mt-6 max-w-[560px] text-base leading-8 text-ink-secondary md:text-lg">
              O Lophos coleta fontes em RSS, identifica eventos equivalentes, organiza o contexto e transforma cada leitura
              em uma experiência mais navegável, mais limpa e muito menos repetitiva.
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
      <div className="mx-auto grid max-w-[1280px] gap-12 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <div>
          <div className="flex items-center gap-3">
            <LophosLogo size={28} />
            <span className="text-xl font-semibold tracking-[-0.04em]">Lophos</span>
          </div>
          <p className="mt-5 max-w-sm text-[1.02rem] leading-8 text-white/66">
            Descubra notícias com mais contexto, menos ruído e uma thread pronta para continuar a leitura.
          </p>
        </div>

        {FOOTER_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/38">{group.title}</p>
            <div className="mt-5 space-y-3">
              {group.links.map((link) => (
                <Link key={link.label} href={link.href} className="block text-[1.02rem] text-white transition-opacity hover:opacity-65">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-16 flex max-w-[1280px] flex-col gap-4 border-t border-white/10 pt-8 text-sm text-white/55 md:flex-row md:items-center md:justify-between">
        <p>© Lophos 2026. Todos os direitos reservados.</p>
        <div className="flex gap-6">
          <Link href="/politica-de-privacidade" className="transition-opacity hover:opacity-65">
            Privacy policy
          </Link>
          <Link href="/termos-de-uso" className="transition-opacity hover:opacity-65">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fcfbf8] text-ink-primary">
      <LandingHeader />

      <section className="px-5 pb-16 pt-20 md:px-8 md:pb-24 md:pt-24">
        <div className="mx-auto max-w-[920px] text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-[#ece9e4] bg-white shadow-[0_18px_40px_rgba(17,17,17,0.05)]">
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
              className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-6 py-3.5 text-base font-medium text-white transition-transform hover:-translate-y-0.5"
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
