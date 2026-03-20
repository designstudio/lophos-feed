// Skeleton variants matching the exact layout blocks

function SkeletonFullLeft() {
  return (
    <div className="flex gap-6 items-start py-6 border-b border-border">
      <div className="flex-1 min-w-0 space-y-3">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-8 w-full rounded" />
        <div className="skeleton h-6 w-4/5 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="flex gap-2 pt-1">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>
      </div>
      <div className="flex-shrink-0 w-52 h-36 rounded-xl skeleton" />
    </div>
  )
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-3 gap-5 py-6 border-b border-border">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="w-full h-36 rounded-xl skeleton" />
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-5 w-full rounded" />
          <div className="skeleton h-4 w-4/5 rounded" />
          <div className="flex gap-2 pt-1">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-3 w-14 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SkeletonFullRight() {
  return (
    <div className="flex gap-6 items-start py-6 border-b border-border">
      <div className="flex-shrink-0 w-52 h-36 rounded-xl skeleton" />
      <div className="flex-1 min-w-0 space-y-3">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-8 w-full rounded" />
        <div className="skeleton h-6 w-4/5 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="flex gap-2 pt-1">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>
      </div>
    </div>
  )
}

// One complete block = full-left + 3 cards + full-right
export function SkeletonBlock() {
  return (
    <div className="animate-fade-in">
      <SkeletonFullLeft />
      <SkeletonCards />
      <SkeletonFullRight />
    </div>
  )
}

// Keep old export for any remaining usages
export function SkeletonCard({ featured = false }: { featured?: boolean }) {
  return featured ? <SkeletonFullLeft /> : <SkeletonCards />
}
