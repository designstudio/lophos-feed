import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface CreateThreadRequest {
  articleId: string
  message: string
}

/**
 * POST /api/chat/threads
 * Create a new chat thread and save first user message
 */
export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    console.error('[chat/threads POST] No userId from auth()')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { articleId, message } = (await request.json()) as CreateThreadRequest

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

    // Save first user message to database
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
