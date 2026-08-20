import { EditorialListEditor } from '@/components/editorial/EditorialListEditor'
import { getAdminIdentity, requireAdminPage } from '@/lib/admin-auth'

export default async function NewEditorialListPage() {
  const { userId } = await requireAdminPage()
  const identity = await getAdminIdentity(userId)
  return <EditorialListEditor currentAuthor={{ name: identity.name, imageUrl: identity.imageUrl }} />
}
