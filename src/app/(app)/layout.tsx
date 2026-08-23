import { FeedProvider } from '@/components/FeedContext'
import { SidebarWithRefresh } from '@/components/Sidebar'
import { MobileNav } from '@/components/MobileNav'
import { NavigationFeedback } from '@/components/NavigationFeedback'
import { AuthPromptProvider } from '@/components/auth/AuthPrompt'
import { TooltipProvider } from '@/components/Tooltip'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthPromptProvider>
      <TooltipProvider>
        <FeedProvider>
          <NavigationFeedback />
          <div className="page-shell">
            <div className="hidden md:contents">
              <SidebarWithRefresh />
            </div>
            {children}
            <MobileNav />
          </div>
        </FeedProvider>
      </TooltipProvider>
    </AuthPromptProvider>
  )
}
