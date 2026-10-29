import { useState } from 'react'
import { Compass, Crosshair, Frame, Info, Tag } from 'lucide-react'
import { useWorkspace } from '@/pages/workspace/WorkspaceLayout'
import { FloorPlanDiagram } from '@/components/floor-plan/FloorPlanDiagram'
import { PlanCanvas, ZoomControls, useZoom } from '@/components/floor-plan/PlanCanvas'
import { SegmentedControl } from '@/components/ui/FormControls'

function IconToggle({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors ${
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-line bg-surface text-muted hover:bg-canvas-soft'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

/**
 * The 2D design canvas: grid, zoom, measure, level-of-detail toggles and
 * room selection. Embedded as the "2D" tab of the workspace canvas.
 */
export function PlanEditor() {
  const { project, rooms, units, setUnits, selectedRoomId, selectRoom, selectedRoom } = useWorkspace()
  const [zoom, setZoom] = useZoom()
  const [showLabels, setShowLabels] = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)
  const [showAreas, setShowAreas] = useState(true)
  const [showCompass, setShowCompass] = useState(true)
  const [measure, setMeasure] = useState(false)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
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
        <IconToggle
          active={measure}
          onClick={() => setMeasure((v) => !v)}
          label="Measure"
          icon={<Crosshair className="h-3.5 w-3.5" />}
        />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <IconToggle active={showLabels} onClick={() => setShowLabels((v) => !v)} label="Labels" icon={<Tag className="h-3.5 w-3.5" />} />
          <IconToggle active={showDimensions} onClick={() => setShowDimensions((v) => !v)} label="Dims" icon={<Frame className="h-3.5 w-3.5" />} />
          <IconToggle active={showAreas} onClick={() => setShowAreas((v) => !v)} label="Areas" icon={<Info className="h-3.5 w-3.5" />} />
          <IconToggle active={showCompass} onClick={() => setShowCompass((v) => !v)} label="North" icon={<Compass className="h-3.5 w-3.5" />} />
        </div>
      </div>

      <PlanCanvas zoom={zoom} className="min-h-0 flex-1">
        <FloorPlanDiagram
          rooms={rooms}
          units={units}
          showLabels={showLabels}
          showDimensions={showDimensions}
          showAreas={showAreas}
          showCompass={showCompass}
          showBoundary
          measure={measure}
          selectedId={selectedRoomId}
          onSelectRoom={(room) => selectRoom(room.id === selectedRoomId ? null : room.id)}
          className="min-h-0 min-w-0 drop-shadow-sm"
        />
      </PlanCanvas>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3 py-2">
        <p className="text-[11.5px] text-muted">
          {measure
            ? 'Measure: click two points to read a distance · click again to start over.'
            : 'Select a room to edit it in Properties. Detail levels adapt to zoom, like a CAD viewport.'}
        </p>
        <p className="text-[11.5px] font-medium text-ink-text">
          {selectedRoom
            ? `${selectedRoom.name} · ${selectedRoom.width} × ${selectedRoom.length} ${units}`
            : `${rooms.length} spaces · ${project.name}`}
        </p>
      </div>
    </div>
  )
}
