import Link from 'next/link'

export function MarketingFooter() {
  return (
    <footer className="rounded-t-[34px] bg-[#151515] px-6 py-14 text-white md:px-8 md:py-20">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-col gap-4 text-sm text-white/55 md:flex-row md:items-center md:justify-between">
          <p>© Lophos 2026. Todos os direitos reservados.</p>
          <Link href="/politica-de-privacidade" className="text-white/55 transition-opacity hover:opacity-65">
            Termos e políticas
          </Link>
        </div>
      </div>
    </footer>
  )
}
