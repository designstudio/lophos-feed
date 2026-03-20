import { Sidebar } from '@/components/Sidebar'

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <Sidebar />
      {children}
    </div>
  )
}
