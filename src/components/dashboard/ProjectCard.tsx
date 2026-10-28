import { useNavigate } from 'react-router-dom'
import { Copy, MapPin, Ruler, ArrowUpRight, Clock } from 'lucide-react'
import type { Project } from '@/types'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { HouseIllustration } from '@/components/illustrations/HouseIllustration'
import { formatMoney, formatDimensions, relativeTime } from '@/lib/format'

export function ProjectCard({
  project,
  onDuplicate,
}: {
  project: Project
  onDuplicate?: (project: Project) => void
}) {
  const navigate = useNavigate()
  const outdoor = project.preferences.outdoor

  return (
    <div
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/workspace/${project.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          navigate(`/workspace/${project.id}`)
        }
      }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-canvas-soft">
        <HouseIllustration
          roof={project.roof}
          exterior={project.preferences.exteriorFinish}
          showPool={outdoor.includes('pool')}
          showGarage={outdoor.includes('garage')}
          showGarden={outdoor.includes('garden') || outdoor.includes('terrace')}
          variant={project.thumbnailSeed}
          className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3">
          <StatusBadge status={project.status} />
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-surface/90 px-2 py-1 text-[11px] font-medium text-muted shadow-sm backdrop-blur">
          <Clock className="h-3 w-3" />
          {relativeTime(project.updatedAt)}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-semibold leading-snug text-ink-text">{project.name}</h3>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-brand-600" />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Ruler className="h-3.5 w-3.5" />
            {formatDimensions(project.plot.width, project.plot.length, project.plot.units)}
          </span>
          {project.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {project.location}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-soft pt-3">
          <span className="text-[12px] font-medium text-faint">
            {formatMoney(project.budget.amount, project.budget.currency)} budget
          </span>
          <div className="flex items-center gap-1">
            {onDuplicate ? (
              <Button
                size="sm"
                variant="subtle"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={(event) => {
                  event.stopPropagation()
                  onDuplicate(project)
                }}
              >
                Duplicate
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation()
                navigate(`/workspace/${project.id}`)
              }}
            >
              Open
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
