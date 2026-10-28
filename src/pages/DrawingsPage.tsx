import { useState } from 'react'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { DrawingsView } from '@/components/drawings/DrawingsView'
import { SelectField } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/Feedback'
import { useProjects } from '@/hooks/useProjects'
import { DraftingCompass } from 'lucide-react'
import { Link } from 'react-router-dom'

export function DrawingsPage() {
  const { projects, loading } = useProjects()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const project = projects.find((p) => p.id === selectedId) ?? projects[0]

  return (
    <AppShell>
      <PageHeader
        title="Drawings & exports"
        subtitle="Floor plans, elevations, sections, roof plans and project reports."
      />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {loading ? (
          <p className="text-[13px] text-muted">Loading projects…</p>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<DraftingCompass className="h-5 w-5" />}
            title="No projects yet"
            description="Create a project to see its drawing set."
            action={
              <Link to="/projects/new" className="text-[13px] font-medium text-brand-700 hover:underline">
                Start a new project
              </Link>
            }
          />
        ) : (
          <>
            <div className="mb-5 max-w-xs">
              <SelectField
                label="Project"
                value={project?.id}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.location || 'no location'}
                  </option>
                ))}
              </SelectField>
            </div>
            {project ? <DrawingsView project={project} /> : null}
          </>
        )}
      </div>
    </AppShell>
  )
}
