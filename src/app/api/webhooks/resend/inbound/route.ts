import { NextRequest, NextResponse } from 'next/server'
import { Resend, type EmailReceivedEvent } from 'resend'
import { normalizeInboundEmail } from '@/lib/resend-inbound'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }

  return new Resend(apiKey)
}

function getWebhookSecret() {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw new Error('RESEND_WEBHOOK_SECRET environment variable is not set')
  }

  return webhookSecret
}

function getWebhookHeaders(request: NextRequest) {
  const id = request.headers.get('svix-id')
  const timestamp = request.headers.get('svix-timestamp')
  const signature = request.headers.get('svix-signature')

  if (!id || !timestamp || !signature) {
    return null
  }

  return { id, timestamp, signature }
}

export async function POST(request: NextRequest) {
  let payload = ''

  try {
    payload = await request.text()

    const webhookHeaders = getWebhookHeaders(request)
    if (!webhookHeaders) {
      return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
    }

    const resend = getResendClient()
    const event = resend.webhooks.verify({
      payload,
      headers: webhookHeaders,
      webhookSecret: getWebhookSecret(),
    })

    if (event.type !== 'email.received') {
      return NextResponse.json({
        ok: true,
        ignored: true,
        eventType: event.type,
      })
    }

    const receivedEvent = event as EmailReceivedEvent
    const { data, error } = await resend.emails.receiving.get(receivedEvent.data.email_id)

    if (error || !data) {
      console.error('[resend inbound webhook] Failed to fetch email content', {
        emailId: receivedEvent.data.email_id,
        error,
      })

      return NextResponse.json(
        { error: 'Failed to fetch received email content' },
        { status: 502 }
      )
    }

    const normalizedEmail = normalizeInboundEmail(data)

    // Point of extension: route by `routeKey`, persist to Supabase, create tickets, etc.
    console.info('[resend inbound webhook] Email received', {
      emailId: normalizedEmail.emailId,
      routeKey: normalizedEmail.routeKey,
      from: normalizedEmail.from,
      to: normalizedEmail.to,
      subject: normalizedEmail.subject,
      attachmentCount: normalizedEmail.attachments.length,
    })

    return NextResponse.json(normalizedEmail)
  } catch (error) {
    console.error('[resend inbound webhook] Unexpected error', error)

    return NextResponse.json(
      {
        error: 'Invalid inbound webhook request',
        payloadReceived: Boolean(payload),
      },
      { status: 400 }
    )
  }
}
