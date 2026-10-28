import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Box, Expand, Ruler } from 'lucide-react'
import { useWorkspace } from './WorkspaceLayout'
import { FloorPlanDiagram } from '@/components/floor-plan/FloorPlanDiagram'
import { PlanCanvas, ZoomControls, useZoom } from '@/components/floor-plan/PlanCanvas'
import { MassingViewerSafe } from '@/components/3d-viewer/MassingViewer'
import { SegmentedControl } from '@/components/ui/FormControls'
import { Toggle } from '@/components/ui/FormControls'
import { formatDimensions, formatArea } from '@/lib/format'

export function WorkspaceOverview() {
  const { project, rooms, units, setUnits, selectedRoomId, selectRoom } = useWorkspace()
  const [zoom, setZoom] = useZoom()
  const [pane, setPane] = useState<'2D' | '3D'>('3D')
  const [showDimensions, setShowDimensions] = useState(true)

  const footprint = rooms
    .filter((room) => room.category !== 'garden' && room.category !== 'pool')
    .reduce((sum, room) => sum + room.width * room.length, 0)

  return (
    <div className="grid h-full min-h-0 grid-rows-2 xl:grid-cols-2 xl:grid-rows-1">
      {/* 2D pane */}
      <section className="flex min-h-0 flex-col border-b border-line xl:border-b-0 xl:border-r">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-text">
            <Ruler className="h-3.5 w-3.5 text-brand-600" />
            2D Floor Plan
          </span>
          <span className="text-[11.5px] text-faint">· ground floor</span>
          <div className="ml-auto flex items-center gap-2">
            <SegmentedControl<'ft' | 'm'>
              size="sm"
              options={[
                { value: 'ft', label: 'ft' },
                { value: 'm', label: 'm' },
              ]}
              value={units}
              onChange={setUnits}
            />
            <ZoomControls zoom={zoom} setZoom={setZoom} />
            <Link
              to="../floor-plan"
              title="Open the focused floor-plan editor"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12px] font-medium text-muted shadow-sm transition-colors hover:bg-canvas-soft hover:text-ink-text"
            >
              <Expand className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Focus</span>
            </Link>
          </div>
        </div>

        <PlanCanvas zoom={zoom} className="min-h-0 flex-1">
          <FloorPlanDiagram
            rooms={rooms}
            units={units}
            showDimensions={showDimensions}
            showAreas
            showCompass
            selectedId={selectedRoomId}
            onSelectRoom={(room) => selectRoom(room.id === selectedRoomId ? null : room.id)}
            className="min-h-0 min-w-0"
          />
        </PlanCanvas>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-3 py-2">
          <Toggle
            checked={showDimensions}
            onChange={setShowDimensions}
            label={<span className="text-[12px]">Dimensions</span>}
          />
          <div className="flex items-center gap-3 text-[11.5px] text-muted">
            <span>Plot {formatDimensions(project.plot.width, project.plot.length, units)}</span>
            <span className="hidden sm:inline">
              Footprint ≈ {Math.round(footprint).toLocaleString('en-US')} {units === 'ft' ? 'sq ft' : 'sq m'}
            </span>
          </div>
        </div>
      </section>

      {/* 3D pane */}
      <section className="relative flex min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-text">
            <Box className="h-3.5 w-3.5 text-brand-600" />
            Preview
          </span>
          <div className="ml-auto flex items-center gap-2">
            <SegmentedControl<'2D' | '3D'>
              size="sm"
              options={[
                { value: '2D', label: '2D' },
                { value: '3D', label: '3D' },
              ]}
              value={pane}
              onChange={setPane}
            />
            <Link
              to="3d"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-brand-700 hover:bg-brand-50"
            >
              Full view
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {pane === '3D' ? (
            <MassingViewerSafe project={project} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center bg-canvas-soft/70 p-6">
              <FloorPlanDiagram
                rooms={rooms}
                units={units}
                showBoundary
                showCompass
                className="min-h-0 min-w-0"
              />
            </div>
          )}
        </div>

        <div className="border-t border-line bg-surface px-3 py-2">
          <p className="text-[11.5px] text-muted">
            {pane === '3D'
              ? 'Massing model built from room volumes — materials and detail arrive with the 3D model service.'
              : `Site outline · ${formatArea(project.plot.width, project.plot.length, units)} plot in ${project.location || 'your location'}.`}
          </p>
        </div>
      </section>
    </div>
  )
}
