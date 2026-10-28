import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban, Plus, Search } from 'lucide-react'
import type { ProjectStatus } from '@/types'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { EmptyState } from '@/components/ui/Feedback'
import { SelectField } from '@/components/ui/Field'
import { buttonClasses } from '@/components/ui/Button'
import { useProjects } from '@/hooks/useProjects'
import { projectStatusLabel } from '@/lib/format'

const STATUS_FILTERS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: projectStatusLabel('draft') },
  { value: 'in-progress', label: projectStatusLabel('in-progress') },
  { value: 'review', label: projectStatusLabel('review') },
  { value: 'completed', label: projectStatusLabel('completed') },
]

export function ProjectsPage() {
  const { projects, loading, duplicateProject } = useProjects()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((project) => {
      const matchesQuery =
        !q ||
        project.name.toLowerCase().includes(q) ||
        project.location.toLowerCase().includes(q)
      const matchesStatus = status === 'all' || project.status === status
      return matchesQuery && matchesStatus
    })
  }, [projects, query, status])

  return (
    <AppShell>
      <PageHeader
        title="My Projects"
        subtitle="Every design you have started, newest first."
        actions={
          <Link to="/projects/new" className={buttonClasses('primary', 'md')}>
            <Plus className="h-4 w-4" />
            New project
          </Link>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or location…"
              className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink-text placeholder:text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              aria-label="Search projects"
            />
          </div>
          <div className="w-full sm:w-52">
            <SelectField
              label={<span className="sr-only">Status filter</span>}
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectStatus | 'all')}
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl border border-line bg-canvas-soft" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-5 w-5" />}
            title={projects.length === 0 ? 'No projects yet' : 'No matches'}
            description={
              projects.length === 0
                ? 'Start your first design with the guided questionnaire.'
                : 'Try a different search term or clear the status filter.'
            }
            action={
              projects.length === 0 ? (
                <Link to="/projects/new" className={buttonClasses('primary', 'md')}>
                  <Plus className="h-4 w-4" />
                  Start new project
                </Link>
              ) : (
                <button
                  onClick={() => {
                    setQuery('')
                    setStatus('all')
                  }}
                  className="text-[13px] font-medium text-brand-700 hover:underline"
                >
                  Clear filters
                </button>
              )
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDuplicate={(project) => void duplicateProject(project.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
