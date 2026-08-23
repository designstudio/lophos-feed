import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
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
  const { userId } = await auth()
  const db = getSupabaseAdmin()
  const [listsResult, reactionsResult] = await Promise.all([
    db
      .from('editorial_lists')
      .select(EDITORIAL_LIST_CARD_SELECT)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false }),
    userId
      ? db
          .from('editorial_list_reactions')
          .select('list_id, reaction')
          .eq('user_id', userId)
      : Promise.resolve({ data: [], error: null }),
  ])

  const { data, error } = listsResult

  if (error) {
    console.error('[editorial-lists] public catalog failed:', error)
    throw new Error('Não foi possível carregar as listas agora.')
  }

  if (reactionsResult.error) {
    console.error('[editorial-lists] reactions failed:', reactionsResult.error)
  }

  const lists = (data || []).map(toEditorialListCardItem) as EditorialListCatalogItem[]
  const initialReactions = Object.fromEntries(
    (reactionsResult.data || [])
      .filter((row) => row.reaction === 'like' || row.reaction === 'dislike')
      .map((row) => [row.list_id, row.reaction]),
  ) as Record<string, 'like' | 'dislike'>

  return <EditorialListsCatalog lists={lists} initialReactions={initialReactions} />
}
