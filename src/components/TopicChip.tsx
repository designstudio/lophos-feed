'use client'
import { X } from 'lucide-react'
import { getTopicColor } from '@/lib/topicColors'

interface Props {
  topic: string
  onRemove?: () => void
  size?: 'sm' | 'md'
}

export function TopicChip({ topic, onRemove, size = 'md' }: Props) {
  const color = getTopicColor(topic)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-medium transition-all"
      style={{
        background: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
        padding: size === 'sm' ? '2px 10px' : '4px 12px',
        fontSize: size === 'sm' ? '11px' : '13px',
      }}
    >
      {topic}
      {onRemove && (
        <button
          onClick={onRemove}
          className="opacity-60 hover:opacity-100 transition-opacity ml-0.5 flex items-center"
        >
          <X size={12} />
        </button>
      )}
    </span>
  )
}
