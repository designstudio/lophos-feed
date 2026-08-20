import { EditorialListsIndex } from '@/components/editorial/EditorialListsIndex'
import { requireAdminPage } from '@/lib/admin-auth'

export default async function AdminListsPage() {
  await requireAdminPage()
  return <EditorialListsIndex />
}
