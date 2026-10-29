import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Menu, PencilLine, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { Logo } from './Logo'

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  /* Never leave the drawer mounted across navigations — prevents a second
     sidebar lingering over the next page. */
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50 animate-fade-in" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full animate-slide-in-right">
            <div className="relative h-full">
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute right-3 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-ink-800 text-white/80"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-text hover:bg-canvas-soft"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo onDark={false} showWordmark={false} />
          <NavLink
            to="/projects/new"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white"
            aria-label="New project"
          >
            <PencilLine className="h-4 w-4" />
          </NavLink>
        </header>

        <main className="min-w-0 flex-1 pb-24 lg:pb-10">{children}</main>
      </div>

      <MobileNav />
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 lg:px-8">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold leading-tight text-ink-text sm:text-xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
