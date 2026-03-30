import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ChatThread } from '@/components/ChatThread'
import { ArrowLeft } from '@solar-icons/react-perf/Linear'
import Link from 'next/link'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  followUpSuggestions?: string[]
  createdAt: string
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
  const transformedMessages: ChatMessage[] = (messages || []).map((m) => ({
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
    <div className="h-screen flex flex-col bg-white dark:bg-[#1a1a1a]">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-[#E9E9E9] dark:border-[#2a2a2a] px-4 md:px-8 bg-[#F9F9F9] dark:bg-[#1f1f1f]">
        <div className="flex items-center h-14 gap-3 max-w-3xl mx-auto">
          <Link
            href={`/article/${article.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E9E9E9] dark:border-[#2a2a2a] hover:bg-[#F0F0F0] dark:hover:bg-[#2a2a2a] text-sm text-[#666] dark:text-[#999] transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Voltar</span>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-black dark:text-white truncate">
              {thread.title}
            </h1>
          </div>
        </div>
      </div>

      {/* Article Reference Card */}
      <div className="border-b border-[#E9E9E9] dark:border-[#2a2a2a] px-4 md:px-8 py-4 bg-[#F9F9F9] dark:bg-[#1f1f1f]">
        <div className="max-w-3xl mx-auto flex gap-3">
          {article.image_url && (
            <img
              src={article.image_url}
              alt={article.title}
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-[#666] dark:text-[#999] uppercase tracking-wider">
                {article.topic}
              </span>
            </div>
            <h2 className="font-bold text-sm leading-tight text-black dark:text-white line-clamp-2">
              {article.title}
            </h2>
            <p className="text-xs text-[#888] dark:text-[#aaa] mt-1">
              {new Date(article.published_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <ChatThread
        threadId={threadId}
        articleId={article.id}
        initialMessages={transformedMessages}
        isEmbedded={false}
        autoRespond={true}
      />
    </div>
  )
}
