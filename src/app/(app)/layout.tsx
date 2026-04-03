'use client'
import { FeedProvider } from '@/components/FeedContext'
import { SidebarWithRefresh } from '@/components/Sidebar'
import { MobileNav } from '@/components/MobileNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeedProvider>
      <div className="min-h-screen">
        <div className="hidden md:contents">
          <SidebarWithRefresh />
        </div>
        {children}
        <MobileNav />
      </div>
    </FeedProvider>
  )
}
