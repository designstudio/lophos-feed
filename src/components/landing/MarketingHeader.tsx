import Link from 'next/link'
import { LophosLogo } from '@/components/LophosLogo'

export function MarketingHeader() {
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
            className="inline-flex items-center rounded-full bg-ink-primary px-4 py-2 text-[0.95rem] font-medium text-white transition-opacity hover:opacity-85"
          >
            Criar conta grátis
          </Link>
        </div>
      </div>
    </div>
  )
}
