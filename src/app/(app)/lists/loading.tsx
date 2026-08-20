export default function EditorialListsLoading() {
  return (
    <div className="editorial-page-scroll">
      <header className="favorites-view-header">
        <div className="favorites-view-header__title"><span className="skeleton block h-6 w-20 rounded-md" /></div>
        <span className="skeleton block h-9 w-40 rounded-full" />
      </header>
      <main className="mosaic-feed-page">
        <div className="editorial-list-showcase-grid" aria-label="Carregando listas" aria-busy="true">
          {[0, 1, 2].map((column) => (
            <div className="editorial-list-showcase-card" key={column}>
              <span className="skeleton block aspect-[1.08/1] w-full rounded-[1.25rem]" />
              <span className="skeleton mt-3 block h-5 w-4/5 rounded-md" />
              <span className="skeleton mt-2 block h-3.5 w-1/2 rounded-full" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
