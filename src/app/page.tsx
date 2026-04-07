import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, PlayCircle, SearchLg, LayersThree01, MessageChatCircle, Stars02 } from '@untitledui/icons'
import { LophosLogo } from '@/components/LophosLogo'

const TRUSTED_BY = ['ChatGPT', 'Airbnb', 'Nike', 'Dropbox', 'Shopify', 'Spotify', 'Uber', 'Wise']
const LIBRARY_STATS = [
  { value: '48h', label: 'janela editorial sempre fresca' },
  { value: 'IA + curadoria', label: 'resumos que conectam fontes e contexto' },
  { value: 'Threads', label: 'conversas salvas por artigo' },
]
const PATTERNS = [
  'Games',
  'Filmes e séries',
  'Tecnologia',
  'Anime',
  'Economia',
  'Cultura pop',
  'Overwatch',
  'Marvel',
  'Lançamentos',
  'Streaming',
]
const FEATURES = [
  {
    icon: SearchLg,
    title: 'Encontre sinais em segundos',
    body: 'Tópicos, fontes, resumos e notícias relacionadas trabalham juntos para você chegar rápido no que importa.',
  },
  {
    icon: LayersThree01,
    title: 'Veja o panorama inteiro',
    body: 'O Lophos agrupa diferentes coberturas do mesmo evento para reduzir ruído e deixar a leitura mais coesa.',
  },
  {
    icon: MessageChatCircle,
    title: 'Continue a conversa',
    body: 'Cada artigo pode virar uma thread persistente, com contexto, histórico e sugestões de continuidade.',
  },
]
const TESTIMONIALS = [
  {
    quote: 'O Lophos transforma um monte de links soltos em um feed que realmente parece pensado para mim.',
    author: 'Henrique',
    role: 'Usuário early access',
  },
  {
    quote: 'A mistura de feed editorial com chat contextual deixa a descoberta muito mais útil do que um leitor de notícias comum.',
    author: 'Equipe Lophos',
    role: 'Product notes',
  },
]

export const metadata: Metadata = {
  title: 'Lophos - Seu feed de notícias personalizado por IA',
  description: 'Descubra notícias, conecte fontes relacionadas e converse com cada artigo em um feed personalizado por IA.',
}

function MockArticleCard({
  topic,
  title,
  summary,
  accent,
}: {
  topic: string
  title: string
  summary: string
  accent: string
}) {
  return (
    <div className="rounded-[28px] border border-border bg-white/90 p-5 shadow-[0_30px_80px_rgba(17,17,17,0.08)] backdrop-blur-sm">
      <div className="mb-5 flex items-start gap-4">
        <div
          className="h-24 w-24 flex-shrink-0 rounded-[24px]"
          style={{
            background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 35%, white))`,
          }}
        />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">{topic}</p>
          <h3 className="mt-2 text-xl font-semibold leading-tight text-ink-primary">{title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-secondary">{summary}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-2xl bg-bg-secondary px-4 py-3 text-sm text-ink-secondary">
          5 fontes conectadas • publicado há 2h
        </div>
        <div className="rounded-2xl border border-border bg-bg-primary px-4 py-3 text-sm font-medium text-ink-primary">
          Abrir thread
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-bg-primary text-ink-primary">
      <div className="absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(circle_at_top,_rgba(202,119,75,0.16),_transparent_48%)]" />

      <header className="header-blur sticky top-0 z-30 border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <LophosLogo size={30} />
            <span className="text-lg font-semibold tracking-[-0.03em]">Lophos</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-ink-secondary md:flex">
            <Link href="/notas-de-versao" className="transition-colors hover:text-ink-primary">
              Notas de versão
            </Link>
            <Link href="/politica-de-privacidade" className="transition-colors hover:text-ink-primary">
              Política de Privacidade
            </Link>
            <Link href="/termos-de-uso" className="transition-colors hover:text-ink-primary">
              Termos de Uso
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary sm:inline-flex">
              Entrar
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-ink-primary px-5 py-2.5 text-sm font-medium text-bg-primary transition-transform hover:-translate-y-0.5"
            >
              Entrar no Lophos
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-14 md:px-8 md:pb-24 md:pt-20">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-xs font-medium text-ink-secondary backdrop-blur-sm">
              <Stars02 size={14} />
              Feed editorial com IA, contexto e conversa
            </div>

            <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em] md:text-7xl">
              Descubra o que importa sem nadar em ruído.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-secondary md:text-xl">
              O Lophos cruza notícias relacionadas, organiza o contexto e abre uma thread para cada artigo, para você
              explorar o assunto em vez de só acumular links.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink-primary px-6 py-3 text-sm font-medium text-bg-primary transition-transform hover:-translate-y-0.5"
              >
                Entrar no Lophos
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/notas-de-versao"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-6 py-3 text-sm font-medium text-ink-primary transition-colors hover:bg-bg-secondary"
              >
                Ver notas de versão
                <PlayCircle size={16} />
              </Link>
            </div>

            <div className="mt-12">
              <p className="text-sm text-ink-tertiary">Inspirado nas melhores interfaces de descoberta e leitura modernas.</p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-ink-secondary">
                {TRUSTED_BY.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 translate-x-4 translate-y-6 rounded-[36px] bg-[linear-gradient(135deg,rgba(202,119,75,0.14),rgba(17,17,17,0.04))] blur-3xl" />
            <div className="relative space-y-5">
              <MockArticleCard
                topic="Overwatch"
                title="Anran recebe redesign após pedidos da comunidade"
                summary="O Lophos conecta diferentes coberturas do mesmo evento, resume o contexto e deixa a conversa pronta para continuar em thread."
                accent="#ca774b"
              />
              <div className="grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[28px] border border-border bg-[#161616] p-5 text-white shadow-[0_30px_80px_rgba(17,17,17,0.18)]">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">Thread contextual</p>
                  <p className="mt-4 text-lg font-medium leading-8">
                    “Onde eu posso jogar Overwatch?”<br />
                    “Quais plataformas e lojas têm o jogo hoje?”
                  </p>
                  <div className="mt-6 rounded-2xl bg-white/8 p-4 text-sm leading-6 text-white/75">
                    Respostas com contexto do artigo, conhecimento geral e sugestões de próximas perguntas.
                  </div>
                </div>

                <div className="rounded-[28px] border border-border bg-white/90 p-5 shadow-[0_30px_80px_rgba(17,17,17,0.08)] backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-ink-tertiary">Widgets inteligentes</p>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl bg-bg-secondary p-4">
                      <p className="text-sm font-medium">Valorant</p>
                      <p className="mt-1 text-sm text-ink-secondary">Partidas do dia e horário em um relance.</p>
                    </div>
                    <div className="rounded-2xl bg-bg-secondary p-4">
                      <p className="text-sm font-medium">Clima</p>
                      <p className="mt-1 text-sm text-ink-secondary">Contexto rápido sem sair do feed.</p>
                    </div>
                    <div className="rounded-2xl bg-bg-secondary p-4">
                      <p className="text-sm font-medium">Tópicos de interesse</p>
                      <p className="mt-1 text-sm text-ink-secondary">Seu feed aprende com o que você acompanha.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-white/70">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-3 md:px-8">
          {LIBRARY_STATS.map((stat) => (
            <div key={stat.value}>
              <p className="text-3xl font-semibold tracking-[-0.04em]">{stat.value}</p>
              <p className="mt-2 text-sm text-ink-secondary">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-18 md:px-8 md:py-24">
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-ink-tertiary">Descoberta guiada</p>
            <h2 className="mt-4 max-w-xl text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
              Encontre padrões de leitura em segundos.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-ink-secondary">
              Inspirado na clareza de navegação do Mobbin, mas pensado para leitura editorial: tópicos, merge de eventos,
              cards fortes e profundidade quando você quiser ir além.
            </p>
          </div>

          <div className="rounded-[32px] border border-border bg-white p-6 shadow-[0_24px_70px_rgba(17,17,17,0.06)]">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PATTERNS.map((pattern, index) => (
                <div
                  key={pattern}
                  className="rounded-2xl border border-border bg-bg-primary px-4 py-4 text-sm font-medium text-ink-primary transition-transform hover:-translate-y-0.5"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  {pattern}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-18 md:px-8 md:pb-24">
        <div className="grid gap-6 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="rounded-[28px] border border-border bg-white p-6 shadow-[0_24px_70px_rgba(17,17,17,0.05)]"
              >
                <div className="inline-flex rounded-2xl bg-bg-secondary p-3 text-ink-primary">
                  <Icon size={20} />
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{feature.title}</h3>
                <p className="mt-3 text-base leading-8 text-ink-secondary">{feature.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="border-t border-border bg-white/60">
        <div className="mx-auto max-w-7xl px-6 py-18 md:px-8 md:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-ink-tertiary">O que muda na prática</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
              Menos páginas abertas. Mais contexto por assunto.
            </h2>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {TESTIMONIALS.map((item) => (
              <div key={item.quote} className="rounded-[28px] border border-border bg-bg-primary p-6">
                <p className="text-xl leading-9 text-ink-primary">“{item.quote}”</p>
                <div className="mt-6">
                  <p className="font-medium">{item.author}</p>
                  <p className="text-sm text-ink-tertiary">{item.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-18 text-center md:px-8 md:py-24">
        <div className="rounded-[40px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,242,0.96))] px-8 py-12 shadow-[0_32px_90px_rgba(17,17,17,0.08)] md:px-14 md:py-16">
          <h2 className="text-4xl font-semibold tracking-[-0.05em] md:text-6xl">
            Descubra notícias como quem explora um produto bem desenhado.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-ink-secondary">
            Entre no Lophos para acompanhar seus temas, salvar threads e usar uma experiência de leitura mais organizada
            desde a primeira visita.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ink-primary px-6 py-3 text-sm font-medium text-bg-primary transition-transform hover:-translate-y-0.5"
            >
              Entrar no Lophos
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/notas-de-versao"
              className="inline-flex items-center justify-center rounded-full border border-border bg-white px-6 py-3 text-sm font-medium text-ink-primary transition-colors hover:bg-bg-secondary"
            >
              Explorar atualizações
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <LophosLogo size={24} />
            <span className="text-sm font-medium text-ink-secondary">Lophos © 2026</span>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-tertiary">
            <Link href="/notas-de-versao" className="transition-colors hover:text-ink-primary">
              Notas de versão
            </Link>
            <Link href="/politica-de-privacidade" className="transition-colors hover:text-ink-primary">
              Política de Privacidade
            </Link>
            <Link href="/termos-de-uso" className="transition-colors hover:text-ink-primary">
              Termos de Uso
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
