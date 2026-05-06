import type { GetReceivingEmailResponseSuccess } from 'resend'

export interface NormalizedInboundEmail {
  ok: true
  emailId: string
  routeKey: string | null
  subject: string
  from: string
  to: string[]
  cc: string[]
  bcc: string[]
  text: string | null
  html: string | null
  headers: Record<string, string>
  attachments: GetReceivingEmailResponseSuccess['attachments']
  receivedAt: string
  messageId: string
}

export function buildRecipientRouteKey(recipients: string[]) {
  const firstRecipient = recipients[0]?.trim().toLowerCase()
  if (!firstRecipient) return null

  const [localPart] = firstRecipient.split('@')
  return localPart || null
}

export function normalizeInboundEmail(email: GetReceivingEmailResponseSuccess): NormalizedInboundEmail {
  return {
    ok: true,
    emailId: email.id,
    routeKey: buildRecipientRouteKey(email.to),
    subject: email.subject,
    from: email.from,
    to: email.to,
    cc: email.cc ?? [],
    bcc: email.bcc ?? [],
    text: email.text,
    html: email.html,
    headers: email.headers ?? {},
    attachments: email.attachments ?? [],
    receivedAt: email.created_at,
    messageId: email.message_id,
  }
}
