import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface CreateThreadRequest {
  articleId: string
  message: string
  saveMessage?: boolean
}

/**
 * POST /api/chat/threads
 * Create or return a chat thread for the current user/article
 */
export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    console.error('[chat/threads POST] No userId from auth()')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { articleId, message, saveMessage = true } = (await request.json()) as CreateThreadRequest

    if (!articleId || !message) {
      console.error('[chat/threads POST] Missing required fields:', {
        articleId,
        message: message ? 'provided' : 'missing',
      })
      return NextResponse.json(
        { error: 'Missing articleId or message' },
        { status: 400 }
      )
    }

    const db = getSupabaseAdmin()

    // Check if thread already exists for this user + article
    const { data: existingThread, error: fetchError } = await db
      .from('chat_threads')
      .select('id, title')
      .eq('user_id', userId)
      .eq('article_id', articleId)
      .maybeSingle()

    if (fetchError) {
      console.error('[chat/threads POST] Error fetching existing thread:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // If thread exists, return it
    if (existingThread) {
      console.log('[chat/threads POST] Thread already exists:', {
        threadId: existingThread.id,
        userId,
        articleId,
      })

      if (saveMessage) {
        const { error: existingMessageError } = await db.from('chat_messages').insert({
          thread_id: existingThread.id,
          user_id: userId,
          role: 'user',
          content: message,
        })

        if (existingMessageError) {
          console.error('[chat/threads POST] Error saving message to existing thread:', existingMessageError)
          return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
        }
      }

      return NextResponse.json({
        id: existingThread.id,
        title: existingThread.title,
        isNew: false,
      })
    }

    // Create new thread with title from first message
    const threadTitle = message.length > 50 ? message.substring(0, 47) + '...' : message

    console.log('[chat/threads POST] Creating new thread:', {
      userId,
      articleId,
      title: threadTitle,
    })

    const { data: newThread, error: createError } = await db
      .from('chat_threads')
      .insert({
        user_id: userId,
        article_id: articleId,
        title: threadTitle,
      })
      .select('id')
      .single()

    if (createError || !newThread) {
      console.error('[chat/threads POST] Error creating thread:', createError)
      return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 })
    }

    if (saveMessage) {
      const { error: messageError } = await db.from('chat_messages').insert({
        thread_id: newThread.id,
        user_id: userId,
        role: 'user',
        content: message,
      })

      if (messageError) {
        console.error('[chat/threads POST] Error saving first message:', messageError)
        return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
      }
    }

    console.log('[chat/threads POST] Thread created successfully:', {
      threadId: newThread.id,
      userId,
      articleId,
    })

    return NextResponse.json({
      id: newThread.id,
      title: threadTitle,
      isNew: true,
    })
  } catch (err) {
    console.error('[chat/threads POST] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/chat/threads?articleId=...
 * Return an existing thread/messages for an article or the recent history list
 */
export async function GET(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const articleId = searchParams.get('articleId')

    const db = getSupabaseAdmin()

    if (!articleId) {
      const { data: threads, error: threadsError } = await db
        .from('chat_threads')
        .select('id, title, article_id, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(12)

      if (threadsError) {
        console.error('[chat/threads GET] Error fetching history:', threadsError)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }

      return NextResponse.json({
        threads: threads || [],
      })
    }

    const { data: thread, error: threadError } = await db
      .from('chat_threads')
      .select('id, title, article_id')
      .eq('user_id', userId)
      .eq('article_id', articleId)
      .maybeSingle()

    if (threadError) {
      console.error('[chat/threads GET] Error fetching thread:', threadError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!thread) {
      return NextResponse.json({ thread: null, messages: [] })
    }

    const { data: messages, error: messagesError } = await db
      .from('chat_messages')
      .select('id, role, content, follow_up_suggestions, created_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('[chat/threads GET] Error fetching messages:', messagesError)
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
    }

    return NextResponse.json({
      thread,
      messages: (messages || []).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        followUpSuggestions: message.follow_up_suggestions || undefined,
        createdAt: message.created_at,
      })),
    })
  } catch (err) {
    console.error('[chat/threads GET] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
