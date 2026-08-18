import { SkeletonBlock } from '@/components/SkeletonCard'

export default function FavoritesLoading() {
  return (
    <div className="editorial-page-scroll" aria-busy="true" aria-label="Carregando curtidas" role="status">
      <span className="sr-only">Carregando curtidas…</span>
      <header className="favorites-view-header" aria-hidden="true">
        <div>
          <div className="skeleton h-7 w-40 rounded" />
        </div>
        <div className="skeleton h-9 w-32 rounded-full" />
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
