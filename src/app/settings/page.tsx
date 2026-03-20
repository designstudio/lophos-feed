'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Unread } from '@solar-icons/react-perf/Linear'
import { IconClose, IconPlus } from '@/components/icons'

export default function SettingsPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/topics')
      .then((r) => r.json())
      .then((data) => {
        const userTopics = (data.topics || []).map((t: any) => t.topic)
        setTopics(userTopics)
        setLoading(false)
        fetchSuggestions(userTopics)
      })
  }, [])

  const fetchSuggestions = async (currentTopics: string[]) => {
    setLoadingSuggestions(true)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: currentTopics }),
      })
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } catch {
      setSuggestions([])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const toggle = (topic: string) => {
    setSaved(false)
    setSuggestions((prev) => prev.filter((s) => s !== topic))
    setTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    )
  }

  const addCustom = () => {
    const t = custom.trim()
    if (!t || topics.includes(t)) return
    setTopics((prev) => [...prev, t])
    setCustom('')
    setSaved(false)
  }

  const remove = (topic: string) => {
    setTopics((prev) => prev.filter((t) => t !== topic))
    setSaved(false)
  }

  const handleSave = async () => {
    if (topics.length === 0) return
    setSaving(true)
    try {
      await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics }),
      })
      setSaved(true)
      setTimeout(() => router.push('/feed'), 800)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // Filter out suggestions already in topics
  const availableSuggestions = suggestions.filter((s) => !topics.includes(s))

  return (
    <div className="page-shell">
      <Sidebar />

      <main className="page-scroll">
        <div className="max-w-2xl mx-auto px-8 py-6">
          <h1 className="font-display text-2xl text-ink-primary mb-1">Configurações</h1>
          <p className="text-ink-secondary text-sm mb-8">Gerencie seus tópicos de interesse</p>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-bg-secondary rounded-xl" />)}
            </div>
          ) : (
            <>
              {/* Active topics */}
              <div className="mb-6">
                <h2 className="text-xs font-medium text-ink-tertiary uppercase tracking-wider mb-3">
                  Seus tópicos ({topics.length})
                </h2>
                {topics.length === 0 ? (
                  <p className="text-ink-muted text-sm">Nenhum tópico selecionado.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {topics.map((t) => (
                      <div key={t} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-primary text-white text-sm">
                        {t}
                        <button onClick={() => remove(t)} className="opacity-70 hover:opacity-100 transition-opacity">
                          <IconClose size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Smart suggestions */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-medium text-ink-tertiary uppercase tracking-wider">
                    Sugestões para você
                  </h2>
                  <button
                    onClick={() => fetchSuggestions(topics)}
                    disabled={loadingSuggestions}
                    className="text-[11px] text-ink-tertiary hover:text-accent transition-colors disabled:opacity-40"
                  >
                    {loadingSuggestions ? 'Atualizando…' : 'Atualizar'}
                  </button>
                </div>

                {loadingSuggestions ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="skeleton h-8 rounded-full" style={{ width: `${60 + (i % 4) * 20}px` }} />
                    ))}
                  </div>
                ) : availableSuggestions.length === 0 ? (
                  <p className="text-ink-muted text-sm">Nenhuma sugestão disponível.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableSuggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggle(s)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-sm text-ink-secondary hover:border-border-strong hover:text-ink-primary transition-all"
                      >
                        <IconPlus size={12} />
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom topic */}
              <div className="mb-8">
                <h2 className="text-xs font-medium text-ink-tertiary uppercase tracking-wider mb-3">
                  Adicionar personalizado
                </h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                    placeholder="Ex: Astronomia, K-pop, Web3…"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-border-strong transition-colors"
                  />
                  <button
                    onClick={addCustom}
                    className="px-4 py-2.5 rounded-xl border border-border text-sm text-ink-secondary hover:text-ink-primary hover:border-border-strong transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving || topics.length === 0}
                className="w-full py-3 rounded-xl bg-ink-primary text-white text-sm font-medium hover:bg-ink-secondary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saved ? (
                  <><Unread size={15} /> Salvo! Voltando ao feed…</>
                ) : saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
