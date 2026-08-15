'use client'
import { useState, useEffect, useRef } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { Sun, MoonStar, Monitor02 } from '@untitledui/icons'
import { cn } from '@/lib/utils'
import { useFeedContext } from '@/components/FeedContext'
import { AccentPicker } from './AccentPicker'
import { WIDGET_OPTIONS, applyTheme, applyAccent } from './utils'

export function SettingsPageContent() {
  const { user } = useUser()
  const clerk = useClerk()
  const { triggerRefresh } = useFeedContext()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const passwordEnabled = user?.passwordEnabled !== false
  // Geral
  const [theme, setTheme] = useState('light')
  const [accentColor, setAccentColor] = useState('#ca774b')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light'
    const savedAccent = localStorage.getItem('accent_color') || '#ca774b'

    setTheme(savedTheme)
    setAccentColor(savedAccent)
    applyTheme(savedTheme)
    applyAccent(savedAccent)
  }, [])

  // Widgets
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => WIDGET_OPTIONS.map(w => w.id))
  const [activeWidgets, setActiveWidgets] = useState<string[]>(() => ['weather', ...WIDGET_OPTIONS.map(w => w.id)])

  useEffect(() => {
    try {
      const savedValue = localStorage.getItem('lophos_widgets')
      if (!savedValue) return

      const saved = JSON.parse(savedValue) as string[]
      const ordered = saved.filter(id => id !== 'weather')
      const allIds = WIDGET_OPTIONS.map(w => w.id)
      setWidgetOrder([...ordered, ...allIds.filter(id => !ordered.includes(id))])
      setActiveWidgets(saved)
    } catch {}
  }, [])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Conta
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarMessage, setAvatarMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!user) return
    setFirstName(user.firstName || '')
    setLastName(user.lastName || '')
  }, [user])

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

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!user || !file) return
    if (!file.type.startsWith('image/')) {
      setAvatarMessage({ type: 'error', text: 'Selecione um arquivo de imagem válido.' })
      event.target.value = ''
      return
    }

    setUploadingAvatar(true)
    setAvatarMessage(null)
    try {
      await user.setProfileImage({ file })
      await user.reload()
      setAvatarMessage({ type: 'success', text: 'Imagem atualizada.' })
    } catch (error) {
      setAvatarMessage({ type: 'error', text: getClerkErrorMessage(error, 'Não foi possível atualizar a imagem.') })
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const resetPasswordForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMessage(null)
    setShowPasswordForm(false)
  }

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 8 caracteres.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'A confirmação não corresponde à nova senha.' })
      return
    }

    setSavingPassword(true)
    setPasswordMessage(null)
    const hadPassword = user.passwordEnabled
    try {
      await user.updatePassword({
        newPassword,
        currentPassword: hadPassword ? currentPassword : undefined,
        signOutOfOtherSessions: false,
      })
      await user.reload()
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage({ type: 'success', text: hadPassword ? 'Senha atualizada.' : 'Senha criada.' })
    } catch (error) {
      setPasswordMessage({ type: 'error', text: getClerkErrorMessage(error, 'Não foi possível atualizar a senha.') })
    } finally {
      setSavingPassword(false)
    }
  }

  const saveTopics = async () => {
    if (topics.length === 0) return
    setSavingTopics(true)
    await fetch('/api/topics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topics }) })
    setSavingTopics(false)
    setTopicsSaved(true)
    setTimeout(() => setTopicsSaved(false), 2000)
    triggerRefresh()
  }

  const saveExcludedTopics = async () => {
    setSavingExcluded(true)
    await fetch('/api/topics/excluded', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ excludedTopics }) })
    setSavingExcluded(false)
    setExcludedSaved(true)
    setTimeout(() => setExcludedSaved(false), 2000)
  }

  return (
    <div className="settings-page-scroll">
      <main className="settings-page">
        <header className="settings-page__header">
          <h1>Configurações</h1>
        </header>

        <div className="settings-page__stack">
          <section className="settings-page-card settings-account-card" aria-labelledby="settings-avatar">
            <div className="settings-page-card__header">
              <h2 id="settings-avatar">Avatar</h2>
              <p>Sua imagem de perfil.</p>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              aria-label="Selecionar nova imagem de perfil"
            />
            <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={!user || uploadingAvatar} className="settings-account-avatar" aria-label="Alterar avatar">
              {user?.imageUrl
                ? <img src={user.imageUrl} alt="" />
                : <span>{user?.firstName?.[0] ?? '?'}</span>}
            </button>
            <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={!user || uploadingAvatar} className="settings-button settings-button--secondary mt-7">
              {uploadingAvatar ? 'Enviando…' : 'Alterar imagem'}
            </button>
            {avatarMessage && (
              <p className={cn('settings-form-message', avatarMessage.type === 'error' && 'is-error')} role={avatarMessage.type === 'error' ? 'alert' : 'status'}>
                {avatarMessage.text}
              </p>
            )}
          </section>

          <section className="settings-page-card" aria-labelledby="settings-basic-information">
            <div className="settings-page-card__header">
              <h2 id="settings-basic-information">Informações básicas</h2>
              <p>Seu nome, endereço de e-mail e dados de acesso.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="settings-field">
                <span>Nome</span>
                <input value={firstName} onChange={(event) => { setFirstName(event.target.value); setNameSaved(false) }} />
              </label>
              <label className="settings-field">
                <span>Sobrenome</span>
                <input value={lastName} onChange={(event) => { setLastName(event.target.value); setNameSaved(false) }} />
              </label>
            </div>
            <label className="settings-field mt-4">
              <span>E-mail</span>
              <input value={user?.primaryEmailAddress?.emailAddress ?? ''} readOnly disabled />
            </label>
            <button type="button" onClick={saveName} disabled={savingName} className="settings-button settings-button--primary mt-5">
              {nameSaved ? '✓ Salvo!' : savingName ? 'Salvando…' : 'Salvar'}
            </button>
            <div className="settings-account-action settings-account-action--password">
              <div>
                <h3>Senha</h3>
                <p>{passwordEnabled ? 'Altere sua senha de acesso.' : 'Crie uma senha para acessar além do login social.'}</p>
              </div>
              {!showPasswordForm && (
                <button type="button" onClick={() => setShowPasswordForm(true)} className="settings-button settings-button--secondary">
                  {passwordEnabled ? 'Alterar senha' : 'Criar senha'}
                </button>
              )}
            </div>
            {showPasswordForm && (
              <form onSubmit={savePassword} className="settings-password-form">
                {passwordEnabled && (
                  <label className="settings-field">
                    <span>Senha atual</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      required
                    />
                  </label>
                )}
                <div className="settings-password-form__grid">
                  <label className="settings-field">
                    <span>Nova senha</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                    />
                  </label>
                  <label className="settings-field">
                    <span>Confirmar nova senha</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                    />
                  </label>
                </div>
                {passwordMessage && (
                  <p className={cn('settings-form-message', passwordMessage.type === 'error' && 'is-error')} role={passwordMessage.type === 'error' ? 'alert' : 'status'}>
                    {passwordMessage.text}
                  </p>
                )}
                <div className="settings-password-form__actions">
                  <button type="submit" disabled={savingPassword} className="settings-button settings-button--primary">
                    {savingPassword ? 'Salvando…' : passwordEnabled ? 'Salvar nova senha' : 'Criar senha'}
                  </button>
                  <button type="button" onClick={resetPasswordForm} disabled={savingPassword} className="settings-button settings-button--secondary">
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="settings-page-card" aria-labelledby="settings-appearance">
            <div className="settings-page-card__header">
              <h2 id="settings-appearance">Aparência</h2>
              <p>Escolha como o Lophos aparece para você.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                { id: 'light', label: 'Claro', icon: <Sun size={22} /> },
                { id: 'dark', label: 'Escuro', icon: <MoonStar size={22} /> },
                { id: 'system', label: 'Sistema', icon: <Monitor02 size={22} /> },
              ] as { id: string; label: string; icon: React.ReactNode }[]).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleTheme(option.id)}
                  aria-pressed={theme === option.id}
                  className={cn('settings-theme-option', theme === option.id && 'is-active')}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-page-card" aria-labelledby="settings-accent">
            <div className="flex items-center justify-between gap-5">
              <div className="settings-page-card__header mb-0">
                <h2 id="settings-accent">Cor de ênfase</h2>
                <p>Use uma cor para ações e detalhes importantes.</p>
              </div>
              <AccentPicker value={accentColor} onChange={handleAccent} />
            </div>
          </section>

          <section className="settings-page-card" aria-labelledby="settings-topics">
            <div className="settings-page-card__header">
              <h2 id="settings-topics">Tópicos de interesse</h2>
              <p>Personalize as histórias que aparecem no seu feed.</p>
            </div>
            <div className="mb-4 flex min-h-8 flex-wrap gap-2">
              {topics.map((topic) => (
                <span key={topic} className="settings-topic-chip">
                  {topic}
                  <button
                    type="button"
                    onClick={() => { setTopics((current) => current.filter((item) => item !== topic)); setTopicsSaved(false) }}
                    aria-label={`Remover ${topic}`}
                  >×</button>
                </span>
              ))}
            </div>
            <div className="settings-inline-form">
              <input
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && custom.trim() && !topics.includes(custom.trim())) {
                    setTopics((current) => [...current, custom.trim()]); setCustom(''); setTopicsSaved(false)
                  }
                }}
                aria-label="Novo tópico de interesse"
                placeholder="Adicionar tópico..."
              />
              <button
                type="button"
                className="settings-button settings-button--secondary"
                onClick={() => {
                  if (custom.trim() && !topics.includes(custom.trim())) {
                    setTopics((current) => [...current, custom.trim()]); setCustom(''); setTopicsSaved(false)
                  }
                }}
              >Adicionar</button>
            </div>
            <button type="button" onClick={saveTopics} disabled={savingTopics} className="settings-button settings-button--primary mt-4">
              {topicsSaved ? '✓ Salvo!' : savingTopics ? 'Salvando…' : 'Salvar tópicos'}
            </button>
          </section>

          <section className="settings-page-card" aria-labelledby="settings-excluded-topics">
            <div className="settings-page-card__header">
              <h2 id="settings-excluded-topics">Tópicos excluídos</h2>
              <p>Artigos com esses termos não aparecerão no seu feed.</p>
            </div>
            <div className="mb-4 flex min-h-8 flex-wrap gap-2">
              {excludedTopics.map((topic) => (
                <span key={topic} className="settings-topic-chip settings-topic-chip--excluded">
                  {topic}
                  <button
                    type="button"
                    onClick={() => { setExcludedTopics((current) => current.filter((item) => item !== topic)); setExcludedSaved(false) }}
                    aria-label={`Remover exclusão ${topic}`}
                  >×</button>
                </span>
              ))}
              {excludedTopics.length === 0 && <p className="text-sm italic text-ink-tertiary">Nenhum tópico excluído</p>}
            </div>
            <div className="settings-inline-form">
              <input
                value={excludedCustom}
                onChange={(event) => setExcludedCustom(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && excludedCustom.trim() && !excludedTopics.includes(excludedCustom.trim())) {
                    setExcludedTopics((current) => [...current, excludedCustom.trim()]); setExcludedCustom(''); setExcludedSaved(false)
                  }
                }}
                aria-label="Novo tópico excluído"
                placeholder="Ex: anime, k-pop..."
              />
              <button
                type="button"
                className="settings-button settings-button--secondary"
                onClick={() => {
                  if (excludedCustom.trim() && !excludedTopics.includes(excludedCustom.trim())) {
                    setExcludedTopics((current) => [...current, excludedCustom.trim()]); setExcludedCustom(''); setExcludedSaved(false)
                  }
                }}
              >Adicionar</button>
            </div>
            <button type="button" onClick={saveExcludedTopics} disabled={savingExcluded} className="settings-button settings-button--primary mt-4">
              {excludedSaved ? '✓ Salvo!' : savingExcluded ? 'Salvando…' : 'Salvar exclusões'}
            </button>
          </section>

          <section className="settings-page-card" aria-labelledby="settings-widgets">
            <div className="settings-page-card__header">
              <h2 id="settings-widgets">Widgets</h2>
              <p>Ative e ordene os widgets. Arraste os itens para reordenar.</p>
            </div>
            <div className="settings-widget-row is-disabled">
              <DragHandle />
              <span className="flex-1">Clima</span>
              <span className="settings-status-pill">Sempre ativo</span>
            </div>
            {widgetOrder.map((id, index) => {
              const widget = WIDGET_OPTIONS.find((option) => option.id === id)
              if (!widget) return null
              const isActive = activeWidgets.includes(id)
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(event) => onDragOver(event, index)}
                  onDrop={() => onDrop(index)}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                  className={cn('settings-widget-row', dragOverIdx === index && dragIdx !== index && 'is-drag-over')}
                >
                  <DragHandle />
                  <span className="flex-1">{widget.label}</span>
                  <button
                    type="button"
                    onClick={() => toggleWidget(id)}
                    role="switch"
                    aria-checked={isActive}
                    aria-label={`${isActive ? 'Desativar' : 'Ativar'} ${widget.label}`}
                    className={cn('settings-switch', isActive && 'is-active')}
                  ><span /></button>
                </div>
              )
            })}
          </section>

          <section className="settings-page-card" aria-labelledby="settings-delete-account">
            <div className="settings-account-action">
              <div>
                <h2 id="settings-delete-account">Excluir conta</h2>
                <p>Remove permanentemente sua conta e todos os seus dados.</p>
              </div>
              <button type="button" onClick={() => clerk.openUserProfile()} className="settings-button settings-button--danger">Excluir conta</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

function DragHandle() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 4h6M5 8h6M5 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function getClerkErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'object' || error === null) return fallback
  const clerkError = error as { errors?: Array<{ longMessage?: string; message?: string }>; message?: string }
  return clerkError.errors?.[0]?.longMessage || clerkError.errors?.[0]?.message || clerkError.message || fallback
}
