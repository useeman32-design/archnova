import { AssetsView } from '@/components/assets/AssetsView'
import { useWorkspace } from './WorkspaceLayout'

export function WorkspaceAssetsPage() {
  const { project } = useWorkspace()
  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-thin p-4 sm:p-5">
      <div className="mb-4">
        <h1 className="text-[17px] font-semibold text-ink-text">Asset library</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          Browse objects, materials, interior items and trees for {project.name}.
        </p>
      </div>
      <AssetsView />
    </div>
  )
}
