'use client'

import { useMemo, useState } from 'react'

function formatTopicLabel(topic: string): string {
  const normalized = topic.trim().replace(/[_-]+/g, ' ')
  if (!normalized) return ''

  const upperMap: Record<string, string> = {
    ai: 'AI',
    ux: 'UX',
    ui: 'UI',
    ml: 'ML',
    vr: 'VR',
    ar: 'AR',
    lol: 'LoL',
    nba: 'NBA',
    nfl: 'NFL',
    ufc: 'UFC',
    mma: 'MMA',
    rpg: 'RPG',
  }

  return normalized
    .split(/\s+/)
    .map((part) => upperMap[part.toLowerCase()] ?? (part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ')
}

export function InterestTopicsWidget({ topics }: { topics: string[] }) {
  const [expanded, setExpanded] = useState(false)

  const visibleTopics = useMemo(() => {
    const cleaned = topics
      .map((topic) => topic.trim())
      .filter(Boolean)

    return expanded ? cleaned : cleaned.slice(0, 8)
  }, [expanded, topics])

  if (topics.length === 0) return null

  return (
    <section className="rounded-2xl border border-border bg-bg-primary p-4">
      <div className="mb-3">
        <h3 className="text-[14px] font-semibold text-ink-primary">Tópicos de Interesse</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-tertiary">
          Seus temas favoritos para personalizar o feed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleTopics.map((topic) => (
          <span
            key={topic}
            className="inline-flex rounded-full border border-border bg-[#f6f4ef] px-3 py-1.5 text-[12px] font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink-primary"
          >
            {formatTopicLabel(topic)}
          </span>
        ))}
      </div>

      {topics.length > 8 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 text-[12px] font-medium text-ink-secondary transition-colors hover:text-ink-primary"
        >
          {expanded ? 'Ver menos' : 'Ver mais tópicos'}
        </button>
      )}
    </section>
  )
}
