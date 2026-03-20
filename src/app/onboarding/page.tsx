'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const SUGGESTED_TOPICS = [
  { emoji: '🎮', label: 'Valorant' },
  { emoji: '⚔️', label: 'League of Legends' },
  { emoji: '♟️', label: 'TFT' },
  { emoji: '🤖', label: 'Inteligência Artificial' },
  { emoji: '📱', label: 'Tecnologia' },
  { emoji: '⚽', label: 'Futebol' },
  { emoji: '🏀', label: 'NBA' },
  { emoji: '🏎️', label: 'Formula 1' },
  { emoji: '🎬', label: 'Cinema' },
  { emoji: '🎵', label: 'Música' },
  { emoji: '📈', label: 'Economia' },
  { emoji: '🚀', label: 'Startups' },
  { emoji: '🌍', label: 'Política Internacional' },
  { emoji: '🇧🇷', label: 'Política Brasil' },
  { emoji: '🔬', label: 'Ciência' },
  { emoji: '🎭', label: 'American Horror Story' },
  { emoji: '🌿', label: 'Clima' },
  { emoji: '⚡', label: 'Energia' },
  { emoji: '🏥', label: 'Saúde' },
  { emoji: '🎯', label: 'Esports' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useUser()
  const [selected, setSelected] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggle = (topic: string) => {
    setSelected((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    )
  }

  const addCustom = () => {
    const t = custom.trim()
    if (!t || selected.includes(t)) return
    setSelected((prev) => [...prev, t])
    setCustom('')
  }

  const handleSave = async () => {
    if (selected.length < 1) {
      setError('Selecione pelo menos 1 tópico.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: selected }),
      })
      if (!res.ok) throw new Error('Erro ao salvar tópicos')
      router.push('/feed')
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl text-ink-primary mb-3">
            Faça dele o seu
          </h1>
          <p className="text-ink-secondary text-base">
            Selecione os tópicos e interesses para personalizar seu feed
          </p>
        </div>

        {/* Topic grid */}
        <div className="flex flex-wrap gap-2.5 mb-6 justify-center">
          {SUGGESTED_TOPICS.map(({ emoji, label }) => {
            const active = selected.includes(label)
            return (
              <button
                key={label}
                onClick={() => toggle(label)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium transition-all',
                  active
                    ? 'bg-ink-primary text-white border-ink-primary'
                    : 'bg-white text-ink-primary border-border hover:border-border-strong'
                )}
              >
                {active && <Check size={13} />}
                <span>{emoji}</span>
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {/* Custom topic input */}
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            placeholder="Adicionar tópico personalizado…"
            className="flex-1 px-4 py-2.5 rounded-full border border-border bg-white text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-border-strong transition-colors"
          />
          <button
            onClick={addCustom}
            className="px-5 py-2.5 rounded-full bg-bg-secondary border border-border text-sm font-medium text-ink-secondary hover:text-ink-primary transition-colors"
          >
            Adicionar
          </button>
        </div>

        {/* Custom selected chips */}
        {selected.filter((t) => !SUGGESTED_TOPICS.map((s) => s.label).includes(t)).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 mb-4">
            {selected
              .filter((t) => !SUGGESTED_TOPICS.map((s) => s.label).includes(t))
              .map((t) => (
                <button
                  key={t}
                  onClick={() => toggle(t)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-primary text-white text-sm"
                >
                  <Check size={12} />
                  {t}
                </button>
              ))}
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        {/* Save button */}
        <div className="mt-8">
          <button
            onClick={handleSave}
            disabled={loading || selected.length === 0}
            className="w-full py-3.5 rounded-full bg-ink-primary text-white text-sm font-medium hover:bg-ink-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvando…' : `Salvar interesses${selected.length > 0 ? ` (${selected.length})` : ''}`}
          </button>
        </div>

        <p className="text-center text-ink-muted text-xs mt-4">
          Você pode alterar seus tópicos a qualquer momento em Configurações
        </p>
      </div>
    </div>
  )
}
