export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
      <div className="flex gap-2 mb-3">
        <div className="skeleton h-5 w-20 rounded-full" />
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton h-5 w-4/5 rounded-lg mb-2" />
      <div className="skeleton h-5 w-3/5 rounded-lg mb-4" />
      <div className="skeleton h-4 w-full rounded-lg mb-1.5" />
      <div className="skeleton h-4 w-full rounded-lg mb-1.5" />
      <div className="skeleton h-4 w-2/3 rounded-lg" />
    </div>
  )
}
