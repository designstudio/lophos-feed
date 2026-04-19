const NEGATIVE_TOPIC_THRESHOLD = 2

function normalizeTopic(value: string): string {
  return value.toLowerCase().trim()
}

async function normalizeTopics(db: any, topics: string[]): Promise<string[]> {
  const cleaned = topics.map((topic) => normalizeTopic(topic)).filter(Boolean)
  if (cleaned.length === 0) return []

  const normalized = await Promise.all(
    cleaned.map(async (topic) => {
      try {
        const { data, error } = await db.rpc('normalize_topic', { p_topic: topic })
        if (error) return topic
        return normalizeTopic(String(data ?? topic))
      } catch {
        return topic
      }
    }),
  )

  return [...new Set(normalized.filter(Boolean))]
}

export async function loadBlockedTopics(db: any, userId: string, userTopics: string[] = []) {
  const normalizedUserTopics = new Set(userTopics.map((topic) => normalizeTopic(topic)).filter(Boolean))

  const [excludedResult, negativeResult] = await Promise.all([
    db
      .from('user_excluded_topics')
      .select('topic')
      .eq('user_id', userId),
    db
      .from('user_negative_topics')
      .select('topic')
      .eq('user_id', userId)
      .gte('dislike_count', NEGATIVE_TOPIC_THRESHOLD),
  ])

  const blocked = new Set<string>()

  for (const row of excludedResult.data ?? []) {
    const topic = normalizeTopic(String(row.topic ?? ''))
    if (topic && !normalizedUserTopics.has(topic)) blocked.add(topic)
  }

  for (const row of negativeResult.data ?? []) {
    const topic = normalizeTopic(String(row.topic ?? ''))
    if (topic && !normalizedUserTopics.has(topic)) blocked.add(topic)
  }

  return [...blocked]
}

export async function syncNegativeTopicsForReaction(
  db: any,
  userId: string,
  topics: string[],
  delta: 1 | -1,
) {
  const normalizedTopics = await normalizeTopics(db, topics)
  if (normalizedTopics.length === 0) return

  const { data: existingRows, error } = await db
    .from('user_negative_topics')
    .select('topic, dislike_count')
    .eq('user_id', userId)
    .in('topic', normalizedTopics)

  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of existingRows ?? []) {
    counts.set(normalizeTopic(String(row.topic ?? '')), Number(row.dislike_count ?? 0))
  }

  const rowsToUpsert: Array<{
    user_id: string
    topic: string
    dislike_count: number
    first_disliked_at?: string
    last_disliked_at: string
  }> = []
  const topicsToDelete: string[] = []
  const now = new Date().toISOString()

  for (const topic of normalizedTopics) {
    const current = counts.get(topic) ?? 0
    const next = Math.max(0, current + delta)

    if (next === 0) {
      topicsToDelete.push(topic)
      continue
    }

    rowsToUpsert.push({
      user_id: userId,
      topic,
      dislike_count: next,
      last_disliked_at: now,
    })
  }

  if (topicsToDelete.length > 0) {
    const { error: deleteError } = await db
      .from('user_negative_topics')
      .delete()
      .eq('user_id', userId)
      .in('topic', topicsToDelete)

    if (deleteError) throw deleteError
  }

  if (rowsToUpsert.length > 0) {
    const { error: upsertError } = await db
      .from('user_negative_topics')
      .upsert(rowsToUpsert, { onConflict: 'user_id,topic' })

    if (upsertError) throw upsertError
  }
}

export async function getArticleMatchedTopics(db: any, articleId: string, fallbackTopics: string[] = []) {
  const { data, error } = await db
    .from('articles')
    .select('matched_topics')
    .eq('id', articleId)
    .single()

  if (error) return normalizeTopics(db, fallbackTopics)

  const matched = Array.isArray(data?.matched_topics) ? data.matched_topics : []
  return normalizeTopics(db, matched.length > 0 ? matched : fallbackTopics)
}
