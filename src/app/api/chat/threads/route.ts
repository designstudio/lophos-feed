import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const includeErrorDetails = process.env.NODE_ENV !== 'production'

function jsonError(status: number, message: string, err?: unknown) {
  return NextResponse.json(
    {
      error: message,
      ...(includeErrorDetails && err instanceof Error
        ? { detail: { message: err.message, stack: err.stack } }
        : {}),
    },
    { status },
  )
}

interface CreateThreadRequest {
  articleId: string
  message: string
  saveMessage?: boolean
}

interface UpdateThreadRequest {
  threadId: string
  title?: string
}

interface DeleteThreadRequest {
  threadId: string
}

/**
 * POST /api/chat/threads
 * Create or return a chat thread for the current user/article
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      console.error('[chat/threads POST] No userId from auth()')
      return jsonError(401, 'Unauthorized')
    }

    const { articleId, message, saveMessage = true } = (await request.json()) as CreateThreadRequest

    if (!articleId || !message) {
      console.error('[chat/threads POST] Missing required fields:', {
        articleId,
        message: message ? 'provided' : 'missing',
      })
      return jsonError(400, 'Missing articleId or message')
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
      return jsonError(500, 'Database error', fetchError)
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
          return jsonError(500, 'Failed to save message', existingMessageError)
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
      return jsonError(500, 'Failed to create thread', createError)
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
        return jsonError(500, 'Failed to save message', messageError)
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
    return jsonError(500, 'Internal server error', err)
  }
}

/**
 * GET /api/chat/threads?articleId=...
 * Return an existing thread/messages for an article or the recent history list
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return jsonError(401, 'Unauthorized')
    }

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
        return jsonError(500, 'Database error', threadsError)
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
      return jsonError(500, 'Database error', threadError)
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
      return jsonError(500, 'Failed to load messages', messagesError)
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
    return jsonError(500, 'Internal server error', err)
  }
}

/**
 * PATCH /api/chat/threads
 * Rename a thread for the current user
 */
export async function PATCH(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return jsonError(401, 'Unauthorized')
    }

    const { threadId, title } = (await request.json()) as UpdateThreadRequest
    const normalizedTitle = title?.trim()

    if (!threadId || !normalizedTitle) {
      return jsonError(400, 'Missing threadId or title')
    }

    const db = getSupabaseAdmin()

    const { data: thread, error } = await db
      .from('chat_threads')
      .update({
        title: normalizedTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', threadId)
      .eq('user_id', userId)
      .select('id, title, article_id, updated_at')
      .single()

    if (error || !thread) {
      console.error('[chat/threads PATCH] Error renaming thread:', error)
      return jsonError(500, 'Failed to rename thread', error)
    }

    return NextResponse.json({ thread })
  } catch (err) {
    console.error('[chat/threads PATCH] Error:', err)
    return jsonError(500, 'Internal server error', err)
  }
}

/**
 * DELETE /api/chat/threads
 * Delete a thread and its messages for the current user
 */
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return jsonError(401, 'Unauthorized')
    }

    const { threadId } = (await request.json()) as DeleteThreadRequest

    if (!threadId) {
      return jsonError(400, 'Missing threadId')
    }

    const db = getSupabaseAdmin()

    const { error: messagesError } = await db
      .from('chat_messages')
      .delete()
      .eq('thread_id', threadId)
      .eq('user_id', userId)

    if (messagesError) {
      console.error('[chat/threads DELETE] Error deleting messages:', messagesError)
      return jsonError(500, 'Failed to delete thread messages', messagesError)
    }

    const { error: threadError } = await db
      .from('chat_threads')
      .delete()
      .eq('id', threadId)
      .eq('user_id', userId)

    if (threadError) {
      console.error('[chat/threads DELETE] Error deleting thread:', threadError)
      return jsonError(500, 'Failed to delete thread', threadError)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[chat/threads DELETE] Error:', err)
    return jsonError(500, 'Internal server error', err)
  }
}
