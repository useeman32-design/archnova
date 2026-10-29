import { useState } from 'react'
import { Compass, Crosshair, Frame, Info, Tag } from 'lucide-react'
import type { Room } from '@/types'
import { useWorkspace } from '@/pages/workspace/WorkspaceLayout'
import { FloorPlanDiagram } from '@/components/floor-plan/FloorPlanDiagram'
import { PlanCanvas, ZoomControls, useZoom } from '@/components/floor-plan/PlanCanvas'
import { SegmentedControl } from '@/components/ui/FormControls'
import { ROOM_OPTIONS } from '@/data/catalog'

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

const TOOL_HINTS: Record<string, string> = {
  select: 'Select a room to edit it in Properties. Detail levels adapt to zoom, like a CAD viewport.',
  pan: 'Pan: drag the canvas to move around.',
  room: 'Add room: click anywhere on the plan to place the room.',
  door: 'Door tool: click a room to add a door opening.',
  window: 'Window tool: click a room to add a window.',
  interior: 'Interior tool: click a room to place the selected item.',
  trees: 'Trees: click the plan to plant.',
  measure: 'Measure: click two points to read a distance · click again to start over.',
}

/**
 * The 2D design canvas: grid, zoom, measure, placement tools, level-of-detail
 * toggles and room selection. Embedded as the "2D" tab of the workspace canvas.
 */
export function PlanEditor() {
  const ctx = useWorkspace()
  const { project, rooms, units, setUnits, selectedRoomId, selectedRoom } = ctx
  const [zoom, setZoom] = useZoom()
  const [showLabels, setShowLabels] = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)
  const [showAreas, setShowAreas] = useState(true)
  const [showCompass, setShowCompass] = useState(true)

  const measure = ctx.tool === 'measure'

  const handleRoomClick = (room: Room) => {
    switch (ctx.tool) {
      case 'door':
        ctx.addOpening(room.id, 'door')
        return
      case 'window':
        ctx.addOpening(room.id, 'window')
        return
      case 'interior':
        if (ctx.pendingInterior) {
          ctx.placeInterior(room.id, ctx.pendingInterior)
          return
        }
        break
      default:
        break
    }
    ctx.selectRoom(room.id === selectedRoomId ? null : room.id)
  }

  const handleCanvasClick = (point: { x: number; y: number }) => {
    if (ctx.tool === 'room' && ctx.pendingRoom) {
      ctx.addRoomAt(point, ctx.pendingRoom)
      return
    }
    if (ctx.tool === 'trees') {
      ctx.addTreeAt(point)
    }
  }

  const pendingLabel =
    ctx.tool === 'room' && ctx.pendingRoom
      ? ROOM_OPTIONS.find((r) => r.value === ctx.pendingRoom)?.label
      : ctx.tool === 'interior'
        ? ctx.pendingInterior
        : null

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
          onClick={() => ctx.setTool(measure ? 'select' : 'measure')}
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

      <PlanCanvas zoom={zoom} pan={ctx.tool === 'pan'} className="min-h-0 flex-1">
        <FloorPlanDiagram
          rooms={rooms}
          units={units}
          showLabels={showLabels}
          showDimensions={showDimensions}
          showAreas={showAreas}
          showCompass={showCompass}
          showBoundary
          measure={measure}
          trees={ctx.ornaments}
          onCanvasClick={handleCanvasClick}
          selectedId={selectedRoomId}
          onSelectRoom={handleRoomClick}
          className="min-h-0 min-w-0 drop-shadow-sm"
        />
      </PlanCanvas>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3 py-2">
        <p className="text-[11.5px] text-muted">
          {pendingLabel ? (
            <span className="font-medium text-brand-700">
              Placing: {pendingLabel} — click the plan{ctx.tool === 'interior' ? ' on a room' : ''} to
              add it.{' '}
              <button
                className="underline underline-offset-2"
                onClick={() => {
                  ctx.setPendingRoom(null)
                  ctx.setPendingInterior(null)
                  ctx.setTool('select')
                }}
              >
                Cancel
              </button>
            </span>
          ) : (
            TOOL_HINTS[ctx.tool] ?? TOOL_HINTS.select
          )}
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
