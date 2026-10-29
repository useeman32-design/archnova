import { useNavigate } from 'react-router-dom'
import { FolderPlus } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { WelcomeBanner, SectionHeading } from '@/components/dashboard/WelcomeBanner'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { HowItWorks } from '@/components/dashboard/HowItWorks'
import { PlanCard } from '@/components/dashboard/PlanCard'
import { QuickAccessStrip } from '@/components/dashboard/QuickAccessStrip'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'
import { relativeTime } from '@/lib/format'

export function HomePage() {
  const { projects, duplicateProject } = useProjects()
  const navigate = useNavigate()
  const recent = projects.slice(0, 6)
  const lastUpdated = projects[0] ? relativeTime(projects[0].updatedAt) : null

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-5 lg:p-8">
      <WelcomeBanner
        projectCount={projects.length}
        lastUpdated={lastUpdated}
        onStart={() => navigate('/projects/new')}
      />

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_352px]">
        <div className="min-w-0 space-y-7">
          {recent.length > 0 ? (
            <section>
              <SectionHeading title="Recent projects" subtitle="Pick up where you left off." />
              <div className="grid gap-4 sm:grid-cols-2">
                {recent.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDuplicate={(project) => void duplicateProject(project.id)}
                  />
                ))}
              </div>
            </section>
          ) : (
            <EmptyState
              icon={<FolderPlus className="h-5 w-5" />}
              title="No projects yet"
              description="Create your first project and ArchNova will draft a starting layout from your brief."
              action={
                <Button variant="primary" icon={<FolderPlus className="h-4 w-4" />} onClick={() => navigate('/projects/new')}>
                  Start your first project
                </Button>
              }
            />
          )}

          {projects.length > 0 ? <QuickAccessStrip projects={projects} /> : null}

          <HowItWorks />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <PlanCard />
        </aside>
      </div>
    </div>
  )
}
