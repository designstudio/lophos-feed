import { EditorialListEditor } from '@/components/editorial/EditorialListEditor'
import { getAdminIdentity, requireAdminPage } from '@/lib/admin-auth'

export default async function EditEditorialListPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ userId }, { id }] = await Promise.all([requireAdminPage(), params])
  const identity = await getAdminIdentity(userId)
  return <EditorialListEditor listId={id} currentAuthor={{ name: identity.name, imageUrl: identity.imageUrl }} />
}
