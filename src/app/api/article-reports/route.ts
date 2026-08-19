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
  duplicate: 'Matéria duplicada',
  other: 'Outro problema',
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getReportRecipients() {
  return (process.env.ARTICLE_REPORT_EMAIL_TO || 'hello@mail.lophos.space')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Faça login para enviar um reporte.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const articleId = typeof body?.articleId === 'string' ? body.articleId.trim() : ''
  const category = typeof body?.category === 'string' ? body.category : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : ''

  if (!articleId || !CATEGORY_LABELS[category] || description.length < 10 || description.length > 1200) {
    return NextResponse.json({ error: 'Preencha a categoria e descreva o problema.' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[article-reports] RESEND_API_KEY is not configured')
    return NextResponse.json({ error: 'O canal de reportes está temporariamente indisponível.' }, { status: 503 })
  }

  const db = getSupabaseAdmin()
  const { data: article, error: articleError } = await db
    .from('articles')
    .select('title, topic, sources')
    .eq('id', articleId)
    .maybeSingle()

  if (articleError) {
    console.error('[article-reports] article lookup failed:', articleError)
    return NextResponse.json({ error: 'Não foi possível identificar a matéria. Tente novamente.' }, { status: 502 })
  }

  const articleTitle = article?.title || `Matéria ${articleId}`
  const articleTopic = article?.topic || 'Não informado'
  const categoryLabel = CATEGORY_LABELS[category]
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const articleUrl = new URL(`/article/${articleId}`, baseUrl).toString()
  const sources = Array.isArray(article?.sources)
    ? article.sources
        .map((source: unknown) => {
          if (!source || typeof source !== 'object') return null
          const candidate = source as { name?: unknown; url?: unknown }
          if (typeof candidate.url !== 'string') return null
          return `${typeof candidate.name === 'string' ? candidate.name : 'Fonte'}: ${candidate.url}`
        })
        .filter((source): source is string => Boolean(source))
    : []

  const text = [
    'Novo reporte de matéria no Lophos',
    '',
    `Categoria: ${categoryLabel}`,
    `Matéria: ${articleTitle}`,
    `Tópico: ${articleTopic}`,
    `Link: ${articleUrl}`,
    `Usuário: ${userId}`,
    ...(sources.length > 0 ? ['', 'Fontes:', ...sources] : []),
    '',
    'Descrição:',
    description,
  ].join('\n')

  const sourcesHtml = sources.length > 0
    ? `<div style="margin-top:24px"><p style="margin:0 0 8px;color:#69665f;font-size:13px;font-weight:600">Fontes</p><ul style="margin:0;padding-left:20px;color:#69665f;font-size:13px;line-height:1.6">${sources.map((source) => `<li>${escapeHtml(source)}</li>`).join('')}</ul></div>`
    : ''

  const resend = new Resend(apiKey)
  const { data: sentEmail, error: sendError } = await resend.emails.send({
    from: process.env.ARTICLE_REPORT_EMAIL_FROM || 'Lophos <reports@mail.lophos.space>',
    to: getReportRecipients(),
    subject: `[Reporte] ${categoryLabel} — ${articleTitle.slice(0, 90)}`,
    text,
    html: `
      <div style="background:#f5f5f3;padding:32px 16px;font-family:Arial,sans-serif;color:#121210">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid rgba(18,18,16,.1);border-radius:20px;padding:28px">
          <p style="margin:0 0 8px;color:#aaa7a0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Reporte editorial</p>
          <h1 style="margin:0;font-size:22px;line-height:1.3">${escapeHtml(articleTitle)}</h1>
          <div style="margin-top:20px;padding:16px;background:#f5f5f3;border-radius:12px">
            <p style="margin:0 0 6px;font-size:14px"><strong>Categoria:</strong> ${escapeHtml(categoryLabel)}</p>
            <p style="margin:0 0 6px;font-size:14px"><strong>Tópico:</strong> ${escapeHtml(articleTopic)}</p>
            <p style="margin:0;font-size:14px"><strong>Usuário:</strong> ${escapeHtml(userId)}</p>
          </div>
          <div style="margin-top:24px">
            <p style="margin:0 0 8px;color:#69665f;font-size:13px;font-weight:600">Descrição do problema</p>
            <p style="margin:0;font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(description)}</p>
          </div>
          ${sourcesHtml}
          <a href="${escapeHtml(articleUrl)}" style="display:inline-block;margin-top:28px;padding:11px 18px;border-radius:999px;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">Revisar matéria</a>
        </div>
      </div>
    `,
  })

  if (sendError || !sentEmail) {
    console.error('[article-reports] Resend delivery failed:', sendError)
    return NextResponse.json({ error: 'Não foi possível enviar o reporte. Tente novamente.' }, { status: 500 })
  }

  console.info('[article-reports] report email accepted:', { emailId: sentEmail.id, articleId, category })
  return NextResponse.json({ ok: true }, { status: 201 })
}
