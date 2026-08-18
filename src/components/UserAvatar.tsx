import { cn } from '@/lib/utils'

interface AvatarUser {
  hasImage?: boolean
  imageUrl?: string
  firstName?: string | null
  lastName?: string | null
  primaryEmailAddress?: { emailAddress: string } | null
}

function getInitials(user?: AvatarUser | null): string {
  const initials = [user?.firstName, user?.lastName]
    .map((value) => value?.trim().charAt(0).toUpperCase())
    .filter(Boolean)
    .join('')
    .slice(0, 2)

  return initials || user?.primaryEmailAddress?.emailAddress.charAt(0).toUpperCase() || '?'
}

export function UserAvatar({ user, className }: { user?: AvatarUser | null; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-secondary font-medium text-ink-secondary',
        className,
      )}
      aria-hidden="true"
    >
      {user?.hasImage && user.imageUrl
        ? <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
        : getInitials(user)}
    </span>
  )
}
