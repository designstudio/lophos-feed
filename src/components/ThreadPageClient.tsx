'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from '@solar-icons/react-perf/Linear'
import { ChatThread } from '@/components/ChatThread'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  followUpSuggestions?: string[]
  createdAt: string
}

interface ThreadPageClientProps {
  threadId: string
  thread: {
    id: string
    title: string
    article_id: string
  }
  article: {
    id: string
    title: string
    image_url: string
    topic: string
    published_at: string
  }
  initialMessages: ChatMessage[]
}

export function ThreadPageClient({
  threadId,
  thread,
  article,
  initialMessages,
}: ThreadPageClientProps) {
  const [showTitle, setShowTitle] = useState(false)
  const titleRef = useRef<HTMLDivElement>(null)

  // Monitor article reference card visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowTitle(!entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    if (titleRef.current) {
      observer.observe(titleRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      {/* Main scrollable content area */}
      <div className="flex-1 overflow-y-auto min-w-0 transition-all duration-300">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 border-b border-border px-4 md:px-8 header-blur">
          <div className="flex items-center h-12 md:h-14 gap-3">
            <Link
              href={`/article/${article.id}`}
              className="spring-press flex items-center gap-1.5 px-3 py-1.5 rounded-[1rem] border border-border hover:bg-bg-secondary text-[13px] font-medium text-ink-secondary hover:text-ink-primary transition-all flex-shrink-0"
            >
              <ArrowLeft size={15} className="flex-shrink-0" />
              <span className="hidden sm:inline">Voltar para artigo</span>
            </Link>

            {/* Thread title — appears when scrolled past article card */}
            <div className="flex-1 flex justify-center overflow-hidden px-2">
              <span
                className="text-[0.875rem] font-medium text-ink-primary truncate max-w-lg transition-all duration-200"
                style={{ opacity: showTitle ? 1 : 0, transform: showTitle ? 'translateY(0)' : 'translateY(4px)' }}
              >
                {thread.title}
              </span>
            </div>

            <div className="w-20 flex-shrink-0" /> {/* Spacer for symmetry */}
          </div>
        </div>

        {/* Article Reference Card */}
        <div ref={titleRef} className="px-4 md:px-8 pt-10 pb-6">
          <Link
            href={`/article/${article.id}`}
            className="mx-auto flex max-w-[45rem] gap-3 rounded-[1rem] border border-border p-5 transition-all group cursor-pointer hover:border-border-strong hover:bg-bg-secondary"
          >
            {article.image_url && (
              <img
                src={article.image_url}
                alt={article.title}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-ink-tertiary uppercase tracking-wider group-hover:text-ink-secondary transition-colors">
                  {article.topic}
                </span>
              </div>
              <h2 className="font-bold text-sm leading-tight text-ink-primary line-clamp-2 group-hover:text-accent transition-colors">
                {article.title}
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                {new Date(article.published_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </Link>
        </div>

        {/* Chat Content Area */}
        <main className="page-scroll">
          <div className="article-layout mx-auto px-0 py-6 pb-10">
            <ChatThread
              threadId={threadId}
              articleId={article.id}
              initialMessages={initialMessages}
              isEmbedded={false}
              autoRespond={true}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
