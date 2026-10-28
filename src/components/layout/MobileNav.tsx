import { NavLink } from 'react-router-dom'
import { Home, FolderKanban, PencilLine, DraftingCompass, Settings } from 'lucide-react'

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: false },
  { to: '/drawings', label: 'Drawings', icon: DraftingCompass, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
      <div className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {TABS.slice(0, 2).map((tab) => (
          <TabButton key={tab.to} {...tab} />
        ))}

        <div className="flex items-center justify-center">
          <NavLink
            to="/projects/new"
            className="flex h-12 w-12 -translate-y-1 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/35 transition-transform active:scale-95"
            aria-label="New project"
          >
            <PencilLine className="h-5 w-5" />
          </NavLink>
        </div>

        {TABS.slice(2).map((tab) => (
          <TabButton key={tab.to} {...tab} />
        ))}
      </div>
    </nav>
  )
}

function TabButton({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof Home; end: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
          isActive ? 'text-brand-600' : 'text-muted'
        }`
      }
    >
      <Icon className="h-[20px] w-[20px]" />
      {label}
    </NavLink>
  )
}
