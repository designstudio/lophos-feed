import { cn } from '@/lib/utils'
import { User03 } from '@untitledui/icons'
import { clerkImageUrl } from '@/lib/image-url'

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

export function UserAvatar({ user, className, imageSize = 64 }: { user?: AvatarUser | null; className?: string; imageSize?: number }) {
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
        ? <img src={clerkImageUrl(user.imageUrl, imageSize)} alt="" className="h-full w-full object-cover" decoding="async" />
        : initials ?? <User03 size={14} className="h-[55%] w-[55%]" />}
    </span>
  )
}
