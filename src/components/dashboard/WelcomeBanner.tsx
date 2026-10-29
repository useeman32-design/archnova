import { Link } from 'react-router-dom'
import { Wand2, FolderKanban, ArrowRight, Sparkles, Ruler, Clock } from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { HouseIllustration } from '@/components/illustrations/HouseIllustration'

export function WelcomeBanner({
  projectCount,
  lastUpdated,
  onStart,
}: {
  projectCount: number
  lastUpdated: string | null
  onStart: () => void
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-ink-900 text-white shadow-lg shadow-ink-950/20">
      {/* decorative geometry */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-600/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />
      <svg
        className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-[0.14]"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMaxYMid slice"
        aria-hidden
      >
        <defs>
          <pattern id="grid-deco" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke="#ffffff" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="400" height="300" fill="url(#grid-deco)" />
      </svg>

      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.35fr_1fr] lg:items-center">
        <div>
          <Badge tone="brand">
            <Sparkles className="h-3 w-3" /> AI-assisted design
          </Badge>
          <h2 className="mt-4 text-[22px] font-bold leading-tight sm:text-[26px]">
            Design Your Dream Home with AI
          </h2>
          <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-white/65">
            Tell us about your plot and your taste. ArchNova turns a short brief into a
            prop layout, a rendered preview and a full drawing set — reviewed by you before anything
            is built.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" icon={<Wand2 className="h-4 w-4" />} onClick={onStart}>
              Start New Project
            </Button>
            <Link
              to="/projects"
              className={`${buttonClasses('ghost', 'lg')} border border-white/15`}
            >
              <FolderKanban className="h-4 w-4" />
              Browse projects
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-9 gap-y-4">
            <Stat icon={<Ruler className="h-4 w-4" />} label="Projects" value={`${projectCount} saved`} />
            <Stat
              icon={<Clock className="h-4 w-4" />}
              label="Last activity"
              value={lastUpdated ?? 'No projects yet'}
            />
            <Stat icon={<Sparkles className="h-4 w-4" />} label="AI assistant" value="Ready to preview" />
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-3 rounded-3xl bg-white/5 blur-xl" />
          <div className="relative rounded-2xl bg-ink-950/40 p-3 ring-1 ring-white/10">
            <HouseIllustration roof="flat" exterior="render" showPool showGarage className="h-56 w-full rounded-xl sm:h-64" />
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-brand-300">{icon}</span>
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-wide text-white/45">{label}</div>
        <div className="text-[13px] font-semibold text-white">{value}</div>
      </div>
    </div>
  )
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h3 className="text-[15px] font-semibold text-ink-text">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {action ? (
        <Link to="/projects" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  )
}
