'use client'
export const dynamic = 'force-dynamic'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'

// /settings now just opens the settings modal via the Sidebar
// The Sidebar detects pathname === '/settings' and opens the modal automatically
export default function SettingsPage() {
  const router = useRouter()

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="page-scroll flex items-center justify-center">
        <p className="text-ink-tertiary text-sm">Abrindo configurações…</p>
      </main>
    </div>
  )
}
