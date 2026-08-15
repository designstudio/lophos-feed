import crypto from 'crypto'

const CURSOR_VERSION = 1
const CURSOR_ALGORITHM = 'aes-256-gcm'
const CURSOR_IV_BYTES = 12
const CURSOR_TAG_BYTES = 16
const CURSOR_MAX_AGE_MS = 24 * 60 * 60 * 1000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type FeedCursorPayload = {
  version: typeof CURSOR_VERSION
  userId: string
  days: number
  topics: string[]
  excludedTopics: string[]
  likedKeywords: string[]
  snapshotAt: string
  rank: 0 | 1
  sortAt: string
  id: string
}

function cursorSecret() {
  const secret = process.env.FEED_CURSOR_SECRET
    ?? process.env.CLERK_SECRET_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!secret) {
    throw new Error('FEED_CURSOR_SECRET (or a server secret fallback) is required')
  }

  return secret
}

function cursorKey(secret = cursorSecret()) {
  return crypto.createHash('sha256').update(secret).digest()
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length <= 500
    && value.every((entry) => typeof entry === 'string' && entry.length <= 200)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function validateCursorPayload(value: unknown, expectedUserId: string): FeedCursorPayload {
  if (!value || typeof value !== 'object') throw new Error('Invalid feed cursor payload')

  const payload = value as Partial<FeedCursorPayload>
  const snapshotTime = isIsoDate(payload.snapshotAt) ? Date.parse(payload.snapshotAt) : Number.NaN

  if (
    payload.version !== CURSOR_VERSION
    || payload.userId !== expectedUserId
    || !Number.isInteger(payload.days)
    || Number(payload.days) < 0
    || Number(payload.days) > 365
    || !isStringArray(payload.topics)
    || payload.topics.length === 0
    || !isStringArray(payload.excludedTopics)
    || !isStringArray(payload.likedKeywords)
    || !isIsoDate(payload.snapshotAt)
    || !isIsoDate(payload.sortAt)
    || (payload.rank !== 0 && payload.rank !== 1)
    || typeof payload.id !== 'string'
    || !UUID_PATTERN.test(payload.id)
    || snapshotTime > Date.now() + 60_000
    || Date.now() - snapshotTime > CURSOR_MAX_AGE_MS
  ) {
    throw new Error('Invalid or expired feed cursor')
  }

  return payload as FeedCursorPayload
}

export function encodeFeedCursor(
  payload: Omit<FeedCursorPayload, 'version'>,
  secret?: string,
) {
  const iv = crypto.randomBytes(CURSOR_IV_BYTES)
  const cipher = crypto.createCipheriv(CURSOR_ALGORITHM, cursorKey(secret), iv)
  const plaintext = Buffer.from(JSON.stringify({ version: CURSOR_VERSION, ...payload }), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return `v${CURSOR_VERSION}.${Buffer.concat([iv, tag, encrypted]).toString('base64url')}`
}

export function decodeFeedCursor(token: string, expectedUserId: string, secret?: string) {
  if (!token.startsWith(`v${CURSOR_VERSION}.`)) throw new Error('Unsupported feed cursor')

  try {
    const packed = Buffer.from(token.slice(token.indexOf('.') + 1), 'base64url')
    if (packed.length <= CURSOR_IV_BYTES + CURSOR_TAG_BYTES) throw new Error('Invalid feed cursor')

    const iv = packed.subarray(0, CURSOR_IV_BYTES)
    const tag = packed.subarray(CURSOR_IV_BYTES, CURSOR_IV_BYTES + CURSOR_TAG_BYTES)
    const encrypted = packed.subarray(CURSOR_IV_BYTES + CURSOR_TAG_BYTES)
    const decipher = crypto.createDecipheriv(CURSOR_ALGORITHM, cursorKey(secret), iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')

    return validateCursorPayload(JSON.parse(plaintext), expectedUserId)
  } catch {
    throw new Error('Invalid or expired feed cursor')
  }
}
