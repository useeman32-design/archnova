import { Link } from 'react-router-dom'
import { ArrowUpRight, Box, Ruler } from 'lucide-react'
import { useWorkspace } from './WorkspaceLayout'
import { PlanEditor } from '@/components/editor/PlanEditor'
import { MassingViewerSafe } from '@/components/3d-viewer/MassingViewer'
import { SegmentedControl } from '@/components/ui/FormControls'
import { formatArea } from '@/lib/format'

/**
 * Screen C — the design canvas. One surface at a time, switched with the
 * 2D / 3D tab (also mirrored in the top toolbar), so the workspace never
 * stacks both previews or overflows the viewport.
 */
export function WorkspaceOverview() {
  const { project, canvasView, setCanvasView } = useWorkspace()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <SegmentedControl<'2D' | '3D'>
          options={[
            { value: '2D', label: '2D Plan', icon: <Ruler className="h-3.5 w-3.5" /> },
            { value: '3D', label: '3D Preview', icon: <Box className="h-3.5 w-3.5" /> },
          ]}
          value={canvasView}
          onChange={setCanvasView}
        />
        <div className="ml-auto flex items-center gap-2">
          {canvasView === '3D' ? (
            <Link
              to="../3d"
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-brand-700 hover:bg-brand-50"
            >
              Immersive 3D & materials
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {canvasView === '2D' ? (
          <PlanEditor />
        ) : (
          <MassingViewerSafe project={project} className="h-full w-full" />
        )}
      </div>

      {canvasView === '3D' ? (
        <div className="border-t border-line bg-surface px-3 py-2">
          <p className="text-[11.5px] text-muted">
            Massing model built from room volumes on the {formatArea(project.plot.width, project.plot.length, project.plot.units)} plot —
            materials and object libraries arrive with the 3D model service.
          </p>
        </div>
      ) : null}
    </div>
  )
}
