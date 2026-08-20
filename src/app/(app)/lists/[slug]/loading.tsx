export default function PublishedEditorialListLoading() {
  return (
    <div className="page-scroll" aria-busy="true" aria-label="Carregando lista">
      <div className="article-layout mx-auto mt-[10vh] animate-pulse px-6 pb-24">
        <div className="h-5 w-24 rounded-full bg-bg-tertiary" />
        <div className="mt-4 h-11 w-full rounded-lg bg-bg-secondary" />
        <div className="mt-3 h-11 w-3/4 rounded-lg bg-bg-secondary" />
        <div className="mt-8 h-10 w-44 rounded-full bg-bg-secondary" />
        <div className="mt-8 aspect-[16/9] w-full rounded-[1.5rem] bg-bg-secondary" />
      </div>
    </div>
  )
}
