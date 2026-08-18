import { SkeletonBlock } from '@/components/SkeletonCard'

export default function FeedLoading() {
  return (
    <div className="editorial-page-scroll" aria-busy="true" aria-label="Carregando feed" role="status">
      <span className="sr-only">Carregando feed…</span>
      <header className="editorial-feed-hero" aria-hidden="true">
        <div className="skeleton h-8 w-44 rounded" />
      </header>
      <div className="editorial-feed-layout">
        <div className="editorial-card-stack pb-24 md:pb-10">
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      </div>
    </div>
  )
}
