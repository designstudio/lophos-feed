export default function SettingsLoading() {
  return (
    <div className="settings-page-scroll" aria-busy="true" aria-label="Carregando configurações" role="status">
      <span className="sr-only">Carregando configurações…</span>
      <main className="settings-page animate-pulse" aria-hidden="true">
        <header className="settings-page__header">
          <div className="skeleton h-8 w-44 rounded" />
        </header>
        <div className="settings-page__stack">
          <div className="settings-page-card space-y-5">
            <div className="skeleton h-6 w-24 rounded" />
            <div className="skeleton h-24 w-24 rounded-full" />
            <div className="skeleton h-10 w-32 rounded-lg" />
          </div>
          <div className="settings-page-card space-y-4">
            <div className="skeleton h-6 w-48 rounded" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="skeleton h-12 rounded-lg" />
              <div className="skeleton h-12 rounded-lg" />
            </div>
            <div className="skeleton h-12 rounded-lg" />
          </div>
        </div>
      </main>
    </div>
  )
}
