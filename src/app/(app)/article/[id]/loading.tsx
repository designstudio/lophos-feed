export default function ArticleLoading() {
  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      <div className="route-scroll-container flex-1 min-w-0">
        <main className="page-scroll">
          <div
            className="article-layout mx-auto mt-[10vh] px-6 pb-24 md:pb-8"
            aria-busy="true"
            aria-label="Carregando artigo"
            role="status"
          >
            <span className="sr-only">Carregando artigo…</span>
            <div className="space-y-4 animate-pulse" aria-hidden="true">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-9 w-4/5 rounded" />
              <div className="skeleton h-9 w-3/5 rounded" />
              <div className="skeleton h-3 w-32 rounded" />
              <div className="skeleton h-56 w-full rounded-[1.5rem]" />
              <div className="space-y-2 pt-2">
                <div className="skeleton h-4 w-full rounded" />
                <div className="skeleton h-4 w-11/12 rounded" />
                <div className="skeleton h-4 w-4/5 rounded" />
                <div className="skeleton h-4 w-2/3 rounded" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
