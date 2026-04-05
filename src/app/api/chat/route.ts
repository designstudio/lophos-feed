import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface ChatRequest {
  threadId: string
  articleId: string
  message: string
}

interface StoredMessage {
  role: 'user' | 'assistant'
  content: string
}

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set')
  }

  return new Groq({ apiKey })
}

function buildArticleContext(article: {
  title: string
  topic: string
  summary?: string | null
  sections?: any
}, rawContent?: string | null) {
  let articleContent = article.summary?.trim() || ''

  if (rawContent?.trim()) {
    articleContent = rawContent.trim()
  } else if (article.sections && Array.isArray(article.sections) && article.sections.length > 0) {
    articleContent = article.sections
      .map((section: any) => {
        const heading = section.heading || section.title || section.name || ''
        const body = section.body || section.content || section.text || ''
        if (!body) return heading
        return heading ? `${heading}\n${body}` : body
      })
      .filter((text: string) => text && text.trim().length > 0)
      .join('\n\n')
  }

  if (!articleContent) {
    return null
  }

  return [
    `TITULO: ${article.title}`,
    `TOPICO: ${article.topic}`,
    article.summary ? `RESUMO: ${article.summary}` : '',
    '',
    'CONTEUDO DO ARTIGO:',
    articleContent,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { threadId, articleId, message } = (await request.json()) as ChatRequest

    if (!threadId || !articleId || !message?.trim()) {
      return NextResponse.json(
        { error: 'Missing threadId, articleId, or message' },
        { status: 400 }
      )
    }

    const db = getSupabaseAdmin()

    const { data: thread, error: threadError } = await db
      .from('chat_threads')
      .select('id, article_id')
      .eq('id', threadId)
      .eq('user_id', userId)
      .maybeSingle()

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const { data: article, error: articleError } = await db
      .from('articles')
      .select('id, title, topic, summary, sections')
      .eq('id', articleId)
      .maybeSingle()

    if (articleError || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const { data: rawItem } = await db
      .from('raw_items')
      .select('content')
      .eq('title', article.title)
      .maybeSingle()

    const fullContext = buildArticleContext(article, rawItem?.content)

    if (!fullContext) {
      return NextResponse.json({ error: 'Article content not found' }, { status: 404 })
    }

    const { error: userMessageError } = await db.from('chat_messages').insert({
      thread_id: threadId,
      user_id: userId,
      role: 'user',
      content: message.trim(),
    })

    if (userMessageError) {
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
    }

    const { data: historyRows, error: historyError } = await db
      .from('chat_messages')
      .select('role, content')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (historyError) {
      return NextResponse.json(
        { error: 'Failed to load conversation history' },
        { status: 500 }
      )
    }

    const conversationHistory = (historyRows || [])
      .filter((row) => row.role === 'user' || row.role === 'assistant')
      .slice(-12) as StoredMessage[]

    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    streamGroqResponse(
      writer,
      encoder,
      threadId,
      userId,
      db,
      fullContext,
      conversationHistory
    ).catch(async (err) => {
      console.error('[chat POST] Streaming error:', err)
      await writer.close()
    })

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err) {
    console.error('[chat POST] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function streamGroqResponse(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  threadId: string,
  userId: string,
  db: any,
  fullContext: string,
  conversationHistory: StoredMessage[]
) {
  try {
    const groq = getGroqClient()

    const systemPrompt = `Voce e a Lophos Intelligence, assistente editorial do Lophos.

Responda em portugues do Brasil, a menos que a pessoa escreva claramente em outro idioma.

Use o artigo abaixo como contexto principal para resolver referencias ambiguas como "o filme", "isso", "essa noticia" ou "esse lancamento". Quando fizer sentido, complemente com conhecimento geral confiavel para explicar contexto, antecedentes, adaptacao, elenco, impacto cultural, mercado ou tecnologia.

Prioridades:
1. Entenda a pergunta a luz do artigo.
2. Complemente com conhecimento geral quando isso melhorar a resposta.
3. Responda de forma natural e objetiva, sem frases como "o artigo nao menciona" ou "segundo o artigo".
4. Se estiver combinando contexto do artigo com conhecimento geral, faca isso com fluidez.
5. Nao invente detalhes especificos.

Formato:
- Use paragrafos curtos e claros.
- Pode usar subtitulos curtos em markdown quando ajudar.
- Nao coloque sugestoes dentro do corpo principal.

Contexto do artigo:
---
${fullContext}
---

Sua resposta deve terminar com o delimitador ---LOPHOS_SUGGESTIONS--- e, depois dele, trazer exatamente 3 perguntas de acompanhamento neste formato:
**Proximas perguntas:**
1. ...
2. ...
3. ...`

    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
      ],
      stream: true,
      temperature: 0.4,
      max_tokens: 2200,
      top_p: 0.9,
    })

    let fullResponse = ''
    let tokenCount = 0

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      if (!text) continue

      fullResponse += text
      tokenCount += 1
      await writer.write(encoder.encode(JSON.stringify({ token: text, index: tokenCount }) + '\n'))
    }

    const { content: responseContent, suggestions } = separateContentAndSuggestions(fullResponse)

    await writer.write(
      encoder.encode(JSON.stringify({ complete: true, suggestions }) + '\n')
    )

    const { error: messageError } = await db.from('chat_messages').insert({
      thread_id: threadId,
      user_id: userId,
      role: 'assistant',
      content: responseContent,
      follow_up_suggestions: suggestions,
    })

    if (messageError) {
      console.error('[streamGroqResponse] Error saving assistant message:', messageError)
    }

    await db
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId)

    await writer.close()
  } catch (err) {
    console.error('[streamGroqResponse] Error:', err)
    await writer.write(
      encoder.encode(JSON.stringify({ error: 'Failed to generate response', complete: true }) + '\n')
    )
    await writer.close()
  }
}

function separateContentAndSuggestions(fullResponse: string): {
  content: string
  suggestions: string[]
} {
  const delimiter = '---LOPHOS_SUGGESTIONS---'
  const suggestions: string[] = []
  const parts = fullResponse.split(delimiter)
  const content = parts[0].trim()

  if (parts.length > 1) {
    const lines = parts[1].split('\n')

    for (const line of lines) {
      const questionMatch = line.match(/^\d+\.\s*(.+?)(?:\?)?$/)
      if (!questionMatch || suggestions.length >= 3) continue

      let question = questionMatch[1].trim()
      if (!question.endsWith('?')) {
        question += '?'
      }

      if (question.length > 10) {
        suggestions.push(question)
      }
    }
  }

  if (suggestions.length < 3) {
    const fallbacks = [
      'Qual e o contexto mais amplo disso?',
      'Quais sao as implicacoes praticas?',
      'Como isso se conecta com o restante do artigo?',
    ]

    return {
      content,
      suggestions: [...suggestions, ...fallbacks.slice(0, 3 - suggestions.length)],
    }
  }

  return {
    content,
    suggestions: suggestions.slice(0, 3),
  }
}
