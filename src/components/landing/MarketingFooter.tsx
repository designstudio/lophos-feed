import Link from 'next/link'
import { LophosWordmark } from '@/components/LophosWordmark'

export function MarketingFooter() {
  return (
    <footer className="rounded-t-[34px] bg-[#151515] px-6 py-14 text-white md:px-8 md:py-20">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-col gap-4 text-sm text-white/55 md:flex-row md:items-center md:justify-between">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>©</span>
            <LophosWordmark className="h-[18px] w-[60px] text-white" />
            <span>2026. Todos os direitos reservados.</span>
          </p>
          <Link href="/politica-de-privacidade" className="text-white/55 transition-opacity hover:opacity-65">
            Termos e políticas
          </Link>
        </div>
      </div>
    </footer>
  )
}
