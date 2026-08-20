import type { Metadata } from 'next'
import { EditorialListsCatalog, type EditorialListCatalogItem } from '@/components/editorial/EditorialListsCatalog'
import { getSupabaseAdmin } from '@/lib/supabase'
import { EDITORIAL_LIST_CARD_SELECT, toEditorialListCardItem } from '@/lib/editorial-list-card'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Listas - Lophos',
  description: 'Listas editoriais, seleções e guias publicados pelo Lophos.',
  alternates: { canonical: '/lists' },
}

export default async function EditorialListsPage() {
  const { data, error } = await getSupabaseAdmin()
    .from('editorial_lists')
    .select(EDITORIAL_LIST_CARD_SELECT)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('[editorial-lists] public catalog failed:', error)
    throw new Error('Não foi possível carregar as listas agora.')
  }

  const lists = (data || []).map(toEditorialListCardItem) as EditorialListCatalogItem[]

  return <EditorialListsCatalog lists={lists} />
}
