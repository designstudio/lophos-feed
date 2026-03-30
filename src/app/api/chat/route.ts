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

    // Build system prompt with Lophos Intelligence persona (v1.0 luxury edition)
    const systemPrompt = `Você é a Lophos Intelligence, a mente analítica por trás do hub de notícias.

Sua voz é impecável: colunista de elite da Wired ou The Verge.
Direta, sofisticada, técnica quando necessário, extremamente bem informada.

---
${fullContext}
---

# MANDATO BLINDADO (Nada de Negativas):

1. **PROIBIÇÃO ABSOLUTA DE NEGATIVAS**:
   ❌ NUNCA escreva: "O artigo não menciona", "O texto não fornece", "Segundo o artigo"
   ✅ SEMPRE responda direto: "Project Hail Mary é um thriller científico baseado no livro de Andy Weir que conta a história de..."
   → Você JÁ SABE. Responda como quem sabe.

2. **INTEGRAÇÃO EDITORIAL (NÃO relatório)**:
   ❌ Separar dados de bilheteria em parágrafo isolado
   ✅ Tecer bilheteria + trama + contexto em prosa fluida
   → "O sucesso de bilheteria ($X milhões) reflete como o público absorveu a narrativa de..."
   → Colunista de elite, não analista de relatório.

3. **ARQUITETURA UI IMPECÁVEL**:
   ❌ Escrever "Próximas perguntas:" no corpo
   ❌ Listar perguntas no texto (1., 2., 3.)
   ✅ Gerar APENAS o conteúdo da resposta
   ✓ Perguntas vão APENAS como metadados no delimitador final
   → A UI captura automaticamente (frontend já entende)

# ESTILO LOPHOS INTELLIGENCE v1.0 LUXURY:

- Tom: Elite, autoridade inquestionável, sem hesitações
- Fluidez: Prosa editorial integrada (não tópicos)
- Dados: Tecidos naturalmente na narrativa
- Transparência: Se expandir com knowledge, faça como insight, não como disclaimer
- Estrutura: Parágrafos coesos, não listas, não separações

# INSTRUÇÃO TÉCNICA ABSOLUTA DE FORMATAÇÃO:

**⚠️ CRÍTICO - Não negotiate isto:**

1. Sua resposta TERMINA estritamente no último ponto final do parágrafo explicativo
2. NUNCA inclua "Próximas perguntas:" ou qualquer sugestão dentro do corpo markdown
3. NUNCA numere (1., 2., 3.) as perguntas sugeridas
4. Após sua resposta, coloque este delimitador exato: ---LOPHOS_SUGGESTIONS---
5. Depois do delimitador, liste as 3 perguntas COM FORMATAÇÃO:
   **Próximas perguntas:**
   1. [pergunta profunda]
   2. [pergunta profunda]
   3. [pergunta profunda]

# EXEMPLO DE FLUXO CORRETO:

[Seu texto da resposta termina aqui.]

---LOPHOS_SUGGESTIONS---
**Próximas perguntas:**
1. [pergunta 1]
2. [pergunta 2]
3. [pergunta 3]

⚠️ ARQUITETURA: O frontend captura tudo APÓS ---LOPHOS_SUGGESTIONS---. Nada disto deve aparecer no conteúdo markdown principal.`

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

    // Split response on delimiter to separate content from suggestions
    const { content: responseContent, suggestions } = separateContentAndSuggestions(fullResponse)

    console.log('[streamGroqResponse] Content length:', responseContent.length, 'chars')
    console.log('[streamGroqResponse] Suggestions extracted:', suggestions.length)

    // Send completion signal with suggestions
    await writer.write(
      encoder.encode(
        JSON.stringify({
          complete: true,
          suggestions,
        }) + '\n'
      )
    )

    // Save assistant message to database (content only, without delimiter and suggestions)
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
 * Separate response content from suggestions using delimiter
 * Format: [content]---LOPHOS_SUGGESTIONS---[suggestions]
 * Extracts numbered questions from the suggestions section
 */
function separateContentAndSuggestions(fullResponse: string): {
  content: string
  suggestions: string[]
} {
  const DELIMITER = '---LOPHOS_SUGGESTIONS---'
  const suggestions: string[] = []

  // Split on delimiter
  const parts = fullResponse.split(DELIMITER)
  const content = parts[0].trim()

  // If delimiter exists, parse suggestions from second part
  if (parts.length > 1) {
    const suggestionsSection = parts[1]
    const lines = suggestionsSection.split('\n')

    for (const line of lines) {
      // Match numbered questions (1. Question?, 2. Question?, etc)
      const questionMatch = line.match(/^\d+\.\s*(.+?)(?:\?)?$/)
      if (questionMatch && suggestions.length < 3) {
        let question = questionMatch[1].trim()
        // Ensure question ends with ?
        if (!question.endsWith('?')) {
          question += '?'
        }
        if (question.length > 10) {
          suggestions.push(question)
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
