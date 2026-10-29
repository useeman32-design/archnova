import { useRef, useState } from 'react'
import { Compass, Crosshair, Frame, Info, Tag } from 'lucide-react'
import type { Room, Vec2 } from '@/types'
import { useWorkspace } from '@/pages/workspace/WorkspaceLayout'
import { FloorPlanDiagram } from '@/components/floor-plan/FloorPlanDiagram'
import { PlanCanvas, ZoomControls, useZoom } from '@/components/floor-plan/PlanCanvas'
import { SegmentedControl } from '@/components/ui/FormControls'
import type { PendingPlacement } from '@/data/toolLibrary'

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
  select: 'Select tool: click a room to edit, drag it to move, pull the blue handle to resize. Ctrl+Z undo · Ctrl+Shift+Z redo.',
  pan: 'Pan: drag the canvas to move around.',
  measure: 'Measure: click two points to read a distance · click again to start over.',
}

/**
 * The 2D design canvas (Floor Plan view): grid, zoom, measure, library
 * placement (click or drag & drop), direct move/resize and selection.
 */
export function PlanEditor() {
  const ctx = useWorkspace()
  const { project, rooms, units, setUnits, selectedRoomId, selectedRoom } = ctx
  const [zoom, setZoom] = useZoom()
  const [showLabels, setShowLabels] = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)
  const [showAreas, setShowAreas] = useState(true)
  const [showCompass, setShowCompass] = useState(true)
  const clientToPlan = useRef<((x: number, y: number) => Vec2 | null) | null>(null)

  const measure = ctx.tool === 'measure'

  const roomAt = (point: Vec2): Room | null =>
    [...rooms]
      .reverse()
      .find(
        (room) =>
          point.x >= room.rect.x &&
          point.x <= room.rect.x + room.rect.w &&
          point.y >= room.rect.y &&
          point.y <= room.rect.y + room.rect.h,
      ) ?? null

  const applyPlacement = (placement: PendingPlacement, point: Vec2) => {
    const { tool, variant } = placement
    if (tool === 'room') {
      ctx.addRoomAt(point, variant)
      return
    }
    if (tool === 'trees') {
      ctx.addTreeAt(point, variant.kind)
      return
    }
    const room = roomAt(point)
    if (!room) return
    if (tool === 'door') ctx.addOpening(room.id, 'door', variant.label)
    if (tool === 'window') ctx.addOpening(room.id, 'window', variant.label)
    if (tool === 'interior' && variant.item) ctx.placeInterior(room.id, variant.item)
  }

  const handleRoomClick = (room: Room) => {
    if (ctx.pending) {
      const { tool, variant } = ctx.pending
      if (tool === 'door') return ctx.addOpening(room.id, 'door', variant.label)
      if (tool === 'window') return ctx.addOpening(room.id, 'window', variant.label)
      if (tool === 'interior' && variant.item) return ctx.placeInterior(room.id, variant.item)
    }
    ctx.selectRoom(room.id === selectedRoomId ? null : room.id)
  }

  const handleCanvasClick = (point: Vec2) => {
    if (ctx.pending) applyPlacement(ctx.pending, point)
  }

  const handleDrop = (event: React.DragEvent) => {
    const raw = event.dataTransfer.getData('application/x-archnova')
    if (!raw) return
    event.preventDefault()
    const point = clientToPlan.current?.(event.clientX, event.clientY)
    if (!point) return
    try {
      applyPlacement(JSON.parse(raw) as PendingPlacement, point)
    } catch {
      /* ignore malformed payloads */
    }
  }

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

      <div
        className="min-h-0 flex-1"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('application/x-archnova')) {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }
        }}
        onDrop={handleDrop}
      >
        <PlanCanvas zoom={zoom} pan={ctx.tool === 'pan'} className="h-full">
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
            dragEnabled={ctx.tool === 'select'}
            onEditBegin={ctx.beginEdit}
            onEditEnd={ctx.endEdit}
            onDragLive={(id, x, y) =>
              ctx.liveEdit((state) => ({
                ...state,
                rooms: state.rooms.map((room) =>
                  room.id === id ? { ...room, rect: { ...room.rect, x, y } } : room,
                ),
              }))
            }
            onResizeLive={(id, w, h) =>
              ctx.liveEdit((state) => ({
                ...state,
                rooms: state.rooms.map((room) =>
                  room.id === id
                    ? { ...room, width: w, length: h, rect: { ...room.rect, w, h } }
                    : room,
                ),
              }))
            }
            registerClientToPlan={(fn) => {
              clientToPlan.current = fn
            }}
            className="min-h-0 min-w-0 drop-shadow-sm"
          />
        </PlanCanvas>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3 py-2">
        <p className="text-[11.5px] text-muted">
          {ctx.pending ? (
            <span className="font-medium text-brand-700">
              Placing: {ctx.pending.variant.name} — click the plan
              {ctx.pending.tool === 'door' || ctx.pending.tool === 'window' || ctx.pending.tool === 'interior'
                ? ' on a room'
                : ''}
              , or drag a library tile.{' '}
              <button className="underline underline-offset-2" onClick={() => ctx.setPending(null)}>
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
