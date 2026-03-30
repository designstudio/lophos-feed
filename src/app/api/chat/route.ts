import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import Groq from 'groq-sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds for streaming

interface ChatRequest {
  threadId: string
  articleId: string
  message: string
}

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set')
  }
  return new Groq({ apiKey })
}

/**
 * POST /api/chat
 * Stream Groq (Lophos Intelligence v1.0) response and save to database
 */
export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    console.error('[chat POST] No userId from auth()')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { threadId, articleId, message } = (await request.json()) as ChatRequest

    if (!threadId || !articleId || !message) {
      console.error('[chat POST] Missing required fields:', {
        threadId: threadId ? 'ok' : 'missing',
        articleId: articleId ? 'ok' : 'missing',
        message: message ? 'ok' : 'missing',
      })
      return NextResponse.json(
        { error: 'Missing threadId, articleId, or message' },
        { status: 400 }
      )
    }

    const db = getSupabaseAdmin()

    // Verify thread belongs to user
    const { data: thread, error: threadError } = await db
      .from('chat_threads')
      .select('id, article_id')
      .eq('id', threadId)
      .eq('user_id', userId)
      .maybeSingle()

    if (threadError || !thread) {
      console.error('[chat POST] Thread not found or unauthorized:', threadError)
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Fetch article details from articles table (to validate ID and get title, topic)
    const { data: article, error: articleError } = await db
      .from('articles')
      .select('id, title, topic, sections')
      .eq('id', articleId)
      .maybeSingle()

    if (articleError || !article) {
      console.error('[chat POST] Article not found:', articleError)
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    // Fetch raw article content from raw_items using article title as link
    const { data: rawItem, error: rawError } = await db
      .from('raw_items')
      .select('content, title')
      .eq('title', article.title)
      .maybeSingle()

    let articleContent = ''

    // Primary source: raw_items.content
    if (rawItem?.content) {
      articleContent = rawItem.content
      console.log('[chat POST] Using content from raw_items for article:', article.title)
      console.log('[chat POST] Content length:', articleContent.length, 'chars')
    }
    // Fallback: reconstruct from article.sections (JSONB array)
    else if (article.sections && Array.isArray(article.sections) && article.sections.length > 0) {
      console.log('[chat POST] raw_items not found, extracting from sections for article:', article.title)
      console.log('[chat POST] Sections structure:', JSON.stringify(article.sections[0], null, 2).substring(0, 200))

      // Extract text from sections - handle different field names
      articleContent = article.sections
        .map((section: any) => {
          // Try multiple field names that might contain content
          const heading = section.heading || section.title || section.name || ''
          const body = section.body || section.content || section.text || ''
          if (!body) return heading
          return heading ? `${heading}\n${body}` : body
        })
        .filter((text: string) => text && text.trim().length > 0)
        .join('\n\n')

      console.log('[chat POST] Extracted sections content length:', articleContent.length, 'chars')
    }

    if (!articleContent) {
      console.error('[chat POST] Article has no content in raw_items or sections:', { articleId, title: article.title })
      return NextResponse.json(
        { error: 'Article content not found' },
        { status: 404 }
      )
    }

    // Build full context with title, topic, and content
    const fullContext = `TÍTULO: ${article.title}
TÓPICO: ${article.topic}

CONTEÚDO:
${articleContent}`

    // Debug: Verify context is being passed correctly to Groq
    console.log('[chat POST] Full context being sent to Groq:')
    console.log('[chat POST] - Title:', article.title)
    console.log('[chat POST] - Topic:', article.topic)
    console.log('[chat POST] - Content length:', articleContent.length, 'chars')
    console.log('[chat POST] - Full context length:', fullContext.length, 'chars')

    // Save user message to database
    const { error: userMessageError } = await db.from('chat_messages').insert({
      thread_id: threadId,
      user_id: userId,
      role: 'user',
      content: message,
    })

    if (userMessageError) {
      console.error('[chat POST] Error saving user message:', userMessageError)
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      )
    }

    // Setup streaming response
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    // Stream Groq response in background
    streamGroqResponse(
      writer,
      encoder,
      threadId,
      userId,
      db,
      fullContext,
      message
    ).catch((err) => {
      console.error('[chat POST] Streaming error:', err)
      writer.close()
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

/**
 * Stream Groq (Lophos Intelligence v1.0) response and save to database
 */
async function streamGroqResponse(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  threadId: string,
  userId: string,
  db: any,
  fullContext: string,
  userMessage: string
) {
  try {
    const groq = getGroqClient()

    // Build system prompt with Lophos Intelligence persona (v1.0 official)
    const systemPrompt = `Você é a Lophos Intelligence, a mente analítica por trás do hub de notícias.

Sua voz é direta, sofisticada, técnica quando necessário e extremamente bem informada.

# Seu Contexto Primário:
Você recebeu um artigo abaixo como REFERÊNCIA PRINCIPAL. Use-o como âncora.

---
${fullContext}
---

# Seu Mandato (Modelo Agnóstico Inteligente):
1. **Âncora no Artigo**: Sempre base suas respostas no texto fornecido acima
2. **Inteligência Profunda**: Sua base de conhecimento permite completar lacunas com contexto histórico, técnico e analítico
3. **Exemplo Prático**: Se o usuário pergunta do enredo de um filme que só tem bilheteria no texto, você dá o show de conhecimento que a Lophos Intelligence possui
4. **Transparência Sofisticada**: Quando usar conhecimento adicional, deixe claro (ex: "O artigo menciona X. Historicamente, Y também é relevante porque...")

# Regras de Excelência:
- Sempre mencione o TÍTULO e TÓPICO quando relevante
- Cite dados, números e fatos específicos do artigo como fundação
- Seja direto: sem floreios, sem genéricos. Analítico e preciso.
- Se não puder responder, diga claramente. Lophos Intelligence não mente.
- **CRÍTICO**: NUNCA escreva "Próximas perguntas:" no corpo da resposta
- SEMPRE termine com EXATAMENTE 3 perguntas no formato abaixo

# Formato Obrigatório Final (SEM "Próximas perguntas:" no corpo):
**Próximas perguntas:**
1. [pergunta analítica relacionada ao artigo ou tópico]
2. [pergunta analítica relacionada ao artigo ou tópico]
3. [pergunta analítica relacionada ao artigo ou tópico]

⚠️ ARQUITETURA: O texto "Próximas perguntas:" é delimitador ÚNICO para a UI extrair sugestões. Aparece apenas nesta seção final.`

    console.log('[streamGroqResponse] Starting Groq (Lophos Intelligence v1.0) stream for threadId:', threadId)
    console.log('[streamGroqResponse] Full context length:', fullContext.length, 'chars')
    console.log('[streamGroqResponse] Context preview (first 300 chars):', fullContext.substring(0, 300))

    // Stream from Groq with hybrid knowledge mode
    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      stream: true,
      temperature: 0.6, // Slightly lower for better consistency with article-based answers
      max_tokens: 3000, // Increased for richer, more complete responses
      top_p: 0.9,
    })

    let fullResponse = ''
    let tokenCount = 0

    // Stream tokens to client
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      if (text) {
        fullResponse += text
        tokenCount++

        // Send token to client as NDJSON
        const data = { token: text, index: tokenCount }
        await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
      }
    }

    console.log('[streamGroqResponse] Groq stream complete:', {
      threadId,
      tokenCount,
      contentLength: fullResponse.length,
    })

    // Extract follow-up suggestions from response
    const suggestions = extractFollowUpSuggestions(fullResponse)

    // Send completion signal with suggestions
    await writer.write(
      encoder.encode(
        JSON.stringify({
          complete: true,
          suggestions,
        }) + '\n'
      )
    )

    // Save assistant message to database
    const { error: messageError } = await db.from('chat_messages').insert({
      thread_id: threadId,
      user_id: userId,
      role: 'assistant',
      content: fullResponse,
      follow_up_suggestions: suggestions,
    })

    if (messageError) {
      console.error('[streamGroqResponse] Error saving assistant message:', messageError)
    }

    // Update thread's updated_at timestamp
    await db
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId)

    await writer.close()
  } catch (err) {
    console.error('[streamGroqResponse] Error:', err)
    const errorMsg = JSON.stringify({
      error: 'Failed to generate response',
      complete: true,
    }) + '\n'
    await writer.write(encoder.encode(errorMsg))
    await writer.close()
  }
}

/**
 * Extract follow-up suggestions from response
 * Looks for 3 questions in the format:
 * **Próximas perguntas:**
 * 1. Question?
 * 2. Question?
 * 3. Question?
 */
function extractFollowUpSuggestions(response: string): string[] {
  const suggestions: string[] = []

  // Look for the "Próximas perguntas:" section
  const match = response.match(
    /\*\*Próximas perguntas:\*\*\s*([\s\S]*?)(?:$|---)/i
  )

  if (match) {
    const suggestionsText = match[1]
    const lines = suggestionsText.split('\n')

    for (const line of lines) {
      // Match numbered questions
      const questionMatch = line.match(/^\d+\.\s*(.+?)$/)
      if (questionMatch && suggestions.length < 3) {
        const question = questionMatch[1].trim()
        if (question.length > 10) {
          suggestions.push(question)
        }
      }
    }
  }

  // Fallback to parsing any lines ending with ?
  if (suggestions.length < 3) {
    const lines = response.split('\n')
    for (const line of lines) {
      if (line.includes('?') && suggestions.length < 3) {
        const cleaned = line.replace(/^[\s\d\.\)\-\*]*/, '').trim()
        if (cleaned.length > 10 && !suggestions.includes(cleaned)) {
          suggestions.push(cleaned)
        }
      }
    }
  }

  // Fallback to generic suggestions if not found
  if (suggestions.length < 3) {
    const fallbacks = [
      'Qual é o contexto histórico disto?',
      'Quais são as implicações práticas?',
      'Como isto se conecta com outros fatos do artigo?',
    ]
    return [...suggestions, ...fallbacks.slice(0, 3 - suggestions.length)]
  }

  return suggestions.slice(0, 3)
}
