import 'server-only'

export const EDITORIAL_LIST_STATUSES = ['draft', 'published', 'archived'] as const
export type EditorialListStatus = (typeof EDITORIAL_LIST_STATUSES)[number]

export const EDITORIAL_LIST_SUMMARY_COLUMNS = [
  'id',
  'slug',
  'title',
  'cover_image_url',
  'topic',
  'matched_topics',
  'keywords',
  'status',
  'author_clerk_id',
  'author_name',
  'author_image_url',
  'published_at',
  'created_at',
  'updated_at',
].join(',')

const MAX_CONTENT_BYTES = 2 * 1024 * 1024

type ValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string }

function optionalString(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : null
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeTags(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return undefined

  return [...new Set(value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().toLocaleLowerCase('pt-BR'))
    .filter(Boolean))]
    .slice(0, 30)
}

export function slugifyEditorialTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '')
}

export function validateEditorialListInput(body: unknown, partial = false): ValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Corpo inválido.' }
  }

  const input = body as Record<string, unknown>
  const value: Record<string, unknown> = {}

  if (!partial || input.title !== undefined) {
    if (typeof input.title !== 'string' || !input.title.trim()) {
      return { ok: false, error: 'Título é obrigatório.' }
    }
    value.title = input.title.trim().slice(0, 180)
  }

  if (!partial || input.topic !== undefined) {
    if (typeof input.topic !== 'string' || !input.topic.trim()) {
      return { ok: false, error: 'Tópico é obrigatório.' }
    }
    value.topic = input.topic.trim().toLocaleLowerCase('pt-BR').slice(0, 80)
  }

  if (input.slug !== undefined) {
    if (typeof input.slug !== 'string') return { ok: false, error: 'Slug inválido.' }
    const slug = slugifyEditorialTitle(input.slug)
    if (!slug) return { ok: false, error: 'Slug inválido.' }
    value.slug = slug
  } else if (!partial) {
    value.slug = slugifyEditorialTitle(String(value.title))
  }

  if (input.contentJson !== undefined) {
    if (!input.contentJson || typeof input.contentJson !== 'object' || Array.isArray(input.contentJson)) {
      return { ok: false, error: 'Conteúdo do editor inválido.' }
    }
    if (Buffer.byteLength(JSON.stringify(input.contentJson), 'utf8') > MAX_CONTENT_BYTES) {
      return { ok: false, error: 'Conteúdo do editor excede 2 MB.' }
    }
    value.content_json = input.contentJson
  } else if (!partial) {
    value.content_json = { type: 'doc', content: [] }
  }

  const stringFields = [
    ['coverImageUrl', 'cover_image_url', 2048],
    ['coverImageAlt', 'cover_image_alt', 300],
    ['coverImageCredit', 'cover_image_credit', 300],
    ['seoTitle', 'seo_title', 180],
    ['seoDescription', 'seo_description', 320],
  ] as const

  for (const [inputKey, databaseKey, maxLength] of stringFields) {
    if (input[inputKey] === undefined) continue
    const normalized = optionalString(input[inputKey], maxLength)
    if (normalized === undefined) return { ok: false, error: `${inputKey} inválido.` }
    if (inputKey === 'coverImageUrl' && normalized && !isHttpUrl(normalized)) {
      return { ok: false, error: 'URL da capa inválida.' }
    }
    value[databaseKey] = normalized
  }

  const arrayFields = [
    ['topics', 'matched_topics', 'Topics inválidos.'],
    ['seoTags', 'keywords', 'Tags de SEO inválidas.'],
  ] as const

  for (const [inputKey, databaseKey, errorMessage] of arrayFields) {
    if (input[inputKey] !== undefined) {
      const tags = normalizeTags(input[inputKey])
      if (!tags) return { ok: false, error: errorMessage }
      value[databaseKey] = tags
    } else if (!partial) {
      value[databaseKey] = []
    }
  }

  if (input.status !== undefined) {
    if (!EDITORIAL_LIST_STATUSES.includes(input.status as EditorialListStatus)) {
      return { ok: false, error: 'Status inválido.' }
    }
    value.status = input.status
  } else if (!partial) {
    value.status = 'draft'
  }

  return { ok: true, value }
}
