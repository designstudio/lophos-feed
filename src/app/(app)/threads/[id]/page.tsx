import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ThreadPageClient } from '@/components/ThreadPageClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id: threadId } = await params
  const { userId } = await auth()

  if (!userId) {
    return { title: 'Lophos' }
  }

  const db = getSupabaseAdmin()
  const { data: thread } = await db
    .from('chat_threads')
    .select('title')
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle()

  return {
    title: thread?.title ? `${thread.title} - Lophos` : 'Lophos',
  }
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: threadId } = await params
  const { userId } = await auth()

  console.log('[ThreadPage] Loading thread:', { threadId, userId })

  if (!userId) {
    console.error('[ThreadPage] No userId from auth()')
    return notFound()
  }

  const db = getSupabaseAdmin()

  // Fetch thread with verification of user ownership
  const { data: thread, error: threadError } = await db
    .from('chat_threads')
    .select('id, title, article_id, created_at, updated_at')
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle()

  if (threadError) {
    console.error('[ThreadPage] Error fetching thread:', {
      code: threadError.code,
      message: threadError.message,
      threadId,
    })
    return notFound()
  }

  if (!thread) {
    console.error('[ThreadPage] Thread not found (query returned null):', { threadId })
    return notFound()
  }

  // Fetch article details
  const { data: article, error: articleError } = await db
    .from('articles')
    .select('id, title, summary, image_url, topic, sections, matched_topics, published_at')
    .eq('id', thread.article_id)
    .maybeSingle()

  if (articleError || !article) {
    console.error('[ThreadPage] Error fetching article:', articleError, {
      article_id: thread.article_id,
    })
    return notFound()
  }

  // Fetch all messages in thread
  const { data: messages, error: messagesError } = await db
    .from('chat_messages')
    .select('id, role, content, follow_up_suggestions, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (messagesError) {
    console.error('[ThreadPage] Error fetching messages:', messagesError)
    return notFound()
  }

  // Transform messages to ChatMessage format
  const transformedMessages = (messages || []).map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    followUpSuggestions: m.follow_up_suggestions || undefined,
    createdAt: m.created_at,
  }))

  console.log('[ThreadPage] Thread loaded successfully:', {
    threadId: thread.id,
    messageCount: transformedMessages.length,
    articleId: thread.article_id,
  })

  return (
    <ThreadPageClient
      threadId={threadId}
      thread={thread}
      article={article}
      initialMessages={transformedMessages}
    />
  )
}
