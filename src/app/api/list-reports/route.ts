import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

const CATEGORY_LABELS: Record<string, string> = {
  incorrect_information: 'Informação incorreta',
  title_or_summary: 'Título ou resumo',
  source_or_link: 'Fonte ou link',
  image_or_video: 'Imagem ou vídeo',
  duplicate: 'Lista duplicada',
  other: 'Outro problema',
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

function recipients() {
  return (process.env.ARTICLE_REPORT_EMAIL_TO || 'hello@mail.lophos.space').split(',').map((value) => value.trim()).filter(Boolean)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Faça login para enviar um reporte.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const listId = typeof body?.listId === 'string' ? body.listId.trim() : ''
  const category = typeof body?.category === 'string' ? body.category : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  if (!listId || !CATEGORY_LABELS[category] || description.length < 10 || description.length > 1200) {
    return NextResponse.json({ error: 'Preencha a categoria e descreva o problema.' }, { status: 400 })
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[list-reports] RESEND_API_KEY is not configured')
    return NextResponse.json({ error: 'O canal de reportes está temporariamente indisponível.' }, { status: 503 })
  }

  const { data: list, error } = await getSupabaseAdmin()
    .from('editorial_lists')
    .select('title, slug, topic')
    .eq('id', listId)
    .eq('status', 'published')
    .maybeSingle()

  if (error || !list) return NextResponse.json({ error: 'Não foi possível identificar a lista.' }, { status: 404 })

  const categoryLabel = CATEGORY_LABELS[category]
  const url = new URL(`/lists/${list.slug}`, process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).toString()
  const text = ['Novo reporte de lista no Lophos', '', `Categoria: ${categoryLabel}`, `Lista: ${list.title}`, `Tópico: ${list.topic}`, `Link: ${url}`, `Usuário: ${userId}`, '', 'Descrição:', description].join('\n')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: sentEmail, error: sendError } = await resend.emails.send({
    from: process.env.ARTICLE_REPORT_EMAIL_FROM || 'Lophos <reports@mail.lophos.space>',
    to: recipients(),
    subject: `[Reporte de lista] ${categoryLabel} — ${list.title.slice(0, 90)}`,
    text,
    html: `<div style="background:#f5f5f3;padding:32px 16px;font-family:Arial,sans-serif;color:#121210"><div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid rgba(18,18,16,.1);border-radius:20px;padding:28px"><p style="margin:0 0 8px;color:#aaa7a0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Reporte editorial · lista</p><h1 style="margin:0;font-size:22px;line-height:1.3">${escapeHtml(list.title)}</h1><div style="margin-top:20px;padding:16px;background:#f5f5f3;border-radius:12px"><p style="margin:0 0 6px;font-size:14px"><strong>Categoria:</strong> ${escapeHtml(categoryLabel)}</p><p style="margin:0 0 6px;font-size:14px"><strong>Tópico:</strong> ${escapeHtml(list.topic)}</p><p style="margin:0;font-size:14px"><strong>Usuário:</strong> ${escapeHtml(userId)}</p></div><div style="margin-top:24px"><p style="margin:0 0 8px;color:#69665f;font-size:13px;font-weight:600">Descrição do problema</p><p style="margin:0;font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(description)}</p></div><a href="${escapeHtml(url)}" style="display:inline-block;margin-top:28px;padding:11px 18px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-size:14px;font-weight:600">Revisar lista</a></div></div>`,
  })

  if (sendError || !sentEmail) {
    console.error('[list-reports] Resend delivery failed:', sendError)
    return NextResponse.json({ error: 'Não foi possível enviar o reporte. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
