'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, useClerk } from '@clerk/nextjs'
import {
  NotebookMinimalistic, Refresh, AltArrowLeft, AltArrowRight,
  Settings, Logout, CloseCircle, UserRounded
} from '@solar-icons/react-perf/Linear'
import { cn } from '@/lib/utils'
import { useFeedContext } from '@/components/FeedContext'

// ─── Logo ─────────────────────────────────────────────────────
function LophosLogo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <g clipPath="url(#a)">
        <mask id="b" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <path d="M512 0H0v512h512V0Z" fill="white"/>
        </mask>
        <g mask="url(#b)">
          <path d="M0 256C0 166.392 0 121.587 17.439 87.3615C32.7787 57.2556 57.2556 32.7787 87.3615 17.439C121.587 0 166.392 0 256 0C345.608 0 390.413 0 424.638 17.439C454.744 32.7787 479.221 57.2556 494.561 87.3615C512 121.587 512 166.392 512 256C512 345.608 512 390.413 494.561 424.638C479.221 454.744 454.744 479.221 424.638 494.561C390.413 512 345.608 512 256 512C166.392 512 121.587 512 87.3615 494.561C57.2556 479.221 32.7787 454.744 17.439 424.638C0 390.413 0 345.608 0 256Z" style={{ fill: "var(--color-accent)" }}/>
        </g>
        <g clipPath="url(#c)">
          <mask id="d" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="10" width="512" height="512">
            <path d="M0 266C0 176.392 0 131.587 17.439 97.3615C32.7787 67.2556 57.2556 42.7787 87.3615 27.439C121.587 10 166.392 10 256 10C345.608 10 390.413 10 424.638 27.439C454.744 42.7787 479.221 67.2556 494.561 97.3615C512 131.587 512 176.392 512 266C512 355.608 512 400.413 494.561 434.638C479.221 464.744 454.744 489.221 424.638 504.561C390.413 522 345.608 522 256 522C166.392 522 121.587 522 87.3615 504.561C57.2556 489.221 32.7787 464.744 17.439 434.638C0 400.413 0 355.608 0 266Z" style={{ fill: "var(--color-accent)" }}/>
          </mask>
          <g mask="url(#d)">
            <path d="M441.903 238.478V249.892L440.764 253.261L401.429 252.641C384.532 252.377 359.311 262.981 338.681 259.909C324.758 257.836 311.792 254.211 298.215 250.866C270.698 242.864 246.459 248.875 220.231 257.861C229.266 259.595 237.524 259.265 246.229 258.134C262.134 256.06 277.413 256.507 293.07 260.24L324.345 267.705C346.808 273.065 369.427 272.272 391.642 265.946C404.972 262.147 418.3 261.074 431.679 265.525C425.609 284.511 414.377 294.735 394.772 297.039C382.872 298.435 371.41 298.666 359.286 298.905C331.678 299.459 305.474 303.778 279.262 311.904C267.312 315.612 255.329 317.057 242.916 316.867C213.228 316.413 191.682 301.217 173.968 279.184C172.497 289.829 180.607 298.608 187.008 305.974C202.756 327.471 226.937 331.674 252.935 331.319C238.061 339.908 225.913 350.892 216.936 365.352C201.071 390.912 199.734 407.561 196.051 436.861L191.888 469.962C189.213 491.243 182.334 510.956 173.488 530H-28V425.944C8.99764 431.924 44.9713 416.373 60.241 380.49C66.179 366.533 69.8046 352.296 72.4466 337.224L81.0687 288.104C83.9505 271.694 88.0058 256.35 94.0346 240.881C109.09 202.843 134.525 178.613 171.349 161.048C164.288 150.807 157.946 141.153 153.908 129.666C159.457 129.179 164.925 129.98 170.086 132.019L189.114 139.559C194.225 141.583 199.436 142.698 205.3 143.078L199.379 120.152C197.347 112.282 197.603 104.04 199.717 96.3762C205.126 76.746 226.581 70.4531 244.659 73.1536C260.78 75.5568 275.703 80.0577 290.551 86.8212C331.687 105.873 365.876 138.114 385.828 179.298C385.539 134.687 336.715 92.0488 298.487 76.8616C311.949 66.5138 332.305 67.0507 347.261 74.5741C388.108 96.0376 412.081 140.815 404.98 186.855C426.088 197.021 438.732 216.189 441.903 238.478ZM274.356 194.866C267.923 187.962 262.415 182.891 255.833 177.622C249.078 174.088 241.282 173.749 234.337 176.986C230.447 179.233 228.176 182.808 228.109 186.93C228.043 191.05 229.836 194.428 233.007 197.195C239.498 201.902 247.698 203.075 255.371 200.713L274.356 194.866ZM411.049 224.44C412.511 215.975 407.928 210.4 401.924 206.667C397.365 203.562 391.518 203.629 388.215 208.971C390.965 211.861 394.128 214.794 397.613 216.775L411.049 224.431V224.44Z" fill="white"/>
          </g>
        </g>
      </g>
      <defs>
        <clipPath id="a"><rect width="512" height="512" fill="white"/></clipPath>
        <clipPath id="c"><rect width="512" height="512" fill="white"/></clipPath>
      </defs>
    </svg>
  )
}

// ─── Theme / Accent utilities ──────────────────────────────────
function applyTheme(t: string) {
  localStorage.setItem('theme', t)
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

function applyAccent(color: string) {
  localStorage.setItem('accent_color', color)
  document.documentElement.style.setProperty('--color-accent', color)
}

if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('accent_color')
  if (saved) document.documentElement.style.setProperty('--color-accent', saved)
  applyTheme(localStorage.getItem('theme') || 'light')
}

const ACCENT_COLORS = [
  { label: 'Padrão',  value: '#ca774b', dot: '#ca774b' },
  { label: 'Azul',    value: '#2563eb', dot: '#3b82f6' },
  { label: 'Verde',   value: '#16a34a', dot: '#22c55e' },
  { label: 'Amarelo', value: '#ca8a04', dot: '#eab308' },
  { label: 'Rosa',    value: '#db2777', dot: '#ec4899' },
  { label: 'Laranja', value: '#ea580c', dot: '#f97316' },
]

const WIDGET_OPTIONS = [
  { id: 'valorant', label: 'Partidas — Valorant' },
  { id: 'lol',      label: 'Partidas — League of Legends' },
  { id: 'series',   label: 'Próximos episódios' },
]

// ─── Custom Accent Picker ──────────────────────────────────────
function AccentPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = ACCENT_COLORS.find(c => c.value === value) ?? ACCENT_COLORS[0]

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors text-sm text-gray-700 bg-white">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: current.dot }} />
        {current.label}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={cn('transition-transform', open ? 'rotate-180' : '')}>
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-gray-100 shadow-lg z-50 py-1.5"
          style={{ animation: 'slideUp 0.12s ease' }}>
          {ACCENT_COLORS.map(c => (
            <button key={c.label} onClick={() => { onChange(c.value); setOpen(false) }}
              className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 transition-colors text-sm text-gray-700">
              <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
              <span className="flex-1 text-left">{c.label}</span>
              {value === c.value && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="#111" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Settings Modal ────────────────────────────────────────────
type Tab = 'geral' | 'widgets' | 'conta'

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user } = useUser()
  const clerk = useClerk()
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
      // Always include all WIDGET_OPTIONS — merge saved order with any missing ones
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

  useEffect(() => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(data => {
        const t = (data.topics || []).map((x: any) => x.topic)
        setTopics(t)
        return t
      })
      .then(t => {
        // Check localStorage cache — valid for 7 days
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
        // Fetch fresh suggestions
        fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topics: t }),
        }).then(r => r.json()).then(d => {
          const s = d.suggestions || []
          setSuggestions(s)
          try {
            localStorage.setItem('lophos_suggestions', JSON.stringify({ suggestions: s, fetchedAt: Date.now() }))
          } catch {}
        })
      })
  }, [])

  const handleTheme = (t: string) => { setTheme(t); applyTheme(t) }
  const handleAccent = (c: string) => { setAccentColor(c); applyAccent(c) }

  const saveWidgetState = (order: string[], active: string[]) => {
    // Save as ordered list: weather first, then active widgets in user-defined order
    const saved = ['weather', ...order.filter(id => active.includes(id))]
    localStorage.setItem('lophos_widgets', JSON.stringify(saved))
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
  }

  const TABS = [
    { id: 'geral' as Tab,    label: 'Geral',    icon: <Settings size={15} /> },
    { id: 'widgets' as Tab,  label: 'Widgets',  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg> },
    { id: 'conta' as Tab,    label: 'Conta',    icon: <UserRounded size={15} /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.15s ease' }}>
      <div className="absolute inset-0" onClick={onClose} style={{ backgroundColor: "#05050533", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
      <div className="relative bg-white rounded-2xl shadow-2xl flex overflow-hidden" style={{ width: '48rem', height: '32rem', animation: 'slideUp 0.15s ease' }}>

        {/* Full-width header */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white z-10 rounded-t-2xl">
          <h2 className="text-[15px] font-semibold text-gray-900">Configurações</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <CloseCircle size={20} />
          </button>
        </div>

        {/* Body below header */}
        <div className="flex flex-1 overflow-hidden mt-14">

        {/* Left nav */}
        <div className="flex-shrink-0 border-r border-gray-100 pt-4 pb-4" style={{ width: '12rem' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2.5 rounded-lg mx-1',
                tab === t.id ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              )}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-7 py-5">

            {/* ── GERAL ── */}
            {tab === 'geral' && (
              <>
                <section className="py-5 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Aparência</h3>
                  <p className="text-sm text-gray-500 mb-4">Escolha como o Lophos aparece para você.</p>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { id: 'light',  label: 'Claro',   icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
                      { id: 'dark',   label: 'Escuro',  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="19" cy="3" r="1" fill="currentColor"/><circle cx="22" cy="6" r="0.8" fill="currentColor"/><circle cx="17" cy="5.5" r="0.8" fill="currentColor"/></svg> },
                      { id: 'system', label: 'Sistema', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
                    ] as { id: string; label: string; icon: React.ReactNode }[]).map(t => (
                      <button key={t.id} onClick={() => handleTheme(t.id)}
                        className={cn(
                          'flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-sm font-medium transition-all',
                          theme === t.id ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        )}>
                        {t.icon}{t.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="py-5 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Cor de ênfase</h3>
                    <AccentPicker value={accentColor} onChange={handleAccent} />
                  </div>
                </section>

                <section className="py-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Tópicos de interesse</h3>
                  <p className="text-sm text-gray-500 mb-3">Personalize o que aparece no seu feed.</p>
                  <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                    {topics.map(t => (
                      <span key={t} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-900 text-white text-[13px]">
                        {t}
                        <button onClick={() => { setTopics(prev => prev.filter(x => x !== t)); setTopicsSaved(false) }}
                          className="opacity-60 hover:opacity-100 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                  {suggestions.length === 0 && topics.length > 0 && (
                    <div className="flex items-center gap-2 mb-3 text-[12px] text-gray-400">
                      <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/></svg>
                      Gerando sugestões personalizadas…
                    </div>
                  )}
                  {suggestions.filter(s => !topics.includes(s)).length > 0 && (
                    <div className="mb-1.5">
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-2">Sugestões para você</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {suggestions.filter(s => !topics.includes(s)).slice(0, 10).map(s => (
                          <button key={s} onClick={() => { setTopics(p => [...p, s]); setSuggestions(p => p.filter(x => x !== s)); setTopicsSaved(false) }}
                            className="px-3 py-1 rounded-full border border-gray-200 text-[13px] text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                            + {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input value={custom} onChange={e => setCustom(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && custom.trim() && !topics.includes(custom.trim())) { setTopics(p => [...p, custom.trim()]); setCustom(''); setTopicsSaved(false) } }}
                      placeholder="Adicionar tópico..."
                      className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-400 bg-white text-gray-900" />
                    <button onClick={() => { if (custom.trim() && !topics.includes(custom.trim())) { setTopics(p => [...p, custom.trim()]); setCustom(''); setTopicsSaved(false) } }}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-gray-400 transition-colors">
                      Adicionar
                    </button>
                  </div>
                  <button onClick={saveTopics} disabled={savingTopics}
                    className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                    style={{ background: '#111' }}>
                    {topicsSaved ? '✓ Salvo!' : savingTopics ? 'Salvando…' : 'Salvar tópicos'}
                  </button>
                </section>
              </>
            )}

            {/* ── WIDGETS ── */}
            {tab === 'widgets' && (
              <div className="py-2">
                <p className="text-sm text-gray-500 mb-5">Ative e ordene os widgets da barra lateral. Arraste para reordenar.</p>

                {/* Clima — always on */}
                <div className="flex items-center gap-3 py-3 px-3 rounded-xl border border-gray-100 mb-2 opacity-50 select-none">
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
                        dragOverIdx === i && dragIdx !== i ? 'border-accent bg-accent/5 scale-[1.02]' : 'border-gray-100 hover:border-gray-200'
                      )}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
                        <path d="M5 4h6M5 8h6M5 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span className="text-sm text-gray-900 flex-1">{w.label}</span>
                      <button
                        onClick={() => toggleWidget(id)}
                        role="switch"
                        aria-checked={activeWidgets.includes(id)}
                        className={cn(
                          'relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                          activeWidgets.includes(id) ? 'bg-gray-900' : 'bg-gray-200'
                        )}
                        style={{ width: '42px', height: '24px' }}
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

            {/* ── CONTA ── */}
            {tab === 'conta' && (
              <>
                <div className="flex items-center gap-4 py-5 border-b border-gray-100">
                  <div className="relative group cursor-pointer flex-shrink-0" onClick={() => clerk.openUserProfile()}>
                    {user?.imageUrl
                      ? <img src={user.imageUrl} alt="" width={52} height={52} className="rounded-full" />
                      : <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white font-semibold text-xl" style={{ background: '#111' }}>{user?.firstName?.[0] ?? '?'}</div>
                    }
                    <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-gray-900">{user?.fullName}</p>
                    <p className="text-sm text-gray-500">{user?.primaryEmailAddress?.emailAddress}</p>
                    {user?.createdAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Conta criada em {new Date(user.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>

                <section className="py-5 border-b border-gray-100">
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
                    style={{ background: '#111' }}>
                    {nameSaved ? '✓ Salvo!' : savingName ? 'Salvando…' : 'Salvar'}
                  </button>
                </section>

                <div className="flex items-center justify-between py-5 border-b border-gray-100">
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
                    className="flex-shrink-0 px-4 py-2 rounded-full border border-red-200 text-sm text-red-500 hover:bg-red-50 transition-colors">
                    Excluir
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
        </div>{/* end body */}
      </div>
    </div>
  )
}

// ─── User Menu ─────────────────────────────────────────────────
function UserMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg w-full hover:bg-bg-secondary transition-colors text-left">
        {user?.imageUrl
          ? <img src={user.imageUrl} alt="" width={26} height={26} className="rounded-full flex-shrink-0" />
          : <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0" style={{ background: 'var(--color-accent)' }}>{user?.firstName?.[0] ?? '?'}</div>
        }
        <span className="text-sm text-ink-secondary truncate flex-1">{user?.firstName ?? 'Minha conta'}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-56 rounded-xl shadow-xl z-50 py-1"
          style={{ animation: 'slideUp 0.12s ease', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <div className="py-1">
            <button onClick={() => { setOpen(false); onOpenSettings() }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors" style={{ color: 'var(--color-ink-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
              <Settings size={14} /> Configurações
            </button>
            <button onClick={() => signOut()}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 transition-colors"
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.10)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
              <Logout size={14} /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Collapsed User Menu ───────────────────────────────────────
// ─── Fixed Dropdown — escapes overflow:hidden parents ─────────
function FixedDropdown({ anchorRef, onClose, children }: {
  anchorRef: React.RefObject<HTMLElement>
  onClose: () => void
  children: React.ReactNode
}) {
  const [pos, setPos] = useState({ left: 0, bottom: 0 })

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setPos({ left: r.left, bottom: window.innerHeight - r.top + 4 })
    }
  }, [])

  return (
    <div
      className="fixed w-52 rounded-xl shadow-xl z-[999] py-1"
      style={{ left: pos.left, bottom: pos.bottom, animation: 'slideUp 0.12s ease', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
    >
      {children}
    </div>
  )
}

function CollapsedUserMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative mt-auto">
      <button onClick={() => setOpen(v => !v)}
        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-bg-secondary transition-colors" title={user?.firstName ?? 'Conta'}>
        {user?.imageUrl
          ? <img src={user.imageUrl} alt="" width={26} height={26} className="rounded-full" />
          : <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: 'var(--color-accent)' }}>{user?.firstName?.[0] ?? '?'}</div>
        }
      </button>
      {open && (
        <FixedDropdown anchorRef={ref} onClose={() => setOpen(false)}>
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <div className="py-1">
            <button onClick={() => { setOpen(false); onOpenSettings() }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors" style={{ color: 'var(--color-ink-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
              <Settings size={14} /> Configurações
            </button>
            <button onClick={() => signOut()} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 transition-colors"
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.10)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
              <Logout size={14} /> Sair
            </button>
          </div>
        </FixedDropdown>
      )}
    </div>
  )
}

// ─── Sidebar ───────────────────────────────────────────────────
interface Props { onRefresh?: () => void; refreshing?: boolean }

export function Sidebar({ onRefresh, refreshing }: Props) {
  const path = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed') === 'true'
    setCollapsed(saved)
    setMounted(true)
  }, [])

  useEffect(() => { if (path === '/settings') setShowSettings(true) }, [path])

  const toggle = () => {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  return (
    <>
      <aside
        className="flex-shrink-0 flex flex-col h-full border-r border-border bg-bg-primary"
        style={{
          width: collapsed ? '3.5rem' : '16.1rem',
          transition: mounted ? 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          willChange: 'width',
        }}
      >
        {/* Header */}
        <div className="flex items-center px-3 pt-5 mb-6 flex-shrink-0" style={{ minHeight: '2.5rem' }}>
          {/* Logo — when collapsed, hover hides logo and shows expand button */}
          <div
            className={cn('flex-shrink-0 relative', collapsed ? 'group cursor-pointer' : '')}
            style={{ width: 28, height: 28 }}
            onClick={collapsed ? toggle : undefined}
          >
            {/* Logo — hidden on hover when collapsed */}
            <div className={collapsed ? 'group-hover:opacity-0 transition-opacity' : ''}>
              <LophosLogo size={34} />
            </div>
            {/* Expand arrow — shown on hover when collapsed */}
            {collapsed && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <AltArrowRight size={16} className="text-ink-secondary" />
              </div>
            )}
          </div>

          {/* Name — fades out when collapsed */}
          <span
            className="font-display text-lg text-ink-primary flex-1 whitespace-nowrap overflow-hidden ml-2.5"
            style={{
              opacity: collapsed ? 0 : 1,
              width: collapsed ? 0 : 'auto',
              transition: 'opacity 0.15s ease',
              pointerEvents: 'none',
            }}
          >
            Lophos
          </span>

          {/* Collapse button — only visible when expanded */}
          {!collapsed && (
            <button
              onClick={toggle}
              className="w-6 h-6 flex items-center justify-center rounded-md text-ink-muted hover:text-ink-primary hover:bg-bg-secondary transition-colors flex-shrink-0 ml-auto"
            >
              <AltArrowLeft size={14} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1 px-2">
          <Link href="/feed"
            title={collapsed ? 'Meu Feed' : undefined}
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
              collapsed ? 'justify-center' : '',
              path === '/feed' ? 'bg-bg-secondary text-ink-primary font-medium' : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
            )}>
            <NotebookMinimalistic size={18} className="flex-shrink-0" />
            {!collapsed && <span className="whitespace-nowrap overflow-hidden">Meu Feed</span>}
          </Link>

          {onRefresh && (
            <button onClick={onRefresh} disabled={refreshing}
              title={collapsed ? 'Atualizar feed' : undefined}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary transition-colors disabled:opacity-50 text-left',
                collapsed ? 'justify-center' : ''
              )}>
              <Refresh size={18} className={cn('flex-shrink-0', refreshing ? 'animate-spin' : '')} />
              {!collapsed && <span className="whitespace-nowrap overflow-hidden">{refreshing ? 'Atualizando…' : 'Atualizar feed'}</span>}
            </button>
          )}
        </nav>

        {/* Bottom user */}
        <div className="border-t border-border pt-3 px-2 pb-5 flex-shrink-0">
          {collapsed
            ? <CollapsedUserMenu onOpenSettings={() => setShowSettings(true)} />
            : <UserMenu onOpenSettings={() => setShowSettings(true)} />
          }
        </div>
      </aside>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}

// ─── Context-aware wrapper for use in shared layout ───────────
export function SidebarWithRefresh() {
  const { refreshing, triggerRefresh } = useFeedContext()
  return <Sidebar onRefresh={triggerRefresh} refreshing={refreshing} />
}
