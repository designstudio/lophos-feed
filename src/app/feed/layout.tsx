'use client'
import { FeedProvider } from '@/components/FeedContext'
import { SidebarWithRefresh } from '@/components/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeedProvider>
      <div className="page-shell">
        <SidebarWithRefresh />
        {children}
      </div>
    </FeedProvider>
  )
}
