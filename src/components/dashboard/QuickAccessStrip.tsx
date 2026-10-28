import { Link } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import type { Project } from '@/types'
import { FloorPlanDiagram } from '@/components/floor-plan/FloorPlanDiagram'

export function QuickAccessStrip({ projects }: { projects: Project[] }) {
  const items = projects.slice(0, 4)

  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <LayoutGrid className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-ink-text">Saved designs</h3>
            <p className="text-[12.5px] text-muted">Jump straight back into a plan you were working on.</p>
          </div>
        </div>
        <Link
          to="/projects"
          className="shrink-0 text-[13px] font-medium text-brand-700 hover:text-brand-800"
        >
          All projects
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((project) => (
          <Link
            key={project.id}
            to={`/workspace/${project.id}`}
            className="group block overflow-hidden rounded-lg border border-line bg-canvas-soft/60 transition-colors hover:border-brand-300 hover:bg-brand-50/50"
          >
            <div className="aspect-[4/3] px-1.5 pt-2">
              <FloorPlanDiagram rooms={project.floors[0]?.rooms ?? []} units={project.plot.units} showLabels />
            </div>
            <div className="bg-surface px-2.5 py-2">
              <p className="truncate text-[12px] font-semibold text-ink-text">{project.name}</p>
              <p className="truncate text-[10.5px] text-muted">
                {project.floors[0]?.rooms.length ?? 0} rooms · {project.location || 'No location'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
