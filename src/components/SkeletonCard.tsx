function EditorialSkeleton() {
  return (
    <div className="editorial-card editorial-card--skeleton" aria-hidden="true">
      <div className="editorial-card__entrance">
        <div className="editorial-card__coverage">
          <div className="editorial-card__coverage-track is-solo">
            <div className="editorial-card__coverage-item">
              <div className="skeleton editorial-card__coverage-media" />
            </div>
          </div>
        </div>
        <div className="editorial-card__body">
          <div className="skeleton h-3 w-28 rounded" />
          <div className="skeleton mt-4 h-7 w-11/12 rounded" />
          <div className="skeleton mt-2 h-7 w-3/4 rounded" />
          <div className="editorial-card__footer">
            <div className="flex items-center gap-2">
              <div className="skeleton h-5 w-5 rounded-full" />
              <div className="skeleton h-3 w-14 rounded" />
            </div>
            <div className="editorial-card__reactions">
              <div className="skeleton h-9 w-9 rounded-full" />
              <div className="skeleton h-9 w-9 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonBlock() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Carregando notícias">
      <EditorialSkeleton />
    </div>
  )
}

export function SkeletonCard() {
  return <EditorialSkeleton />
}
