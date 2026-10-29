import { NavLink } from 'react-router-dom'
import { Home, FolderKanban, PencilLine, Settings, Boxes } from 'lucide-react'
import { Logo } from './Logo'
import { Button } from '@/components/ui/Button'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/projects', label: 'My Projects', icon: FolderKanban, end: false },
  { to: '/assets', label: 'Assets', icon: Boxes, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-ink-900 text-white">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto scroll-dark px-3 py-2">
        <NavLink
          to="/projects/new"
          onClick={onNavigate}
          className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-brand-600/30 transition-colors hover:bg-brand-700"
        >
          <PencilLine className="h-4 w-4" />
          New Project
        </NavLink>

        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors ${
                isActive
                  ? 'bg-ink-800 text-white'
                  : 'text-white/60 hover:bg-ink-800/50 hover:text-white'
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-ink-700/60 p-3">
        <div className="rounded-xl bg-ink-850 p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/20 text-[12px] font-bold text-brand-300">
              A
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-medium text-white">Ademola Okafor</p>
              <p className="truncate text-[11px] text-white/45">Designer · Pro</p>
            </div>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
            <div className="h-full w-[68%] rounded-full bg-brand-500" />
          </div>
          <p className="mt-1.5 text-[10px] text-white/40">6 of 9 monthly designs used</p>
        </div>
      </div>
    </aside>
  )
}

export function SidebarSkeleton() {
  return (
    <div className="flex w-64 shrink-0 flex-col bg-ink-900">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <Button variant="ghost" className="mx-3 mt-2 justify-start" disabled>
        Loading…
      </Button>
    </div>
  )
}
