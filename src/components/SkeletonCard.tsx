import { cn } from '@/lib/utils'

export function SkeletonCard({ featured = false }: { featured?: boolean }) {
  return (
    <div className={cn('animate-fade-in', featured ? 'flex gap-5' : 'flex flex-col')}>
      {featured && (
        <div className="flex-shrink-0 w-48 h-32 rounded-xl skeleton" />
      )}
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-5 w-4/5 rounded" />
        {featured && (
          <>
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-3/4 rounded" />
          </>
        )}
        <div className="flex gap-2 pt-1">
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-3 w-12 rounded" />
        </div>
      </div>
    </div>
  )
}
