'use client'
import { useState, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { Settings01 as Settings, X as CloseCircle, User03 as UserRounded, Sun, MoonStar, Monitor02 } from '@untitledui/icons'
import { cn } from '@/lib/utils'
import { useFeedContext } from '@/components/FeedContext'
import { AccentPicker } from './AccentPicker'
import { ACCENT_COLORS, WIDGET_OPTIONS, applyTheme, applyAccent } from './utils'

type Tab = 'geral' | 'widgets' | 'conta'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user } = useUser()
  const clerk = useClerk()
  const { triggerRefresh } = useFeedContext()
  const [tab, setTab] = useState<Tab>('geral')

  // Geral
  const [theme, setTheme] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('theme') || 'light' : 'light')
  const [accentColor, setAccentColor] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('accent_color') || '#ca774b' : '#ca774b')

  // Widgets
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return WIDGET_OPTIONS.map(w => w.id)
    try {
      const saved = JSON.parse(localStorage.getItem('lophos_widgets') || '[]') as string[]
      const ordered = saved.filter(id => id !== 'weather')
      const allIds = WIDGET_OPTIONS.map(w => w.id)
      const merged = [...ordered, ...allIds.filter(id => !ordered.includes(id))]
      return merged
    } catch { return WIDGET_OPTIONS.map(w => w.id) }
  })
  const [activeWidgets, setActiveWidgets] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['weather', ...WIDGET_OPTIONS.map(w => w.id)]
    try { return JSON.parse(localStorage.getItem('lophos_widgets') || JSON.stringify(['weather', ...WIDGET_OPTIONS.map(w => w.id)])) as string[] }
    catch { return ['weather'] }
  })
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Conta
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  // Topics
  const [topics, setTopics] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [savingTopics, setSavingTopics] = useState(false)
  const [topicsSaved, setTopicsSaved] = useState(false)

  // Excluded Topics
  const [excludedTopics, setExcludedTopics] = useState<string[]>([])
  const [excludedCustom, setExcludedCustom] = useState('')
  const [savingExcluded, setSavingExcluded] = useState(false)
  const [excludedSaved, setExcludedSaved] = useState(false)

  // Carrega tópicos excluídos
  useEffect(() => {
    fetch('/api/topics/excluded')
      .then(r => r.json())
      .then(data => setExcludedTopics(data.excludedTopics ?? []))
      .catch(() => {})
  }, [])

  // Carrega tópicos de interesse e sugestões
  useEffect(() => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(data => {
        const t = (data.topics || []).map((x: any) => x.topic)
        setTopics(t)
        return t
      })
      .then(t => {
        // Verifica cache localStorage — válido por 7 dias
        try {
          const cached = localStorage.getItem('lophos_suggestions')
          if (cached) {
            const { suggestions: s, fetchedAt } = JSON.parse(cached)
            const sevenDays = 7 * 24 * 60 * 60 * 1000
            if (Date.now() - fetchedAt < sevenDays && s?.length > 0) {
              setSuggestions(s)
              return
            }
          }
        } catch {}
        // Busca sugestões frescas
        fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topics: t }),
        })
          .then(r => r.json())
          .then(d => {
            const s = d.suggestions || []
            setSuggestions(s)
            try {
              localStorage.setItem('lophos_suggestions', JSON.stringify({ suggestions: s, fetchedAt: Date.now() }))
            } catch {}
          })
      })
      .catch(() => {})
  }, [])

  const handleTheme = (t: string) => { setTheme(t); applyTheme(t) }
  const handleAccent = (c: string) => { setAccentColor(c); applyAccent(c) }

  const saveWidgetState = (order: string[], active: string[]) => {
    const saved = ['weather', ...order.filter(id => active.includes(id))]
    localStorage.setItem('lophos_widgets', JSON.stringify(saved))
    window.dispatchEvent(new Event('lophos_widgets_updated'))
  }

  const toggleWidget = (id: string) => {
    const next = activeWidgets.includes(id)
      ? activeWidgets.filter(x => x !== id)
      : [...activeWidgets, id]
    setActiveWidgets(next)
    saveWidgetState(widgetOrder, next)
  }

  const onDragStart = (i: number) => setDragIdx(i)
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverIdx(i) }
  const onDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOverIdx(null); return }
    const next = [...widgetOrder]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(i, 0, moved)
    setWidgetOrder(next)
    saveWidgetState(next, activeWidgets)
    setDragIdx(null)
    setDragOverIdx(null)
  }

  const saveName = async () => {
    if (!firstName.trim()) return
    setSavingName(true)
    try { await user?.update({ firstName: firstName.trim(), lastName: lastName.trim() }) }
    catch (e) { console.error(e) }
    setSavingName(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  const saveTopics = async () => {
    if (topics.length === 0) return
    setSavingTopics(true)
    await fetch('/api/topics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topics }) })
    setSavingTopics(false)
    setTopicsSaved(true)
    setTimeout(() => setTopicsSaved(false), 2000)
    triggerRefresh()
    onClose()
  }

  const saveExcludedTopics = async () => {
    setSavingExcluded(true)
    await fetch('/api/topics/excluded', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ excludedTopics }) })
    setSavingExcluded(false)
    setExcludedSaved(true)
    setTimeout(() => setExcludedSaved(false), 2000)
  }

  const TABS = [
    { id: 'geral' as Tab,    label: 'Geral',    icon: <Settings size={15} /> },
    { id: 'widgets' as Tab,  label: 'Widgets',  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg> },
    { id: 'conta' as Tab,    label: 'Conta',    icon: <UserRounded size={15} /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ animation: 'fadeIn 0.15s ease' }}>
      <div className="absolute inset-0" onClick={onClose} style={{ backgroundColor: "#05050533", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
      <div className="settings-modal relative shadow-2xl flex flex-col overflow-hidden" style={{ animation: 'slideUp 0.15s ease', backgroundColor: 'var(--color-bg-primary)' }}>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 h-14 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold text-ink-primary" style={{ fontSize: '18px' }}>Configurações</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-secondary transition-colors">
            <CloseCircle size={20} />
          </button>
        </div>

        {/* Mobile: horizontal tab nav */}
        <div className="flex md:hidden border-b overflow-x-auto no-scrollbar" style={{ borderColor: 'var(--color-border)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all',
                tab === t.id ? 'border-accent text-ink-primary' : 'border-transparent text-ink-tertiary'
              )}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

        {/* Desktop: left nav */}
        <div className="hidden md:flex flex-col flex-shrink-0 pt-4 pb-4 pl-3" style={{ width: '12rem' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2.5 rounded-lg mx-1',
                tab === t.id
                  ? 'bg-bg-secondary font-medium text-ink-primary'
                  : 'text-ink-tertiary hover:text-ink-primary hover:bg-bg-secondary'
              )}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 md:px-7 pt-4 pb-5">

            {/* GERAL */}
            {tab === 'geral' && (
              <div>
                <section className="pb-5 border-b border-border">
                  <h3 className="text-sm font-semibold text-ink-primary mb-1">Aparência</h3>
                  <p className="text-sm text-ink-tertiary mb-4">Escolha como o Lophos aparece para você.</p>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { id: 'light',  label: 'Claro', icon: <Sun size={22} /> },
                      { id: 'dark',   label: 'Escuro', icon: <MoonStar size={22} /> },
                      { id: 'system', label: 'Sistema', icon: <Monitor02 size={22} /> },
                    ] as { id: string; label: string; icon: React.ReactNode }[]).map(t => (
                      <button key={t.id} onClick={() => handleTheme(t.id)}
                        className={cn(
                          'flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-sm font-medium transition-all',
                          theme === t.id ? 'text-ink-primary' : 'border-border text-ink-tertiary hover:text-ink-secondary'
                        )}
                        style={theme === t.id ? { borderColor: 'var(--color-ui-strong)', backgroundColor: 'var(--color-bg-secondary)' } : {}}>
                        {t.icon}
                        {t.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="py-5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-ink-primary">Cor de ênfase</h3>
                    <AccentPicker value={accentColor} onChange={handleAccent} />
                  </div>
                </section>

                <section className="py-5">
                  <h3 className="text-sm font-semibold text-ink-primary mb-1">Tópicos de interesse</h3>
                  <p className="text-sm text-ink-tertiary mb-3">Personalize o que aparece no seu feed.</p>
                  <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                    {topics.map(t => (
                      <span key={t} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] bg-bg-secondary text-ink-primary">
                        {t}
                        <button onClick={() => { setTopics(prev => prev.filter(x => x !== t)); setTopicsSaved(false) }}
                          className="opacity-50 hover:opacity-100 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={custom} onChange={e => setCustom(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && custom.trim() && !topics.includes(custom.trim())) { setTopics(p => [...p, custom.trim()]); setCustom(''); setTopicsSaved(false) } }}
                      placeholder="Adicionar tópico..."
                      className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink-primary outline-none transition-colors focus:border-border-strong" />
                    <button onClick={() => { if (custom.trim() && !topics.includes(custom.trim())) { setTopics(p => [...p, custom.trim()]); setCustom(''); setTopicsSaved(false) } }}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-ink-secondary transition-colors hover:border-border-strong hover:text-ink-primary">
                      Adicionar
                    </button>
                  </div>
                  <button onClick={saveTopics} disabled={savingTopics}
                    className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                    style={{ background: 'var(--color-ui-strong)' }}>
                    {topicsSaved ? '✓ Salvo!' : savingTopics ? 'Salvando…' : 'Salvar tópicos'}
                  </button>
                </section>

                <section className="py-5 border-t border-border">
                  <h3 className="text-sm font-semibold text-ink-primary mb-1">Tópicos excluídos</h3>
                  <p className="text-sm text-ink-tertiary mb-3">Artigos com esses termos não aparecerão no seu feed.</p>
                  <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                    {excludedTopics.map(t => (
                      <span key={t} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px]" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                        {t}
                        <button onClick={() => { setExcludedTopics(prev => prev.filter(x => x !== t)); setExcludedSaved(false) }}
                          className="opacity-60 hover:opacity-100 leading-none">×</button>
                      </span>
                    ))}
                    {excludedTopics.length === 0 && (
                      <p className="text-sm text-ink-tertiary italic">Nenhum tópico excluído</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input value={excludedCustom} onChange={e => setExcludedCustom(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && excludedCustom.trim() && !excludedTopics.includes(excludedCustom.trim())) { setExcludedTopics(p => [...p, excludedCustom.trim()]); setExcludedCustom(''); setExcludedSaved(false) } }}
                      placeholder="Ex: anime, k-pop..."
                      className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink-primary outline-none transition-colors focus:border-border-strong" />
                    <button onClick={() => { if (excludedCustom.trim() && !excludedTopics.includes(excludedCustom.trim())) { setExcludedTopics(p => [...p, excludedCustom.trim()]); setExcludedCustom(''); setExcludedSaved(false) } }}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-ink-secondary transition-colors hover:border-border-strong hover:text-ink-primary">
                      Adicionar
                    </button>
                  </div>
                  <button onClick={saveExcludedTopics} disabled={savingExcluded}
                    className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                    style={{ background: 'var(--color-ui-strong)' }}>
                    {excludedSaved ? '✓ Salvo!' : savingExcluded ? 'Salvando…' : 'Salvar exclusões'}
                  </button>
                </section>
              </div>
            )}

            {/* WIDGETS */}
            {tab === 'widgets' && (
              <div className="py-2">
                <p className="text-sm text-gray-500 mb-5">Ative e ordene os widgets da barra lateral. Arraste para reordenar.</p>

                <div className="flex items-center gap-3 py-3 px-3 rounded-xl border border-border mb-2 opacity-50 select-none">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 4h6M5 8h6M5 12h6" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <span className="text-sm text-gray-900 flex-1">Clima</span>
                  <span className="text-xs text-gray-400 px-2 py-0.5 rounded-full bg-gray-100">Sempre ativo</span>
                </div>

                {widgetOrder.map((id, i) => {
                  const w = WIDGET_OPTIONS.find(x => x.id === id)
                  if (!w) return null
                  return (
                    <div key={id} draggable
                      onDragStart={() => onDragStart(i)}
                      onDragOver={e => onDragOver(e, i)}
                      onDrop={() => onDrop(i)}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                      className={cn(
                        'flex items-center gap-3 py-3 px-3 rounded-xl border mb-2 cursor-grab active:cursor-grabbing transition-all select-none',
                        dragOverIdx === i && dragIdx !== i ? 'border-accent bg-accent/5 scale-[1.02]' : 'border-border hover:border-gray-200'
                      )}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
                        <path d="M5 4h6M5 8h6M5 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span className="text-sm text-gray-900 flex-1">{w.label}</span>
                      <button
                        onClick={() => toggleWidget(id)}
                        role="switch"
                        aria-checked={activeWidgets.includes(id)}
                        className="relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                        style={{ width: '42px', height: '24px', background: activeWidgets.includes(id) ? 'var(--color-accent)' : 'var(--color-bg-secondary)' }}
                      >
                        <span className={cn(
                          'pointer-events-none inline-block rounded-full bg-white shadow-md transform transition-transform duration-200',
                          activeWidgets.includes(id) ? 'translate-x-[18px]' : 'translate-x-0'
                        )}
                        style={{ width: '20px', height: '20px' }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* CONTA */}
            {tab === 'conta' && (
              <div>
                <div className="flex items-center gap-4 py-5 border-b border-border">
                  <div className="relative group cursor-pointer flex-shrink-0" onClick={() => clerk.openUserProfile()}>
                    {user?.imageUrl
                      ? <img src={user.imageUrl} alt="" width={52} height={52} className="rounded-full" />
                      : <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white font-semibold text-xl" style={{ background: 'var(--color-ui-strong)' }}>{user?.firstName?.[0] ?? '?'}</div>
                    }
                    <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-gray-900">{user?.fullName}</p>
                    <p className="text-sm text-gray-500">{user?.primaryEmailAddress?.emailAddress}</p>
                  </div>
                </div>

                <section className="py-5 border-b border-border">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Editar perfil</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1.5 block">Nome</label>
                      <input value={firstName} onChange={e => { setFirstName(e.target.value); setNameSaved(false) }}
                        className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-200 outline-none focus:border-gray-400 bg-white text-gray-900" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1.5 block">Sobrenome</label>
                      <input value={lastName} onChange={e => { setLastName(e.target.value); setNameSaved(false) }}
                        className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-200 outline-none focus:border-gray-400 bg-white text-gray-900" />
                    </div>
                  </div>
                  <button onClick={saveName} disabled={savingName}
                    className="px-5 py-2.5 rounded-full text-sm font-medium text-white transition-colors disabled:opacity-50"
                    style={{ background: 'var(--color-ui-strong)' }}>
                    {nameSaved ? '✓ Salvo!' : savingName ? 'Salvando…' : 'Salvar'}
                  </button>
                </section>

                <div className="flex items-center justify-between py-5 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Senha</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Altere sua senha de acesso.</p>
                  </div>
                  <button onClick={() => clerk.openUserProfile()}
                    className="flex-shrink-0 px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-700 hover:border-gray-400 transition-colors">
                    Alterar senha
                  </button>
                </div>

                <div className="flex items-center justify-between py-5">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Excluir conta</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Remove permanentemente sua conta e todos os seus dados.</p>
                  </div>
                  <button onClick={() => clerk.openUserProfile()}
                    className="flex-shrink-0 px-4 py-2 rounded-full border border-red-200 text-sm text-red-500 transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.10)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                    Excluir
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
