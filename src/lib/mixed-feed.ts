import type { FeedItem } from '@/lib/types'
import type { EditorialListCardItem } from '@/lib/editorial-list-card'

export type MosaicContentItem =
  | { kind: 'article'; item: FeedItem }
  | { kind: 'editorial-list'; item: EditorialListCardItem }

export function interleaveEditorialLists(items: FeedItem[], lists: EditorialListCardItem[]): MosaicContentItem[] {
  const mixed: MosaicContentItem[] = []
  let listIndex = 0
  let nextListPosition = 10

  items.forEach((item) => {
    mixed.push({ kind: 'article', item })
    if (listIndex >= lists.length || mixed.length !== nextListPosition) return
    mixed.push({ kind: 'editorial-list', item: lists[listIndex] })
    nextListPosition += listIndex % 2 === 0 ? 9 : 11
    listIndex += 1
  })
  return mixed
}
