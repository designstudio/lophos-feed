'use client'
import { ExternalLink } from 'lucide-react'
import { NewsItem } from '@/lib/types'
import { TopicChip } from './TopicChip'

interface Props {
  item: NewsItem
  style?: React.CSSProperties
}

export function NewsCard({ item, style }: Props) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl border border-border-subtle bg-surface-1 p-5 card-hover animate-fade-up"
      style={style}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2.5">
            <TopicChip topic={item.topic} size="sm" />
            {item.source && (
              <span className="text-xs text-text-tertiary truncate">{item.source}</span>
            )}
          </div>
          <h3 className="text-text-primary font-display text-[17px] leading-snug mb-2 group-hover:text-white transition-colors">
            {item.title}
          </h3>
          <p className="text-text-secondary text-[14px] leading-relaxed line-clamp-3">
            {item.summary}
          </p>
        </div>
        <ExternalLink
          size={15}
          className="text-text-tertiary group-hover:text-text-secondary transition-colors flex-shrink-0 mt-1"
        />
      </div>
    </a>
  )
}
