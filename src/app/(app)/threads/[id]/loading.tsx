export default function ThreadLoading() {
  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="sticky top-0 z-20 border-b border-border px-4 md:px-8 header-blur">
          <div className="flex items-center h-12 md:h-14 gap-3">
            <div className="h-8 w-36 rounded-[1rem] bg-bg-secondary animate-pulse" />
            <div className="flex-1 flex justify-center px-2">
              <div className="h-4 w-48 rounded bg-bg-secondary animate-pulse" />
            </div>
            <div className="w-20 flex-shrink-0" />
          </div>
        </div>

        <div className="px-4 md:px-8 pt-10 pb-6">
          <div className="mx-auto flex max-w-[45rem] gap-3 rounded-[1rem] border border-border p-5">
            <div className="h-16 w-16 rounded-lg bg-bg-secondary animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-3 w-16 rounded bg-bg-secondary animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-bg-secondary animate-pulse" />
              <div className="h-3 w-24 rounded bg-bg-secondary animate-pulse" />
            </div>
          </div>
        </div>

        <main className="page-scroll">
          <div className="article-layout mx-auto px-0 py-6 pb-10">
            <div className="space-y-6 px-4 md:px-0">
              {[1, 2, 3].map((item) => (
                <div key={item} className="space-y-3">
                  <div className="h-4 w-24 rounded bg-bg-secondary animate-pulse" />
                  <div className="rounded-[1.25rem] border border-border p-5">
                    <div className="space-y-2">
                      <div className="h-4 w-full rounded bg-bg-secondary animate-pulse" />
                      <div className="h-4 w-[92%] rounded bg-bg-secondary animate-pulse" />
                      <div className="h-4 w-[76%] rounded bg-bg-secondary animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-[1.5rem] border border-border bg-bg-primary p-4">
                <div className="h-14 w-full rounded-[1rem] bg-bg-secondary animate-pulse" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
