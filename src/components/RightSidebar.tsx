'use client'
import { WeatherWidget } from './WeatherWidget'
import { SmartWidgets } from './SmartWidgets'

export function RightSidebar({ topics }: { topics: string[] }) {
  return (
    <aside className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto py-6 pr-2">
      <WeatherWidget />
      <SmartWidgets topics={topics} />
    </aside>
  )
}
