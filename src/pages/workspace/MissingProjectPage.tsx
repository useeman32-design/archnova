import { Link } from 'react-router-dom'
import { ArrowLeft, FolderKanban, Smartphone } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { buttonClasses } from '@/components/ui/Button'

export function MissingProjectPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-16 text-center sm:py-24">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <Smartphone className="h-7 w-7" />
        </span>
        <h1 className="mt-6 text-xl font-semibold text-ink-text">Project not available on this device</h1>
        <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted">
          ArchNova currently saves projects in this browser only. A project created on your desktop will not automatically appear on your phone yet. Cross-device project sync needs shared server storage, which is not connected in this prototype.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/projects" className={buttonClasses('primary', 'md')}>
            <FolderKanban className="h-4 w-4" /> Projects on this device
          </Link>
          <Link to="/" className={buttonClasses('secondary', 'md')}>
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
        <p className="mt-5 text-[12px] leading-relaxed text-faint">
          To work on the same design across devices, configure ArchNova's shared project service before opening the project link here.
        </p>
      </div>
    </AppShell>
  )
}
