'use client'
import { useState, KeyboardEvent } from 'react'
import { Plus, RefreshCw, Newspaper } from 'lucide-react'
import { TopicChip } from './TopicChip'

interface Props {
  topics: string[]
  onTopicsChange: (topics: string[]) => void
  onRefresh: () => void
  loading: boolean
}

const SUGGESTIONS = [
  'Inteligência Artificial', 'Tecnologia', 'Política Brasil',
  'Futebol', 'NBA', 'Formula 1', 'Cinema', 'Música',
  'Economia', 'Startups', 'Clima', 'Ciência',
]

export function Sidebar({ topics, onTopicsChange, onRefresh, loading }: Props) {
  const [input, setInput] = useState('')

  const addTopic = (topic: string) => {
    const t = topic.trim()
    if (!t || topics.includes(t)) return
    onTopicsChange([...topics, t])
    setInput('')
  }

  const removeTopic = (topic: string) => {
    onTopicsChange(topics.filter((t) => t !== topic))
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') addTopic(input)
  }

  const suggestions = SUGGESTIONS.filter((s) => !topics.includes(s))

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col gap-6 sticky top-6 self-start">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <Newspaper size={16} className="text-white" />
        </div>
        <span className="font-display text-xl text-text-primary">MyFeed</span>
      </div>

      {/* Add topic */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-widest">
          Seus tópicos
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Adicionar tópico…"
            className="flex-1 bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50 transition-colors"
          />
          <button
            onClick={() => addTopic(input)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-accent hover:bg-accent-dim transition-colors"
          >
            <Plus size={16} className="text-white" />
          </button>
        </div>

        {/* Active topics */}
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {topics.map((t) => (
              <TopicChip key={t} topic={t} onRemove={() => removeTopic(t)} />
            ))}
          </div>
        )}
      </div>

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        disabled={loading || topics.length === 0}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-surface-3 border border-border-subtle text-sm text-text-secondary hover:text-text-primary hover:border-border-DEFAULT transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Buscando…' : 'Atualizar feed'}
      </button>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-widest">
            Sugestões
          </label>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 8).map((s) => (
              <button
                key={s}
                onClick={() => addTopic(s)}
                className="text-xs px-3 py-1 rounded-full border border-border-subtle text-text-tertiary hover:text-text-secondary hover:border-border-DEFAULT transition-all"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
