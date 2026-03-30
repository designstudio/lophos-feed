import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds for streaming

interface ChatRequest {
  threadId: string
  articleId: string
  message: string
}

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable is not set')
  }
  const genAI = new GoogleGenerativeAI(apiKey)
  // Configure to use v1 API
  return genAI
}

/**
 * POST /api/chat
 * Stream Gemini 3 Flash Preview response and save to database
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

    // Fetch article details from articles table (to validate ID and get title)
    const { data: article, error: articleError } = await db
      .from('articles')
      .select('id, title, sections')
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
    }
    // Fallback: reconstruct from article.sections
    else if (article.sections && Array.isArray(article.sections)) {
      console.log('[chat POST] raw_items not found, using sections fallback for article:', article.title)
      articleContent = article.sections
        .map((section: any) => `${section.heading}\n${section.body}`)
        .join('\n\n')
    }

    if (!articleContent) {
      console.error('[chat POST] Article has no content in raw_items or sections:', { articleId, title: article.title })
      return NextResponse.json(
        { error: 'Article content not found' },
        { status: 404 }
      )
    }

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

    // Stream Gemini response in background
    streamGeminiResponse(
      writer,
      encoder,
      threadId,
      userId,
      db,
      articleContent,
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
 * Stream Gemini 3 Flash Preview response and save to database
 */
async function streamGeminiResponse(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  threadId: string,
  userId: string,
  db: any,
  articleContent: string,
  userMessage: string
) {
  try {
    const genAI = getGeminiClient()

    // Initialize Gemini 3 Flash Preview model with v1 API
    const model = genAI.getGenerativeModel(
      {
        model: 'gemini-3-flash-preview',
      },
      {
        apiVersion: 'v1',
      }
    )

    // Build system prompt with Chicote Sênior persona
    const systemPrompt = `Você é o Chicote Sênior, curador editorial experiente do Lophos.

Use EXCLUSIVAMENTE o texto bruto fornecido do artigo para responder às perguntas:
---
${articleContent}
---

Regras:
- Base suas respostas EXCLUSIVAMENTE no texto fornecido acima
- Cite dados, números e fatos específicos do artigo
- Seja direto, técnico e preciso
- Se a pergunta não puder ser respondida com base no artigo, diga claramente
- Ao final, sempre sugira 3 perguntas de seguimento sobre tópicos ainda não explorados

Formato de sugestões de follow-up:
**Próximas perguntas:**
1. [pergunta específica ao artigo]
2. [pergunta específica ao artigo]
3. [pergunta específica ao artigo]`

    console.log('[streamGeminiResponse] Starting Gemini 3 Flash Preview stream for threadId:', threadId)

    // Stream from Gemini
    const stream = await model.generateContentStream({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: systemPrompt,
            },
          ],
        },
        {
          role: 'user',
          parts: [
            {
              text: userMessage,
            },
          ],
        },
      ],
    })

    let fullResponse = ''
    let tokenCount = 0

    // Stream tokens to client
    for await (const chunk of stream.stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (text) {
        fullResponse += text
        tokenCount++

        // Send token to client as NDJSON
        const data = { token: text, index: tokenCount }
        await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
      }
    }

    console.log('[streamGeminiResponse] Gemini stream complete:', {
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
      console.error('[streamGeminiResponse] Error saving assistant message:', messageError)
    }

    // Update thread's updated_at timestamp
    await db
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId)

    await writer.close()
  } catch (err) {
    console.error('[streamGeminiResponse] Error:', err)
    const errorMsg = JSON.stringify({
      error: 'Failed to generate response',
      complete: true,
    }) + '\n'
    await writer.write(encoder.encode(errorMsg))
    await writer.close()
  }
}

/**
 * Extract follow-up suggestions from Gemini response
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
