import { cn } from '@/lib/utils'
import { User03 } from '@untitledui/icons'

interface AvatarUser {
  hasImage?: boolean
  imageUrl?: string
  firstName?: string | null
  lastName?: string | null
  primaryEmailAddress?: { emailAddress: string } | null
}

function getInitials(user?: AvatarUser | null): string | null {
  const initials = [user?.firstName, user?.lastName]
    .map((value) => value?.trim().charAt(0).toUpperCase())
    .filter(Boolean)
    .join('')
    .slice(0, 2)

  return initials || user?.primaryEmailAddress?.emailAddress.charAt(0).toUpperCase() || null
}

export function UserAvatar({ user, className }: { user?: AvatarUser | null; className?: string }) {
  const initials = getInitials(user)

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
        : initials ?? <User03 size={14} className="h-[55%] w-[55%]" />}
    </span>
  )
}
