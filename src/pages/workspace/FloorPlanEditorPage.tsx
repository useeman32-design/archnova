import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Frame, Info, Minimize, Tag } from 'lucide-react'
import { useWorkspace } from './WorkspaceLayout'
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

export function FloorPlanEditorPage() {
  const { project, rooms, units, setUnits, selectedRoomId, selectRoom, selectedRoom } = useWorkspace()
  const [zoom, setZoom] = useZoom()
  const [showLabels, setShowLabels] = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)
  const [showAreas, setShowAreas] = useState(false)
  const [showCompass, setShowCompass] = useState(true)

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
        <Link
          to=""
          title="Back to the split 2D + 3D view"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12px] font-medium text-muted shadow-sm transition-colors hover:bg-canvas-soft hover:text-ink-text"
        >
          <Minimize className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Split view</span>
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <IconToggle active={showLabels} onClick={() => setShowLabels(v => !v)} label="Labels" icon={<Tag className="h-3.5 w-3.5" />} />
          <IconToggle active={showDimensions} onClick={() => setShowDimensions(v => !v)} label="Dims" icon={<Frame className="h-3.5 w-3.5" />} />
          <IconToggle active={showAreas} onClick={() => setShowAreas(v => !v)} label="Areas" icon={<Info className="h-3.5 w-3.5" />} />
          <IconToggle active={showCompass} onClick={() => setShowCompass(v => !v)} label="North" icon={<Compass className="h-3.5 w-3.5" />} />
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
          selectedId={selectedRoomId}
          onSelectRoom={(room) => selectRoom(room.id === selectedRoomId ? null : room.id)}
          className="min-h-0 min-w-0 drop-shadow-sm"
        />
      </PlanCanvas>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3 py-2">
        <p className="text-[11.5px] text-muted">
          Demonstration editor — rooms can be selected and resized for preview only. Geometrically
          accurate editing arrives with the geometry engine.
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
