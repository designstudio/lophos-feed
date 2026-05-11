import { randomUUID } from 'crypto'
import { buildFaviconUrl, isLikelyStaleLaunchArticle } from '@/lib/news-preprocessing'
import { inferRssTopic } from '@/lib/topic-classifier'

function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  if (longer.length === 0) return 1
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = []
  for (let k = 0; k <= s1.length; k++) costs[k] = k
  for (let i = 1; i <= s2.length; i++) {
    costs[0] = i
    let nw = i - 1
    for (let j = 1; j <= s1.length; j++) {
      const cj = Math.min(
        1 + Math.min(costs[j], costs[j - 1]),
        nw + (s1[j - 1] === s2[i - 1] ? 0 : 1),
      )
      nw = costs[j]
      costs[j] = cj
    }
  }
  return costs[s1.length]
}

type ConvertOptions = {
  limit?: number
  similarityThreshold?: number
}

export async function convertRawItemsToArticles(db: any, options: ConvertOptions = {}) {
  const limit = Math.max(1, Math.min(options.limit ?? 250, 1000))
  const similarityThreshold = options.similarityThreshold ?? 0.7

  const { data: rawItems, error: fetchError } = await db
    .from('raw_items')
    .select('*')
    .eq('processed', false)
    .order('pub_date', { ascending: false })
    .limit(limit)

  if (fetchError) {
    throw new Error(`Failed to load raw items: ${fetchError.message}`)
  }

  if (!rawItems?.length) {
    return {
      itemsProcessed: 0,
      itemsConverted: 0,
      itemsSkipped: 0,
      message: 'No unprocessed raw items found',
    }
  }

  const { data: existingArticles, error: existingError } = await db
    .from('articles')
    .select('id, title, sources')

  if (existingError) {
    throw new Error(`Failed to load existing articles: ${existingError.message}`)
  }

  let itemsConverted = 0
  let itemsSkipped = 0
  const now = new Date().toISOString()

  for (const item of rawItems) {
    if (
      isLikelyStaleLaunchArticle({
        title: item.title,
        description: item.summary || item.content || '',
        sourceName: item.source_name,
        topic: item.topic,
      })
    ) {
      await db.from('raw_items').update({ processed: true }).eq('id', item.id)
      itemsSkipped++
      continue
    }

    const inferredTopic = inferRssTopic({
      feedTopics: item.topic ? [item.topic] : [],
      title: item.title,
      description: item.summary || item.content || '',
      sourceName: item.source_name,
    })

    const newSource = {
      name: item.source_name,
      url: item.source_url,
      favicon: buildFaviconUrl(item.source_url),
    }

    let similarArticle = null
    for (const existing of existingArticles || []) {
      const similarity = stringSimilarity(
        String(item.title || '').toLowerCase(),
        String(existing.title || '').toLowerCase(),
      )
      if (similarity >= similarityThreshold) {
        similarArticle = existing
        break
      }
    }

    if (similarArticle) {
      const existingSources = similarArticle.sources || []
      const sourceExists = existingSources.some((source: any) => source.url === newSource.url)

      if (!sourceExists) {
        const updatedSources = [...existingSources, newSource]
        const { error: updateError } = await db
          .from('articles')
          .update({ sources: updatedSources })
          .eq('id', similarArticle.id)

        if (updateError) {
          throw new Error(`Failed to update article sources: ${updateError.message}`)
        }

        similarArticle.sources = updatedSources
      }

      await db.from('raw_items').update({ processed: true }).eq('id', item.id)
      itemsSkipped++
      continue
    }

    const article = {
      id: randomUUID(),
      topic: inferredTopic || item.topic || 'geral',
      title: item.title,
      summary: item.summary || item.content?.slice(0, 300) || '',
      sections: [
        {
          heading: 'Conteudo',
          body: item.content || '',
        },
      ],
      conclusion: null,
      sources: [newSource],
      image_url: item.image_url,
      video_url: item.video_url,
      published_at: item.pub_date || now,
      cached_at: now,
      matched_topics: [inferredTopic || item.topic].filter(Boolean),
    }

    const { error: insertError } = await db
      .from('articles')
      .upsert(article, { onConflict: 'id' })

    if (insertError) {
      throw new Error(`Failed to insert article: ${insertError.message}`)
    }

    existingArticles?.push({
      id: article.id,
      title: article.title,
      sources: article.sources,
    })

    await db.from('raw_items').update({ processed: true }).eq('id', item.id)
    itemsConverted++
  }

  return {
    itemsProcessed: rawItems.length,
    itemsConverted,
    itemsSkipped,
    message: `Successfully converted ${itemsConverted} new articles and added sources to ${itemsSkipped} existing articles`,
  }
}
