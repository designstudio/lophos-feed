import { EditorialListEditor } from '@/components/editorial/EditorialListEditor'
import type { EditorialListRecord } from '@/components/editorial/editorial-types'
import { getAdminIdentity, requireAdminPage } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export default async function EditEditorialListPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ userId }, { id }] = await Promise.all([requireAdminPage(), params])
  if (!isUuid(id)) notFound()
  const [identity, { data, error }] = await Promise.all([
    getAdminIdentity(userId),
    getSupabaseAdmin().from('editorial_lists').select('*').eq('id', id).maybeSingle(),
  ])

  if (error) throw new Error('Não foi possível carregar a lista.')
  if (!data) notFound()

  return (
    <EditorialListEditor
      listId={id}
      initialRecord={data as EditorialListRecord}
      currentAuthor={{ name: identity.name, imageUrl: identity.imageUrl }}
    />
  )
}
