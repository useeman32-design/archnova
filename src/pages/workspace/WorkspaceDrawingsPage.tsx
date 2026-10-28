import { useWorkspace } from './WorkspaceLayout'
import { DrawingsView } from '@/components/drawings/DrawingsView'

export function WorkspaceDrawingsPage() {
  const { project } = useWorkspace()
  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-thin p-4 sm:p-5">
      <div className="mb-4">
        <h1 className="text-[17px] font-semibold text-ink-text">Drawings & exports</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          The drawing set for {project.name}. Everything here is a preview until the export service
          is connected.
        </p>
      </div>
      <DrawingsView project={project} />
    </div>
  )
}
