'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, useClerk } from '@clerk/nextjs'
import {
  NotebookMinimalistic, Refresh, AltArrowLeft, AltArrowRight,
  Settings, Logout, CloseCircle, Sun, Moon
} from '@solar-icons/react-perf/Linear'
import { cn } from '@/lib/utils'

// ─── Logo ────────────────────────────────────────────────────
function LophosLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <g clipPath="url(#a)">
        <mask id="b" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <path d="M512 0H0v512h512V0Z" fill="white"/>
        </mask>
        <g mask="url(#b)">
          <path d="M0 256C0 166.392 0 121.587 17.439 87.3615C32.7787 57.2556 57.2556 32.7787 87.3615 17.439C121.587 0 166.392 0 256 0C345.608 0 390.413 0 424.638 17.439C454.744 32.7787 479.221 57.2556 494.561 87.3615C512 121.587 512 166.392 512 256C512 345.608 512 390.413 494.561 424.638C479.221 454.744 454.744 479.221 424.638 494.561C390.413 512 345.608 512 256 512C166.392 512 121.587 512 87.3615 494.561C57.2556 479.221 32.7787 454.744 17.439 424.638C0 390.413 0 345.608 0 256Z" fill="#050505"/>
        </g>
        <g clipPath="url(#c)">
          <mask id="d" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="10" width="512" height="512">
            <path d="M0 266C0 176.392 0 131.587 17.439 97.3615C32.7787 67.2556 57.2556 42.7787 87.3615 27.439C121.587 10 166.392 10 256 10C345.608 10 390.413 10 424.638 27.439C454.744 42.7787 479.221 67.2556 494.561 97.3615C512 131.587 512 176.392 512 266C512 355.608 512 400.413 494.561 434.638C479.221 464.744 454.744 489.221 424.638 504.561C390.413 522 345.608 522 256 522C166.392 522 121.587 522 87.3615 504.561C57.2556 489.221 32.7787 464.744 17.439 434.638C0 400.413 0 355.608 0 266Z" fill="#050505"/>
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

// ─── Accent colors ───────────────────────────────────────────
const ACCENT_COLORS = [
  { label: 'Padrão',   value: '#1b6ef3', dot: '#94a3b8' },
  { label: 'Azul',     value: '#1b6ef3', dot: '#3b82f6' },
  { label: 'Verde',    value: '#16a34a', dot: '#22c55e' },
  { label: 'Amarelo',  value: '#ca8a04', dot: '#eab308' },
  { label: 'Rosa',     value: '#db2777', dot: '#ec4899' },
  { label: 'Laranja',  value: '#ea580c', dot: '#f97316' },
]

function applyAccentColor(color: string) {
  document.documentElement.style.setProperty('--color-accent', color)
  localStorage.setItem('accent_color', color)
}

function applyTheme(t: string) {
  localStorage.setItem('theme', t)
  const resolved = t === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : t
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// Apply saved preferences on mount
if (typeof window !== 'undefined') {
  const savedAccent = localStorage.getItem('accent_color')
  if (savedAccent) document.documentElement.style.setProperty('--color-accent', savedAccent)
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) applyTheme(savedTheme)
}

// ─── Settings Modal ──────────────────────────────────────────
type SettingsTab = 'conta' | 'temas' | 'aparencia'

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user } = useUser()
  const clerk = useClerk()
  const [tab, setTab] = useState<SettingsTab>('conta')

  // Topics state
  const [topics, setTopics] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [savingTopics, setSavingTopics] = useState(false)
  const [topicsSaved, setTopicsSaved] = useState(false)

  // Appearance state
  const [accentColor, setAccentColor] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem('accent_color') || '#1b6ef3' : '#1b6ef3')
  )
  const [theme, setTheme] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem('theme') || 'light' : 'light')
  )

  // Load topics
  useEffect(() => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(data => {
        const t = (data.topics || []).map((x: any) => x.topic)
        setTopics(t)
        return t
      })
      .then(t => fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: t }),
      }).then(r => r.json()).then(d => setSuggestions(d.suggestions || [])))
  }, [])

  const removeTopic = (t: string) => {
    setTopics(prev => prev.filter(x => x !== t))
    setTopicsSaved(false)
  }
  const addSuggestion = (s: string) => {
    setTopics(prev => [...prev, s])
    setSuggestions(prev => prev.filter(x => x !== s))
    setTopicsSaved(false)
  }
  const addCustom = () => {
    const t = custom.trim()
    if (!t || topics.includes(t)) return
    setTopics(prev => [...prev, t])
    setCustom('')
    setTopicsSaved(false)
  }
  const saveTopics = async () => {
    if (topics.length === 0) return
    setSavingTopics(true)
    await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topics }),
    })
    setSavingTopics(false)
    setTopicsSaved(true)
  }

  const handleAccent = (color: string) => {
    setAccentColor(color)
    applyAccentColor(color)
  }
  const handleTheme = (t: string) => {
    setTheme(t)
    applyTheme(t)
  }

  const TABS: { id: SettingsTab; label: string }[] = [
    { id: 'conta', label: 'Conta' },
    { id: 'temas', label: 'Temas' },
    { id: 'aparencia', label: 'Aparência' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.2s ease' }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl flex overflow-hidden"
        style={{ width: '680px', height: '520px', animation: 'slideUp 0.2s ease' }}>

        {/* Left nav — matches Grok layout */}
        <div className="flex-shrink-0 border-r border-gray-100 flex flex-col" style={{ width: '180px' }}>
          <div className="px-4 pt-5 pb-3">
            <h2 className="text-[15px] font-semibold text-ink-primary">Configurações</h2>
          </div>
          <nav className="flex flex-col gap-0.5 px-2 flex-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('text-left px-3 py-2 rounded-lg text-sm transition-colors',
                  tab === t.id
                    ? 'bg-gray-100 text-ink-primary font-medium'
                    : 'text-ink-secondary hover:bg-gray-50 hover:text-ink-primary'
                )}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <span className="text-[13px] font-semibold text-ink-tertiary uppercase tracking-wider">
              {TABS.find(t => t.id === tab)?.label}
            </span>
            <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors">
              <CloseCircle size={20} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ── CONTA ── */}
            {tab === 'conta' && (
              <div className="space-y-0">

                {/* User row — like Grok */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <button onClick={() => clerk.openUserProfile()}
                      className="relative group flex-shrink-0">
                      {user?.imageUrl
                        ? <img src={user.imageUrl} alt="" width={40} height={40} className="rounded-full" />
                        : <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                            style={{ background: 'var(--color-accent)' }}>
                            {user?.firstName?.[0] ?? '?'}
                          </div>
                      }
                      <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <div>
                      <p className="text-sm font-medium text-ink-primary">{user?.fullName ?? '—'}</p>
                      <p className="text-xs text-ink-tertiary">{user?.primaryEmailAddress?.emailAddress ?? '—'}</p>
                    </div>
                  </div>
                  <button onClick={() => clerk.openUserProfile()}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-ink-secondary hover:border-gray-300 hover:text-ink-primary transition-colors">
                    Gerenciar
                  </button>
                </div>

                <SettingsRow label="Nome">
                  <button onClick={() => clerk.openUserProfile()}
                    className="text-xs text-accent hover:underline">
                    {user?.fullName ?? 'Editar'}
                  </button>
                </SettingsRow>

                <SettingsRow label="Senha">
                  <button onClick={() => clerk.openUserProfile()}
                    className="text-xs text-accent hover:underline">
                    {user?.passwordEnabled ? 'Alterar' : 'Definir senha'}
                  </button>
                </SettingsRow>

                <SettingsRow label="Idioma">
                  <select className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-ink-primary outline-none focus:border-accent">
                    <option>Português (Brasil)</option>
                    <option>English</option>
                  </select>
                </SettingsRow>

                <SettingsRow label="Ano de nascimento">
                  <input type="number" placeholder="Ex: 1990" min={1900} max={2010}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-24 outline-none focus:border-accent bg-white text-ink-primary" />
                </SettingsRow>

                {/* Accent color */}
                <div className="pt-4">
                  <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-2">Cor de ênfase</p>
                  {ACCENT_COLORS.map(c => (
                    <button key={c.label} onClick={() => handleAccent(c.value)}
                      className="flex items-center w-full px-1 py-2 rounded-lg hover:bg-gray-50 transition-colors gap-3">
                      <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
                      <span className="text-sm text-ink-primary flex-1 text-left">{c.label}</span>
                      {accentColor === c.value && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--color-accent)' }}>
                          <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                {/* Danger */}
                <div className="pt-4 border-t border-gray-100 mt-2">
                  <button onClick={() => clerk.openUserProfile()}
                    className="text-xs text-red-500 hover:text-red-600 hover:underline transition-colors">
                    Excluir conta
                  </button>
                </div>
              </div>
            )}

            {/* ── TEMAS ── */}
            {tab === 'temas' && (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-3">
                    Seus tópicos ({topics.length})
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4 min-h-[32px]">
                    {topics.map(t => (
                      <div key={t} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-ink-primary text-white text-[13px]">
                        {t}
                        <button onClick={() => removeTopic(t)} className="opacity-60 hover:opacity-100 leading-none text-base">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                {suggestions.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-2">Sugestões para você</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.slice(0, 12).filter(s => !topics.includes(s)).map(s => (
                        <button key={s} onClick={() => addSuggestion(s)}
                          className="flex items-center gap-1 px-3 py-1 rounded-full border border-gray-200 text-[13px] text-ink-secondary hover:border-accent hover:text-accent transition-colors">
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <input value={custom} onChange={e => setCustom(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustom()}
                    placeholder="Adicionar tópico personalizado..."
                    className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-accent bg-white" />
                  <button onClick={addCustom}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-ink-secondary hover:border-accent hover:text-accent transition-colors whitespace-nowrap">
                    Adicionar
                  </button>
                </div>

                <button onClick={saveTopics} disabled={savingTopics}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ background: 'var(--color-accent)' }}>
                  {topicsSaved ? '✓ Salvo!' : savingTopics ? 'Salvando…' : 'Salvar tópicos'}
                </button>
              </div>
            )}

            {/* ── APARÊNCIA ── */}
            {tab === 'aparencia' && (
              <div>
                <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-4">Tema</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'light',  label: 'Claro',   icon: <Sun size={20} />, preview: 'bg-gray-50 border border-gray-200' },
                    { id: 'dark',   label: 'Escuro',  icon: <Moon size={20} />, preview: 'bg-gray-900' },
                    { id: 'system', label: 'Sistema', icon: (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="2" y="2" width="16" height="16" rx="3" fill="url(#sys)" />
                        <defs>
                          <linearGradient id="sys" x1="2" y1="2" x2="18" y2="18">
                            <stop offset="50%" stopColor="#f9fafb"/>
                            <stop offset="50%" stopColor="#111827"/>
                          </linearGradient>
                        </defs>
                      </svg>
                    ), preview: 'bg-gradient-to-br from-gray-50 to-gray-900' },
                  ].map(t => (
                    <button key={t.id} onClick={() => handleTheme(t.id)}
                      className={cn(
                        'flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all',
                        theme === t.id ? 'border-accent' : 'border-gray-200 hover:border-gray-300'
                      )}>
                      <div className={cn('w-full h-14 rounded-lg flex items-center justify-center', t.preview)}>
                        <span className={theme === t.id && t.id !== 'dark' ? 'text-ink-primary' : t.id === 'dark' ? 'text-white' : 'text-gray-500'}>
                          {t.icon}
                        </span>
                      </div>
                      <span className={cn('text-xs font-medium', theme === t.id ? 'text-accent' : 'text-ink-secondary')}>
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-ink-primary">{label}</span>
      {children}
    </div>
  )
}

// ─── User Menu ───────────────────────────────────────────────
function UserMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg w-full hover:bg-bg-secondary transition-colors text-left">
        {user?.imageUrl
          ? <img src={user.imageUrl} alt="" width={26} height={26} className="rounded-full flex-shrink-0" />
          : <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
              style={{ background: 'var(--color-accent)' }}>
              {user?.firstName?.[0] ?? '?'}
            </div>
        }
        <span className="text-sm text-ink-secondary truncate flex-1">{user?.firstName ?? 'Minha conta'}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-56 bg-white rounded-xl border border-border shadow-xl z-50 py-1"
          style={{ animation: 'slideUp 0.15s ease' }}>
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="text-sm font-medium text-ink-primary truncate">{user?.fullName}</p>
            <p className="text-xs text-ink-tertiary truncate">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <div className="py-1">
            <button onClick={() => { setOpen(false); onOpenSettings() }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-ink-secondary hover:text-ink-primary hover:bg-gray-50 transition-colors">
              <Settings size={14} /> Configurações
            </button>
            <button onClick={() => signOut()}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
              <Logout size={14} /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────
interface Props {
  onRefresh?: () => void
  refreshing?: boolean
}

export function Sidebar({ onRefresh, refreshing }: Props) {
  const path = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (path === '/settings') setShowSettings(true)
  }, [path])

  if (collapsed) {
    return (
      <>
        <aside className="flex-shrink-0 flex flex-col h-full py-5 px-2 border-r border-border bg-bg-primary items-center" style={{ width: '3.5rem' }}>
          <button onClick={() => setCollapsed(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-tertiary hover:text-ink-primary hover:bg-bg-secondary transition-colors mb-4">
            <AltArrowRight size={16} />
          </button>
          <LophosLogo size={28} />
        </aside>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </>
    )
  }

  return (
    <>
      <aside className="flex-shrink-0 flex flex-col h-full py-5 px-3 border-r border-border bg-bg-primary" style={{ width: '16.1rem' }}>
        <div className="flex items-center gap-2.5 px-2 mb-6">
          <LophosLogo size={28} />
          <span className="font-display text-lg text-ink-primary flex-1">Lophos</span>
          <button onClick={() => setCollapsed(true)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-ink-muted hover:text-ink-primary hover:bg-bg-secondary transition-colors flex-shrink-0">
            <AltArrowLeft size={14} />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 flex-1">
          <Link href="/feed"
            className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              path === '/feed' ? 'bg-bg-secondary text-ink-primary font-medium' : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
            )}>
            <NotebookMinimalistic size={15} />
            Descobrir
          </Link>
          {onRefresh && (
            <button onClick={onRefresh} disabled={refreshing}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary transition-colors disabled:opacity-50 text-left">
              <Refresh size={15} className={refreshing ? 'animate-spin' : ''} />
              Atualizar feed
            </button>
          )}
        </nav>

        <div className="border-t border-border pt-3">
          <UserMenu onOpenSettings={() => setShowSettings(true)} />
        </div>
      </aside>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}
