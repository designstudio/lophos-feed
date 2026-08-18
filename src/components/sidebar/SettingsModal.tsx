'use client'
import { useState, useEffect, useRef } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { AlertCircle, Check, CheckCircle, Sun, MoonStar, Monitor02, Upload01 } from '@untitledui/icons'
import { cn } from '@/lib/utils'
import { TransitionText } from '@/components/TransitionText'
import { UserAvatar } from '@/components/UserAvatar'
import { applyTheme } from './utils'

function normalizedValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].sort()
}

function stringListsEqual(left: string[], right: string[]): boolean {
  const normalizedLeft = normalizedValues(left)
  const normalizedRight = normalizedValues(right)
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index])
}

export function SettingsPageContent() {
  const { user } = useUser()
  const clerk = useClerk()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const deleteConfirmRef = useRef<HTMLButtonElement>(null)
  const passwordEnabled = user?.passwordEnabled !== false
  // Geral
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light'

    setTheme(savedTheme)
    applyTheme(savedTheme)
  }, [])

  // Conta
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [savedFirstName, setSavedFirstName] = useState(user?.firstName || '')
  const [savedLastName, setSavedLastName] = useState(user?.lastName || '')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [renderedToastMessage, setRenderedToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [toastOpen, setToastOpen] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setFirstName(user.firstName || '')
    setLastName(user.lastName || '')
    setSavedFirstName(user.firstName || '')
    setSavedLastName(user.lastName || '')
  }, [user])

  useEffect(() => {
    if (!toastMessage) return
    const timeout = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(timeout)
  }, [toastMessage])

  useEffect(() => {
    let frame = 0
    let timeout = 0

    if (toastMessage) {
      setRenderedToastMessage(toastMessage)
      setToastOpen(false)
      frame = window.requestAnimationFrame(() => setToastOpen(true))
    } else {
      setToastOpen(false)
      const closeDuration = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--toast-close'),
      ) || 250
      timeout = window.setTimeout(() => setRenderedToastMessage(null), closeDuration)
    }

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [toastMessage])

  useEffect(() => {
    if (confirmingDelete) deleteConfirmRef.current?.focus()
  }, [confirmingDelete])

  // Topics
  const [topics, setTopics] = useState<string[]>([])
  const [savedTopics, setSavedTopics] = useState<string[]>([])
  const [topicsLoaded, setTopicsLoaded] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [savingTopics, setSavingTopics] = useState(false)
  const [topicsSaved, setTopicsSaved] = useState(false)

  // Excluded Topics
  const [excludedTopics, setExcludedTopics] = useState<string[]>([])
  const [savedExcludedTopics, setSavedExcludedTopics] = useState<string[]>([])
  const [excludedTopicsLoaded, setExcludedTopicsLoaded] = useState(false)
  const [excludedCustom, setExcludedCustom] = useState('')
  const [savingExcluded, setSavingExcluded] = useState(false)
  const [excludedSaved, setExcludedSaved] = useState(false)

  // Carrega tópicos excluídos
  useEffect(() => {
    fetch('/api/topics/excluded')
      .then(r => r.json())
      .then(data => {
        const loadedTopics = data.excludedTopics ?? []
        setExcludedTopics(loadedTopics)
        setSavedExcludedTopics(loadedTopics)
        setExcludedTopicsLoaded(true)
      })
      .catch(() => {})
  }, [])

  // Carrega tópicos de interesse e sugestões
  useEffect(() => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(data => {
        const t = (data.topics || []).map((x: any) => x.topic)
        setTopics(t)
        setSavedTopics(t)
        setTopicsLoaded(true)
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

  const saveName = async () => {
    if (!user || !firstName.trim()) return
    setSavingName(true)
    try {
      const nextFirstName = firstName.trim()
      const nextLastName = lastName.trim()
      await user.update({ firstName: nextFirstName, lastName: nextLastName })
      setFirstName(nextFirstName)
      setLastName(nextLastName)
      setSavedFirstName(nextFirstName)
      setSavedLastName(nextLastName)
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2000)
    } catch (e) {
      console.error(e)
    } finally {
      setSavingName(false)
    }
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!user || !file) return
    if (!file.type.startsWith('image/')) {
      setToastMessage({ type: 'error', text: 'Selecione um arquivo de imagem válido.' })
      event.target.value = ''
      return
    }

    setUploadingAvatar(true)
    setToastMessage(null)
    try {
      await user.setProfileImage({ file })
      await user.reload()
      setToastMessage({ type: 'success', text: 'Imagem atualizada.' })
    } catch (error) {
      setToastMessage({ type: 'error', text: getClerkErrorMessage(error, 'Não foi possível atualizar a imagem.') })
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const removeAvatar = async () => {
    if (!user || !user.hasImage) return

    setRemovingAvatar(true)
    setToastMessage(null)
    try {
      await user.setProfileImage({ file: null })
      await user.reload()
      setToastMessage({ type: 'success', text: 'Imagem removida.' })
    } catch (error) {
      setToastMessage({ type: 'error', text: getClerkErrorMessage(error, 'Não foi possível remover a imagem.') })
    } finally {
      setRemovingAvatar(false)
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
    try {
      const response = await fetch('/api/topics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topics }) })
      if (!response.ok) throw new Error('Failed to save topics')
      const data = await response.json()
      const persistedTopics = Array.isArray(data.topicsSaved) ? data.topicsSaved : topics
      setTopics(persistedTopics)
      setSavedTopics(persistedTopics)
      setTopicsSaved(true)
      setTimeout(() => setTopicsSaved(false), 2000)
      sessionStorage.removeItem('lophos_feed_cache')
      setToastMessage({ type: 'success', text: 'Tópicos atualizados.' })
    } catch (error) {
      console.error(error)
      setToastMessage({ type: 'error', text: 'Não foi possível atualizar os tópicos.' })
    } finally {
      setSavingTopics(false)
    }
  }

  const saveExcludedTopics = async () => {
    setSavingExcluded(true)
    try {
      const response = await fetch('/api/topics/excluded', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ excludedTopics }) })
      if (!response.ok) throw new Error('Failed to save excluded topics')
      setSavedExcludedTopics(excludedTopics)
      setExcludedSaved(true)
      setTimeout(() => setExcludedSaved(false), 2000)
      sessionStorage.removeItem('lophos_feed_cache')
    } catch (error) {
      console.error(error)
    } finally {
      setSavingExcluded(false)
    }
  }

  const cancelAccountDeletion = () => {
    setConfirmingDelete(false)
    setDeleteAccountError(null)
    requestAnimationFrame(() => deleteTriggerRef.current?.focus())
  }

  const deleteAccount = async () => {
    if (deletingAccount) return
    setDeletingAccount(true)
    setDeleteAccountError(null)

    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'delete-account' }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Não foi possível excluir a conta.')

      for (const key of ['theme', 'lophos_suggestions', 'search_history']) {
        localStorage.removeItem(key)
      }

      try {
        await clerk.signOut({ redirectUrl: '/' })
      } catch {
        window.location.assign('/')
      }
    } catch (error) {
      setDeleteAccountError(error instanceof Error ? error.message : 'Não foi possível excluir a conta.')
      setDeletingAccount(false)
    }
  }

  const nameChanged = firstName.trim() !== savedFirstName || lastName.trim() !== savedLastName
  const passwordChanged = Boolean(currentPassword || newPassword || confirmPassword)
  const topicsChanged = topicsLoaded && !stringListsEqual(topics, savedTopics)
  const excludedTopicsChanged = excludedTopicsLoaded && !stringListsEqual(excludedTopics, savedExcludedTopics)
  return (
    <>
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
            <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={!user || uploadingAvatar || removingAvatar} className="settings-account-avatar" aria-label="Alterar avatar">
              <UserAvatar user={user} className="h-full w-full text-xl" />
            </button>
            <div className="settings-avatar-actions">
              <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={!user || uploadingAvatar || removingAvatar} className="settings-button settings-button--secondary settings-control-shadow">
                <TransitionText stateKey={uploadingAvatar ? 'uploading' : 'idle'}>
                  {uploadingAvatar ? 'Enviando…' : <><Upload01 size={16} aria-hidden="true" />Alterar imagem</>}
                </TransitionText>
              </button>
              <button type="button" onClick={removeAvatar} disabled={!user?.hasImage || uploadingAvatar || removingAvatar} className="settings-avatar-remove">
                <TransitionText stateKey={removingAvatar ? 'removing' : 'idle'}>
                  {removingAvatar ? 'Removendo…' : 'Remover'}
                </TransitionText>
              </button>
            </div>
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
            <button type="button" onClick={saveName} disabled={!user || !firstName.trim() || !nameChanged || savingName} className="settings-button settings-button--primary mt-5">
              <TransitionText stateKey={nameSaved ? 'saved' : savingName ? 'saving' : 'idle'}>
                {nameSaved ? <><Check size={16} aria-hidden="true" />Salvo</> : savingName ? 'Salvando…' : 'Salvar'}
              </TransitionText>
            </button>
            <div className="settings-account-action settings-account-action--password">
              <div>
                <h3>Senha</h3>
                <p>{passwordEnabled ? 'Altere sua senha de acesso.' : 'Crie uma senha para acessar além do login social.'}</p>
              </div>
              {!showPasswordForm && (
                <button type="button" onClick={() => setShowPasswordForm(true)} className="settings-button settings-button--secondary settings-control-shadow">
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
                  <button type="submit" disabled={!passwordChanged || savingPassword} className="settings-button settings-button--primary">
                    <TransitionText stateKey={savingPassword ? 'saving' : 'idle'}>
                      {savingPassword ? 'Salvando…' : 'Salvar'}
                    </TransitionText>
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
                className="settings-button settings-button--secondary settings-control-shadow"
                onClick={() => {
                  if (custom.trim() && !topics.includes(custom.trim())) {
                    setTopics((current) => [...current, custom.trim()]); setCustom(''); setTopicsSaved(false)
                  }
                }}
              >Adicionar</button>
            </div>
            <button type="button" onClick={saveTopics} disabled={!topicsChanged || topics.length === 0 || savingTopics} className="settings-button settings-button--primary mt-4">
              <TransitionText stateKey={topicsSaved ? 'saved' : savingTopics ? 'saving' : 'idle'}>
                {topicsSaved ? <><Check size={16} aria-hidden="true" />Salvo</> : savingTopics ? 'Salvando…' : 'Salvar'}
              </TransitionText>
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
                className="settings-button settings-button--secondary settings-control-shadow"
                onClick={() => {
                  if (excludedCustom.trim() && !excludedTopics.includes(excludedCustom.trim())) {
                    setExcludedTopics((current) => [...current, excludedCustom.trim()]); setExcludedCustom(''); setExcludedSaved(false)
                  }
                }}
              >Adicionar</button>
            </div>
            <button type="button" onClick={saveExcludedTopics} disabled={!excludedTopicsChanged || savingExcluded} className="settings-button settings-button--primary mt-4">
              <TransitionText stateKey={excludedSaved ? 'saved' : savingExcluded ? 'saving' : 'idle'}>
                {excludedSaved ? <><Check size={16} aria-hidden="true" />Salvo</> : savingExcluded ? 'Salvando…' : 'Salvar'}
              </TransitionText>
            </button>
          </section>

          <section className={cn('settings-page-card settings-delete-account-card', confirmingDelete && 'settings-delete-account-card--confirming')} aria-labelledby="settings-delete-account">
            <div className="settings-account-action settings-account-action--stacked">
              <div>
                <h2 id="settings-delete-account">Excluir conta</h2>
                {confirmingDelete ? (
                  <p>Tem certeza? Esta ação não pode ser desfeita.<br />Confirme para excluir permanentemente sua conta.</p>
                ) : (
                  <p>Remova permanentemente todos os seus dados<br />do Lophos. Esta ação não pode ser desfeita.</p>
                )}
              </div>
              {confirmingDelete ? (
                <div className="settings-delete-account-actions">
                  <button ref={deleteConfirmRef} type="button" onClick={deleteAccount} disabled={deletingAccount} className="settings-button settings-button--destructive">
                    <TransitionText stateKey={deletingAccount ? 'deleting' : 'idle'}>
                      {deletingAccount ? 'Excluindo…' : 'Confirmar exclusão'}
                    </TransitionText>
                  </button>
                  <button type="button" onClick={cancelAccountDeletion} disabled={deletingAccount} className="settings-button settings-button--secondary settings-control-shadow">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  ref={deleteTriggerRef}
                  type="button"
                  onClick={() => { setConfirmingDelete(true); setDeleteAccountError(null) }}
                  aria-expanded="false"
                  className="settings-button settings-button--danger settings-control-shadow"
                >
                  Excluir conta
                </button>
              )}
              {deleteAccountError && <p className="settings-form-message is-error" role="alert">{deleteAccountError}</p>}
            </div>
          </section>
        </div>
        </main>
      </div>

      {renderedToastMessage && (
        <div className="settings-toast-viewport">
          <div
            className={cn('settings-toast t-toast', toastOpen && 'is-open', renderedToastMessage.type === 'error' && 'settings-toast--error')}
            role={renderedToastMessage.type === 'error' ? 'alert' : 'status'}
            aria-live={renderedToastMessage.type === 'error' ? 'assertive' : 'polite'}
          >
            {renderedToastMessage.type === 'error'
              ? <AlertCircle size={18} aria-hidden="true" />
              : <CheckCircle size={18} aria-hidden="true" />}
            <span>{renderedToastMessage.text}</span>
          </div>
        </div>
      )}
    </>
  )
}

function getClerkErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'object' || error === null) return fallback
  const clerkError = error as { errors?: Array<{ longMessage?: string; message?: string }>; message?: string }
  return clerkError.errors?.[0]?.longMessage || clerkError.errors?.[0]?.message || clerkError.message || fallback
}
