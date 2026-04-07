import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, LayersThree01 } from '@untitledui/icons'
import { HowItWorksRotator } from '@/components/landing/HowItWorksRotator'
import { MarketingHeader } from '@/components/landing/MarketingHeader'
import { MarketingFooter } from '@/components/landing/MarketingFooter'

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
          <div className="relative aspect-[1386/721] w-full">
            <Image
              src="/lophos-preview-feed.png"
              alt="Prévia do feed do Lophos"
              fill
              className="object-cover"
              sizes="(min-width: 768px) 1400px, 100vw"
            />
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
