import { useLayoutEffect, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { PlacedItem, Room, RoomCategory, Units, Vec2 } from '@/types'
import { formatArea } from '@/lib/format'
import { roomArea } from '@/lib/floorPlan'
import { canonicalFurnitureKey, getFurnitureDimensions } from '@/lib/furniture'
import { getFloorArchitecturalModel, pointAlongWall, wallLength, type WallThicknessSettings } from '@/lib/architecturalModel'

/**
 * CAD-style 2D plan renderer.
 *
 * Line weights, text sizes, dashes and annotation graphics are expressed in
 * *screen pixels* (divided by the measured px-per-unit scale), so the drawing
 * stays balanced and legible at every zoom level instead of collapsing into
 * itself. Detail levels switch on rendered room size (level-of-detail), the
 * way real CAD viewports do.
 */

const ROOM_COLORS: Record<RoomCategory, { fill: string; stroke: string; text: string }> = {
  bedroom: { fill: '#e9eef9', stroke: '#c6d4f2', text: '#33446b' },
  bathroom: { fill: '#e4f3f0', stroke: '#b2d9ce', text: '#2c5f58' },
  kitchen: { fill: '#fdf2e4', stroke: '#f0d3ae', text: '#7a5518' },
  living: { fill: '#eef2f8', stroke: '#d3dde9', text: '#3d4a5e' },
  dining: { fill: '#f2eef9', stroke: '#dcd0ee', text: '#523a78' },
  study: { fill: '#eef1f8', stroke: '#d2d9ee', text: '#3f4a6b' },
  garage: { fill: '#f1f2f4', stroke: '#dcdfe5', text: '#4a5058' },
  storage: { fill: '#f3f0f2', stroke: '#e0dbde', text: '#55505a' },
  porch: { fill: '#f6f3ee', stroke: '#e3ded2', text: '#5c5346' },
  balcony: { fill: '#f2f5f9', stroke: '#dbe2ec', text: '#455165' },
  laundry: { fill: '#edf6f4', stroke: '#cbe3dd', text: '#2f5f57' },
  garden: { fill: '#ebf4e6', stroke: '#c8dfc0', text: '#41602f' },
  pool: { fill: '#e2f1fb', stroke: '#b4d8ee', text: '#2c5f80' },
  circulation: { fill: '#f7f8fa', stroke: '#e6e9ee', text: '#666e7a' },
  other: { fill: '#f4f5f7', stroke: '#e4e6ea', text: '#555b63' },
}

const LABEL_PX = 12
const SMALL_PX = 10

export interface FloorPlanDiagramProps {
  rooms: Room[]
  units: Units
  wallThicknesses?: WallThicknessSettings
  /** Plot extents keep an empty, start-from-scratch project drawable. */
  plot?: { width: number; length: number }
  className?: string
  showLabels?: boolean
  showDimensions?: boolean
  selectedId?: string | null
  onSelectRoom?: (room: Room, point?: Vec2) => void
  showBoundary?: boolean
  showCompass?: boolean
  showAreas?: boolean
  /** Measure mode: click two points to read a distance; click again to restart. */
  measure?: boolean
  /** Receives background clicks in plan units (used by placement tools). */
  onCanvasClick?: (point: Vec2) => void
  /** Individually selectable, moveable and scalable landscape/site objects. */
  trees?: (Vec2 & { id: string; kind?: string; scale: number; rotation: number; color: string; width?: number; length?: number })[]
  selectedTreeId?: string | null
  onSelectTree?: (id: string | null) => void
  onMoveTree?: (id: string, x: number, y: number) => void
  onResizeTree?: (id: string, scale: number) => void
  placed?: Record<string, PlacedItem[]>
  selectedItemId?: string | null
  onSelectItem?: (id: string | null) => void
  onMoveItem?: (roomId: string, itemId: string, x: number, z: number) => void
  onDoubleClickRoom?: (room: Room) => void
  /* Direct manipulation (select tool) */
  dragEnabled?: boolean
  onEditBegin?: () => void
  onEditEnd?: () => void
  onDragLive?: (id: string, x: number, y: number) => void
  onResizeLive?: (id: string, w: number, h: number) => void
  /** Exposes a client-pixels → plan-units converter (for drag & drop). */
  registerClientToPlan?: (fn: ((clientX: number, clientY: number) => Vec2 | null) | null) => void
}

export function FloorPlanDiagram({
  rooms,
  units,
  wallThicknesses,
  plot,
  className = '',
  showLabels = true,
  showDimensions = false,
  selectedId = null,
  onSelectRoom,
  showBoundary = true,
  showCompass = false,
  showAreas = false,
  measure = false,
  onCanvasClick,
  trees = [],
  selectedTreeId = null,
  onSelectTree,
  onMoveTree,
  onResizeTree,
  placed = {},
  selectedItemId = null,
  onSelectItem,
  onMoveItem,
  onDoubleClickRoom,
  dragEnabled = false,
  onEditBegin,
  onEditEnd,
  onDragLive,
  onResizeLive,
  registerClientToPlan,
}: FloorPlanDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [scale, setScale] = useState<number | null>(null)
  const [measurePts, setMeasurePts] = useState<Vec2[]>([])

  const hasRooms = rooms.length > 0
  const hasContent = hasRooms || Boolean(plot)
  const minX = plot ? 0 : hasRooms ? Math.min(...rooms.map((r) => r.rect.x)) : 0
  const minY = plot ? 0 : hasRooms ? Math.min(...rooms.map((r) => r.rect.y)) : 0
  const maxX = plot ? plot.width : hasRooms ? Math.max(...rooms.map((r) => r.rect.x + r.rect.w)) : 1
  const maxY = plot ? plot.length : hasRooms ? Math.max(...rooms.map((r) => r.rect.y + r.rect.h)) : 1
  const buildingMinX = hasRooms ? Math.min(...rooms.map((room) => room.rect.x)) : 0
  const buildingMinY = hasRooms ? Math.min(...rooms.map((room) => room.rect.y)) : 0
  const buildingMaxX = hasRooms ? Math.max(...rooms.map((room) => room.rect.x + room.rect.w)) : 0
  const buildingMaxY = hasRooms ? Math.max(...rooms.map((room) => room.rect.y + room.rect.h)) : 0

  const padX = 12
  const padY = 20
  const vbX = minX - padX
  const vbY = minY - padY
  const vbW = maxX - minX + padX * 2
  const vbH = maxY - minY + padY * 2

  useLayoutEffect(() => {
    if (!hasContent) return
    const svg = svgRef.current
    if (!svg) return
    const update = () => {
      const box = svg.getBoundingClientRect()
      if (box.width < 4 || box.height < 4) return
      setScale(Math.min(box.width / vbW, box.height / vbH))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [vbW, vbH, hasContent])

  /** Pixels per plan unit at the current render size (includes zoom). */
  const s = scale ?? 6
  /** Convert everything visual into screen-constant sizes. */
  const u = (px: number) => px / s

  const toPlanPoint = (event: ReactMouseEvent<SVGSVGElement>): Vec2 | null => {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse())
    return { x: pt.x, y: pt.y }
  }

  const clientToPlan = (clientX: number, clientY: number): Vec2 | null => {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
    return { x: pt.x, y: pt.y }
  }

  useEffect(() => {
    if (!registerClientToPlan) return
    registerClientToPlan(clientToPlan)
    return () => registerClientToPlan(null)
  }, [registerClientToPlan, scale]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- direct manipulation (move / resize) ---- */
  const drag = useRef<{
    mode: 'move' | 'resize'
    id: string
    startX: number
    startY: number
    orig: { x: number; y: number; w: number; h: number }
  } | null>(null)
  const treeDrag = useRef<{ mode: 'move' | 'resize'; id: string; startX: number; startY: number; x: number; y: number; scale: number } | null>(null)
  const itemDrag = useRef<{ roomId: string; item: PlacedItem } | null>(null)

  /* Early return AFTER every hook — changing hook order between renders
     crashes React ("Rendered more hooks than during the previous render"). */
  if (!hasContent) {
    return (
      <div className={`flex items-center justify-center text-[13px] text-muted ${className}`}>
        No rooms to display yet.
      </div>
    )
  }

  const startDrag = (
    event: ReactPointerEvent<SVGGElement>,
    room: Room,
    mode: 'move' | 'resize',
  ) => {
    if (!dragEnabled) return
    event.stopPropagation()
    drag.current = {
      mode,
      id: room.id,
      startX: event.clientX,
      startY: event.clientY,
      orig: { x: room.rect.x, y: room.rect.y, w: room.rect.w, h: room.rect.h },
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    onEditBegin?.()
  }

  const moveDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const state = drag.current
    if (!state) return
    const dx = (event.clientX - state.startX) / s
    const dy = (event.clientY - state.startY) / s
    if (state.mode === 'move') {
      onDragLive?.(state.id, round1(state.orig.x + dx), round1(state.orig.y + dy))
    } else {
      onResizeLive?.(
        state.id,
        Math.max(4, round1(state.orig.w + dx)),
        Math.max(4, round1(state.orig.h + dy)),
      )
    }
  }

  const endDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (!drag.current) return
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    onEditEnd?.()
  }

  const startTreeDrag = (event: ReactPointerEvent<SVGGElement>, tree: (Vec2 & { id: string; scale: number; rotation: number; color: string; kind?: string }), mode: 'move' | 'resize') => {
    event.stopPropagation()
    treeDrag.current = { mode, id: tree.id, startX: event.clientX, startY: event.clientY, x: tree.x, y: tree.y, scale: tree.scale }
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelectTree?.(tree.id)
    onEditBegin?.()
  }

  const moveTreeDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const state = treeDrag.current
    if (!state) return
    const dx = (event.clientX - state.startX) / s
    const dy = (event.clientY - state.startY) / s
    if (state.mode === 'move') onMoveTree?.(state.id, round1(state.x + dx), round1(state.y + dy))
    else onResizeTree?.(state.id, Math.max(0.35, Math.min(4, state.scale + dx / 10)))
  }

  const endTreeDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (!treeDrag.current) return
    treeDrag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    onEditEnd?.()
  }

  const startItemDrag = (event: ReactPointerEvent<SVGGElement>, room: Room, item: PlacedItem) => {
    event.stopPropagation()
    onSelectItem?.(item.id)
    if (!dragEnabled) return
    itemDrag.current = { roomId: room.id, item }
    event.currentTarget.setPointerCapture(event.pointerId)
    onEditBegin?.()
  }
  const moveItemDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const state = itemDrag.current
    if (!state) return
    const point = clientToPlan(event.clientX, event.clientY)
    const room = rooms.find((candidate) => candidate.id === state.roomId)
    if (!point || !room) return
    const x = Math.max(-0.48, Math.min(0.48, (point.x - room.rect.x - room.rect.w / 2) / room.rect.w))
    const z = Math.max(-0.48, Math.min(0.48, (point.y - room.rect.y - room.rect.h / 2) / room.rect.h))
    onMoveItem?.(state.roomId, state.item.id, Math.round(x * 1000) / 1000, Math.round(z * 1000) / 1000)
  }
  const endItemDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (!itemDrag.current) return
    itemDrag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    onEditEnd?.()
  }

  const handleBackgroundClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    const point = toPlanPoint(event)
    if (!point) return
    if (measure) {
      setMeasurePts((prev) => (prev.length >= 2 ? [point] : [...prev, point]))
      return
    }
    onCanvasClick?.(point)
  }

  const measureDistance =
    measurePts.length === 2
      ? Math.hypot(measurePts[1].x - measurePts[0].x, measurePts[1].y - measurePts[0].y)
      : null

  const scaleBar = pickScaleBar(s, units)
  const architecturalModel = useMemo(() => getFloorArchitecturalModel(rooms, undefined, undefined, wallThicknesses), [rooms, wallThicknesses])

  return (
    <svg
      ref={svgRef}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      className={`h-full w-full ${className}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Floor plan diagram"
      onClick={handleBackgroundClick}
      style={{ cursor: measure ? 'crosshair' : undefined }}
    >
      {showBoundary ? (
        <rect
          x={plot ? 0 : minX - 2}
          y={plot ? 0 : minY - 2}
          width={plot ? plot.width : maxX - minX + 4}
          height={plot ? plot.length : maxY - minY + 4}
          fill="none"
          stroke="#9aa7b8"
          strokeWidth={u(1)}
          strokeDasharray={`${u(6)} ${u(5)}`}
          opacity="0.7"
        />
      ) : null}

      {!hasRooms ? (
        <g pointerEvents="none">
          <text x={maxX / 2} y={maxY / 2 - u(2)} textAnchor="middle" fontSize={u(13)} fontWeight={600} fill="#617083">
            Empty plot · {fmt(maxX)} × {fmt(maxY)} {units}
          </text>
          <text x={maxX / 2} y={maxY / 2 + u(2)} textAnchor="middle" fontSize={u(9)} fill="#8792a2">
            Choose Rooms from the left tool palette to begin
          </text>
        </g>
      ) : null}

      {/* Overall dimension lines (top + left), shown once there is room */}
      {showDimensions && s > 2.2 ? (
        <g stroke="#8792a2" strokeWidth={u(1)} fill="#5b6572">
          <DimensionLine
            x1={minX}
            y1={minY - 5}
            x2={maxX}
            y2={minY - 5}
            label={`${plot ? 'Plot ' : 'Overall '}${fmt(maxX - minX)} ${units}`}
            u={u}
            vertical={false}
          />
          <DimensionLine
            x1={minX - 5}
            y1={minY}
            x2={minX - 5}
            y2={maxY}
            label={`${plot ? 'Plot ' : 'Overall '}${fmt(maxY - minY)} ${units}`}
            u={u}
            vertical
          />
        </g>
      ) : null}
      {showDimensions && plot && hasRooms ? (
        <g stroke="#64748b" strokeWidth={u(0.8)} fill="#475569" strokeDasharray={`${u(2)} ${u(2)}`}>
          <DimensionLine
            x1={buildingMinX}
            y1={buildingMaxY + u(16)}
            x2={buildingMaxX}
            y2={buildingMaxY + u(16)}
            label={`Building ${fmt(buildingMaxX - buildingMinX)} ${units}`}
            u={u}
            vertical={false}
          />
          <DimensionLine
            x1={buildingMaxX + u(16)}
            y1={buildingMinY}
            x2={buildingMaxX + u(16)}
            y2={buildingMaxY}
            label={`Building ${fmt(buildingMaxY - buildingMinY)} ${units}`}
            u={u}
            vertical
          />
        </g>
      ) : null}

      {rooms.map((room) => {
        const palette = ROOM_COLORS[room.category] ?? ROOM_COLORS.other
        const isSelected = selectedId === room.id
        const rw = room.rect.w * s
        const rh = room.rect.h * s
        const showLabel = showLabels && rw >= 46 && rh >= 15
        const showArea = showAreas && rw >= 88 && rh >= 34
        const showRoomDim = showDimensions && rw >= 120 && rh >= 52
        const maxChars = Math.max(4, Math.floor(rw / (LABEL_PX * 0.62)))
        const nameLines = wrapLabel(room.name, maxChars, Math.max(1, Math.min(3, Math.floor(rh / (LABEL_PX * 1.5)))))

        return (
          <g
            key={room.id}
            className={onSelectRoom && !measure ? 'room-hit cursor-pointer' : undefined}
            style={dragEnabled ? { cursor: 'move' } : undefined}
            onClick={
              onSelectRoom && !measure
                ? (event) => {
                    event.stopPropagation()
                    onSelectRoom(room, clientToPlan(event.clientX, event.clientY) ?? undefined)
                  }
                : undefined
            }
            onDoubleClick={onDoubleClickRoom ? (event) => { event.stopPropagation(); onDoubleClickRoom(room) } : undefined}
            onPointerDown={dragEnabled ? (event) => startDrag(event, room, 'move') : undefined}
            onPointerMove={dragEnabled ? moveDrag : undefined}
            onPointerUp={dragEnabled ? endDrag : undefined}
            onPointerCancel={dragEnabled ? endDrag : undefined}
            role={onSelectRoom && !measure ? 'button' : undefined}
            aria-label={onSelectRoom ? `Select ${room.name}` : undefined}
          >
            <title>{`${room.name} — ${formatArea(roomArea(room), 1, units)}`}</title>
            {room.outline && room.shape !== 'rectangle' ? (
              <polygon
                points={room.outline.map((point) => `${room.rect.x + point.x * room.rect.w},${room.rect.y + point.y * room.rect.h}`).join(' ')}
                fill={palette.fill}
                stroke={isSelected ? '#1a56f5' : palette.stroke}
                strokeWidth={isSelected ? u(2.2) : u(1.25)}
                strokeLinejoin="round"
                opacity={selectedId && !isSelected ? 0.6 : 1}
              />
            ) : (
              <rect
                x={room.rect.x}
                y={room.rect.y}
                width={room.rect.w}
                height={room.rect.h}
                rx={u(2)}
                fill={palette.fill}
                stroke={isSelected ? '#1a56f5' : palette.stroke}
                strokeWidth={isSelected ? u(2.2) : u(1.25)}
                opacity={selectedId && !isSelected ? 0.6 : 1}
              />
            )}
            {showLabel ? (
              <text
                x={room.rect.x + room.rect.w / 2}
                y={room.rect.y + room.rect.h / 2 - (nameLines.length - 1) * u(LABEL_PX * 0.55) - (showArea ? u(3) : -u(4))}
                textAnchor="middle"
                fontSize={u(LABEL_PX)}
                fontWeight={600}
                fill={isSelected ? '#1a56f5' : palette.text}
              >
                {nameLines.map((line, index) => <tspan key={`${room.id}-line-${index}`} x={room.rect.x + room.rect.w / 2} dy={index === 0 ? 0 : u(LABEL_PX * 1.1)}>{line}</tspan>)}
              </text>
            ) : null}
            {showArea ? (
              <text
                x={room.rect.x + room.rect.w / 2}
                y={room.rect.y + room.rect.h / 2 + u(LABEL_PX)}
                textAnchor="middle"
                fontSize={u(SMALL_PX)}
                fill={isSelected ? '#1a56f5' : palette.text}
                opacity="0.8"
              >
                {formatArea(roomArea(room), 1, units)}
              </text>
            ) : null}
            {showRoomDim ? (
              <text
                x={room.rect.x + room.rect.w / 2}
                y={room.rect.y + room.rect.h - u(6)}
                textAnchor="middle"
                fontSize={u(SMALL_PX - 1)}
                fill="#7c8794"
              >
                {fmt(room.rect.w)} × {fmt(room.rect.h)} {units}
              </text>
            ) : null}
            {(rw >= 42 && rh >= 32) || selectedItemId && (placed[room.id] ?? room.items ?? []).some((item) => item.id === selectedItemId) ? <RoomFurniture room={{ ...room, items: placed[room.id] ?? room.items }} u={u} color={palette.text} selectedItemId={selectedItemId} dragEnabled={dragEnabled} onSelectItem={onSelectItem} onItemPointerDown={startItemDrag} onItemPointerMove={moveItemDrag} onItemPointerUp={endItemDrag} /> : null}
            {isSelected && dragEnabled ? (
              <circle
                cx={room.rect.x + room.rect.w}
                cy={room.rect.y + room.rect.h}
                r={u(5)}
                fill="#1a56f5"
                stroke="#ffffff"
                strokeWidth={u(1.5)}
                style={{ cursor: 'nwse-resize' }}
                onPointerDown={(event) => startDrag(event, room, 'resize')}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <title>Drag to resize</title>
              </circle>
            ) : null}
          </g>
        )
      })}

      {/* Walls and openings are drawn from the shared floor geometry, not baked into room fills. */}
      <g pointerEvents="none">
        {architecturalModel.walls.map((wall) => {
          const dx = wall.end.x - wall.start.x
          const dy = wall.end.y - wall.start.y
          const length = wallLength(wall) || 1
          const ux = dx / length
          const uy = dy / length
          const nx = -uy
          const ny = ux
          const wallOpenings = architecturalModel.openings.filter((opening) => opening.wallId === wall.id)
          return (
            <g key={wall.id}>
              <line x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y}
                stroke={wall.kind === 'exterior' ? '#344253' : '#657286'}
                strokeWidth={wall.thickness} strokeLinecap="square" />
              {wallOpenings.map((opening) => {
                const from = pointAlongWall(wall, opening.offset)
                const to = pointAlongWall(wall, opening.offset + opening.width)
                const mx = (from.x + to.x) / 2
                const my = (from.y + to.y) / 2
                const gap = opening.type === 'door' ? '#f7f9fc' : '#ffffff'
                const hingeDirection = opening.direction === 'outward' ? -1 : 1
                const room = rooms.find((candidate) => candidate.id === opening.roomId)
                let inwardSign = hingeDirection
                if (room && opening.direction !== 'outward') {
                  const roomCenter = { x: room.rect.x + room.rect.w / 2, y: room.rect.y + room.rect.h / 2 }
                  inwardSign = ((roomCenter.x - mx) * nx + (roomCenter.y - my) * ny) >= 0 ? 1 : -1
                }
                const singleHinge = opening.style === 'single-hinged' && opening.hingeSide === 'right' ? to : from
                const singleArcEnd = opening.style === 'single-hinged' && opening.hingeSide === 'right' ? from : to
                const leafEnd = { x: singleHinge.x + nx * opening.width * inwardSign, y: singleHinge.y + ny * opening.width * inwardSign }
                const sweep = (ux * (ny * inwardSign) - uy * (nx * inwardSign)) >= 0 ? 1 : 0
                return (
                  <g key={opening.id}>
                    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={gap} strokeWidth={wall.thickness + 0.3} strokeLinecap="square" />
                    {opening.type === 'door' ? (
                      opening.style === 'single-hinged' || opening.style === 'double-hinged' ? (
                        <g fill="none" stroke={opening.color ?? '#795b3e'} strokeWidth={u(0.9)}>
                          {opening.style === 'single-hinged' ? <>
                            <line x1={singleHinge.x} y1={singleHinge.y} x2={leafEnd.x} y2={leafEnd.y} />
                            <path d={`M ${leafEnd.x} ${leafEnd.y} A ${opening.width} ${opening.width} 0 0 ${sweep} ${singleArcEnd.x} ${singleArcEnd.y}`} />
                          </> : <>
                            <line x1={from.x} y1={from.y} x2={from.x + nx * opening.width * inwardSign / 2} y2={from.y + ny * opening.width * inwardSign / 2} />
                            <line x1={to.x} y1={to.y} x2={to.x + nx * opening.width * inwardSign / 2} y2={to.y + ny * opening.width * inwardSign / 2} />
                            <path d={`M ${from.x + nx * opening.width * inwardSign / 2} ${from.y + ny * opening.width * inwardSign / 2} A ${opening.width / 2} ${opening.width / 2} 0 0 ${sweep} ${mx} ${my}`} />
                            <path d={`M ${to.x + nx * opening.width * inwardSign / 2} ${to.y + ny * opening.width * inwardSign / 2} A ${opening.width / 2} ${opening.width / 2} 0 0 ${sweep ? 0 : 1} ${mx} ${my}`} />
                          </>}
                        </g>
                      ) : (
                        <g stroke={opening.color ?? '#795b3e'} strokeWidth={u(0.8)} fill="none">
                          {opening.style === 'folding' ? (
                            <path d={`M ${from.x} ${from.y} L ${mx - ux * opening.width * 0.18 + nx * opening.width * 0.1} ${my - uy * opening.width * 0.18 + ny * opening.width * 0.1} L ${mx + ux * opening.width * 0.18 - nx * opening.width * 0.1} ${my + uy * opening.width * 0.18 - ny * opening.width * 0.1} L ${to.x} ${to.y}`} />
                          ) : (
                            <>
                              <line x1={from.x + nx * u(1.1)} y1={from.y + ny * u(1.1)} x2={to.x + nx * u(1.1)} y2={to.y + ny * u(1.1)} strokeDasharray={opening.style === 'pocket' ? `${u(1.3)} ${u(0.8)}` : undefined} />
                              <path d={`M ${mx - ux * u(1.4)} ${my - uy * u(1.4)} l ${ux * u(2.8)} ${uy * u(2.8)}`} />
                            </>
                          )}
                        </g>
                      )
                    ) : (
                      <g stroke={opening.color ?? '#36718f'} strokeWidth={u(0.75)} fill="none">
                        <line x1={from.x + nx * wall.thickness * 0.18} y1={from.y + ny * wall.thickness * 0.18} x2={to.x + nx * wall.thickness * 0.18} y2={to.y + ny * wall.thickness * 0.18} />
                        <line x1={from.x - nx * wall.thickness * 0.18} y1={from.y - ny * wall.thickness * 0.18} x2={to.x - nx * wall.thickness * 0.18} y2={to.y - ny * wall.thickness * 0.18} />
                        {opening.style === 'casement' ? <path d={`M ${from.x} ${from.y} L ${mx + nx * opening.width * 0.18} ${my + ny * opening.width * 0.18} M ${to.x} ${to.y} L ${mx + nx * opening.width * 0.18} ${my + ny * opening.width * 0.18}`} /> : null}
                        {opening.style === 'sliding' ? <line x1={mx} y1={my} x2={mx + nx * wall.thickness * 0.22} y2={my + ny * wall.thickness * 0.22} /> : null}
                        {opening.style === 'bay' ? <path d={`M ${from.x - nx * wall.thickness} ${from.y - ny * wall.thickness} L ${mx - nx * wall.thickness * 1.4} ${my - ny * wall.thickness * 1.4} L ${to.x - nx * wall.thickness} ${to.y - ny * wall.thickness}`} /> : null}
                      </g>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}
      </g>

      {/* Site objects have independent selection, movement and resize handles. */}
      {trees.map((tree) => {
        const selected = tree.id === selectedTreeId
        const width = (tree.width ?? (tree.kind === 'car' ? 7 : 3)) * tree.scale
        const length = (tree.length ?? (tree.kind === 'car' ? 14 : 3)) * tree.scale
        const radius = Math.max(width, length) / 2
        const angle = tree.rotation * 180 / Math.PI
        return (
          <g key={tree.id} style={{ cursor: selected ? 'move' : 'pointer' }} onClick={(event) => { event.stopPropagation(); onSelectTree?.(tree.id) }} onPointerDown={(event) => startTreeDrag(event, tree, 'move')} onPointerMove={moveTreeDrag} onPointerUp={endTreeDrag} onPointerCancel={endTreeDrag} aria-label={`Select ${tree.kind ?? 'landscape object'}`}>
            <g transform={`translate(${tree.x} ${tree.y}) rotate(${angle})`} opacity={0.96}>
              {tree.kind === 'road' || tree.kind === 'path' ? <>
                <rect x={-width / 2} y={-length / 2} width={width} height={length} rx={tree.kind === 'path' ? u(0.4) : 0} fill={tree.kind === 'road' ? '#51565d' : '#c9c4b9'} stroke={selected ? '#1a56f5' : tree.kind === 'road' ? '#33383f' : '#938e83'} strokeWidth={selected ? u(1.5) : u(0.45)} />
                {tree.kind === 'road' ? <line x1={0} y1={-length / 2} x2={0} y2={length / 2} stroke="#e5d8a2" strokeWidth={u(0.45)} strokeDasharray={`${u(2.3)} ${u(2)}`} /> : null}
                {selected ? <rect x={-width / 2 - u(1)} y={-length / 2 - u(1)} width={width + u(2)} height={length + u(2)} fill="none" stroke="#1a56f5" strokeDasharray={`${u(1.5)} ${u(1)}`} /> : null}
              </> : tree.kind === 'fence' || tree.kind === 'gate' ? <>
                <rect x={-width / 2} y={-length / 2} width={width} height={length} fill={tree.color} stroke={selected ? '#1a56f5' : '#51483d'} strokeWidth={selected ? u(1.3) : u(0.5)} />
                {tree.kind === 'fence' ? <>
                  <line x1={-width / 2} y1={-length * 0.28} x2={width / 2} y2={-length * 0.28} stroke="#e7dfd3" strokeWidth={u(0.35)} />
                  <line x1={-width / 2} y1={length * 0.28} x2={width / 2} y2={length * 0.28} stroke="#e7dfd3" strokeWidth={u(0.35)} />
                  {Array.from({ length: Math.max(2, Math.floor(length / 1.5)) }, (_, index) => <line key={index} x1={-width / 2} y1={-length / 2 + (index + 0.5) * length / Math.max(2, Math.floor(length / 1.5))} x2={width / 2} y2={-length / 2 + (index + 0.5) * length / Math.max(2, Math.floor(length / 1.5))} stroke="#f5f1e9" strokeWidth={u(0.18)} />)}
                </> : <line x1={0} y1={-length / 2} x2={0} y2={length / 2} stroke="#d7c7a4" strokeWidth={u(0.25)} />}
              </> : tree.kind === 'street-light' ? <>
                <circle cx={0} cy={0} r={width * 0.65} fill={selected ? '#dbeafe' : '#fff3be'} stroke={selected ? '#1a56f5' : '#8b7447'} strokeWidth={u(0.7)} />
                <path d={`M 0 ${length / 2} L 0 ${-length * 0.25} Q 0 ${-length / 2} ${width} ${-length / 2}`} fill="none" stroke="#4b5563" strokeWidth={u(0.5)} />
                <circle cx={width} cy={-length / 2} r={width * 0.65} fill="#fff2a8" stroke="#aa8a48" strokeWidth={u(0.35)} />
              </> : tree.kind === 'car' ? <>
                <rect x={-width / 2} y={-length / 2} width={width} height={length} rx={width * 0.22} fill={tree.color} fillOpacity=".85" stroke={selected ? '#1a56f5' : '#536273'} strokeWidth={selected ? u(1.2) : u(0.65)} />
                <rect x={-width * 0.32} y={-length * 0.24} width={width * 0.64} height={length * 0.44} rx={width * 0.12} fill="#d9edf6" stroke="#627786" strokeWidth={u(0.4)} />
                <line x1={-width / 2} y1={0} x2={width / 2} y2={0} stroke="#465362" strokeWidth={u(0.35)} />
              </> : tree.kind === 'person' ? <>
                <circle cx={0} cy={0} r={width * 0.45} fill={tree.color} stroke={selected ? '#1a56f5' : '#455f87'} strokeWidth={u(0.7)} />
                <text x={0} y={u(0.9)} textAnchor="middle" fontSize={u(1.7)} fill="#fff">P</text>
              </> : <>
                <circle cx={0} cy={0} r={radius + 0.35} fill={selected ? '#dbeafe' : '#dbeccd'} stroke={selected ? '#1a56f5' : '#7fa668'} strokeWidth={selected ? u(1.4) : u(0.8)} />
                <circle cx={0} cy={0} r={radius} fill={tree.color} stroke="#47643c" strokeWidth={u(0.5)} />
              </>}
              {selected ? <rect x={-width / 2 - u(1)} y={-length / 2 - u(1)} width={width + u(2)} height={length + u(2)} fill="none" stroke="#1a56f5" strokeDasharray={`${u(1.5)} ${u(1)}`} /> : null}
            </g>
            {selected ? <circle cx={tree.x + width / 2} cy={tree.y + length / 2} r={u(3.2)} fill="#1a56f5" stroke="white" strokeWidth={u(1)} style={{ cursor: 'nwse-resize' }} onPointerDown={(event) => startTreeDrag(event, tree, 'resize')} onPointerMove={moveTreeDrag} onPointerUp={endTreeDrag} onPointerCancel={endTreeDrag} /> : null}
          </g>
        )
      })}

      {/* Measure overlay */}
      {measure && measurePts.length > 0 ? (
        <g pointerEvents="none">
          {measurePts.length === 2 ? (
            <line
              x1={measurePts[0].x}
              y1={measurePts[0].y}
              x2={measurePts[1].x}
              y2={measurePts[1].y}
              stroke="#1a56f5"
              strokeWidth={u(1.5)}
              strokeDasharray={`${u(5)} ${u(4)}`}
            />
          ) : null}
          {measurePts.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={u(3.5)} fill="#1a56f5" stroke="#ffffff" strokeWidth={u(1.5)} />
          ))}
          {measureDistance != null ? (
            <g
              transform={`translate(${(measurePts[0].x + measurePts[1].x) / 2} ${(measurePts[0].y + measurePts[1].y) / 2})`}
            >
              <rect
                x={-u(34)}
                y={-u(22)}
                width={u(68)}
                height={u(18)}
                rx={u(5)}
                fill="#0f1b2d"
                opacity="0.92"
              />
              <text
                x={0}
                y={-u(9)}
                textAnchor="middle"
                fontSize={u(SMALL_PX + 1)}
                fontWeight={700}
                fill="#ffffff"
              >
                {fmt(measureDistance)} {units}
              </text>
            </g>
          ) : null}
        </g>
      ) : null}

      {showCompass ? (
        <g transform={`translate(${maxX - u(4)} ${minY + u(16)})`} pointerEvents="none">
          <circle r={u(11)} fill="#ffffff" stroke="#cbd5e1" strokeWidth={u(1)} opacity="0.95" />
          <polygon points={`0,${-u(7)} ${u(4.5)},${u(4.5)} 0,${u(1.2)} ${-u(4.5)},${u(4.5)}`} fill="#1a56f5" />
          <text x={0} y={-u(13)} textAnchor="middle" fontSize={u(9)} fontWeight={700} fill="#475569">
            N
          </text>
        </g>
      ) : null}

      {/* Scale bar — always screen-constant, picks a round unit length */}
      {scaleBar ? (
        <g
          transform={`translate(${minX + u(4)} ${maxY + u(14)})`}
          pointerEvents="none"
          stroke="#64748b"
          strokeWidth={u(1.2)}
        >
          <line x1={0} y1={0} x2={scaleBar.units * 1} y2={0} />
          <line x1={0} y1={-u(4)} x2={0} y2={u(4)} />
          <line x1={scaleBar.units} y1={-u(4)} x2={scaleBar.units} y2={u(4)} />
          <text
            x={scaleBar.units / 2}
            y={-u(6)}
            textAnchor="middle"
            fontSize={u(SMALL_PX)}
            fill="#64748b"
            stroke="none"
          >
            {scaleBar.units} {units}
          </text>
        </g>
      ) : null}
    </svg>
  )
}

function DimensionLine({
  x1,
  y1,
  x2,
  y2,
  label,
  u,
  vertical,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  label: string
  u: (px: number) => number
  vertical: boolean
}) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line x1={x1} y1={y1 - u(4)} x2={x1} y2={y1 + u(4)} />
      <line x1={x2} y1={y2 - u(4)} x2={x2} y2={y2 + u(4)} />
      <text
        x={vertical ? mx - u(6) : mx}
        y={vertical ? my : my - u(5)}
        textAnchor="middle"
        fontSize={u(SMALL_PX)}
        stroke="none"
        transform={vertical ? `rotate(-90 ${mx - u(6)} ${my})` : undefined}
      >
        {label}
      </text>
    </g>
  )
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function wrapLabel(value: string, maxChars: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = word.length > maxChars ? `${word.slice(0, Math.max(1, maxChars - 1))}…` : word
    if (lines.length === maxLines - 1) break
  }
  if (current && lines.length < maxLines) lines.push(current)
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').replace(/…$/, '').length && !lines[lines.length - 1]?.endsWith('…')) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(1, maxChars - 1))}…`
  }
  return lines
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function pickScaleBar(s: number, units: Units): { units: number } | null {
  const candidates = units === 'ft' ? [2, 5, 10, 20, 40] : [1, 2, 5, 10]
  const target = candidates.find((c) => c * s >= 56 && c * s <= 160)
  return target ? { units: target } : null
}

/**
 * Schematic furniture glyphs, drawn in plan units (real-world size) with
 * screen-constant stroke weight — the way drafted plans show FF&E.
 */
function RoomFurniture({ room, u, color, selectedItemId, dragEnabled, onSelectItem, onItemPointerDown, onItemPointerMove, onItemPointerUp }: { room: Room; u: (px: number) => number; color: string; selectedItemId: string | null; dragEnabled: boolean; onSelectItem?: (id: string | null) => void; onItemPointerDown: (event: ReactPointerEvent<SVGGElement>, room: Room, item: PlacedItem) => void; onItemPointerMove: (event: ReactPointerEvent<SVGGElement>) => void; onItemPointerUp: (event: ReactPointerEvent<SVGGElement>) => void }) {
  const { x, y, w, h } = room.rect
  if (!room.items?.length) return null
  return (
    <g pointerEvents="all" strokeWidth={u(0.85)}>
      {room.items.map((item) => {
        const key = canonicalFurnitureKey(item.item)
        const defaults = getFurnitureDimensions(item.item, room.units)
        const iw = item.width ?? defaults.width
        const ih = item.depth ?? defaults.depth
        const cx = x + w * (0.5 + item.x)
        const cy = y + h * (0.5 + item.z)
        const stroke = item.color || color
        const base = <rect x={-iw / 2} y={-ih / 2} width={iw} height={ih} rx={u(0.3)} fill={stroke} fillOpacity={0.13} stroke={stroke} />
        return (
          <g key={item.id} transform={`translate(${cx} ${cy}) rotate(${item.rotation * 180 / Math.PI})`} stroke={selectedItemId === item.id ? '#1a56f5' : stroke} fill="none" style={{ cursor: dragEnabled ? 'move' : 'pointer' }} onClick={(event) => { event.stopPropagation(); onSelectItem?.(item.id) }} onPointerDown={dragEnabled ? (event) => onItemPointerDown(event, room, item) : undefined} onPointerMove={dragEnabled ? onItemPointerMove : undefined} onPointerUp={dragEnabled ? onItemPointerUp : undefined} onPointerCancel={dragEnabled ? onItemPointerUp : undefined}>
            {base}
            {selectedItemId === item.id ? <rect x={-iw / 2 - u(0.2)} y={-ih / 2 - u(0.2)} width={iw + u(0.4)} height={ih + u(0.4)} fill="none" stroke="#1a56f5" strokeDasharray={`${u(1)} ${u(0.7)}`} /> : null}
            {key === 'bed' || key === 'king-bed' ? <>
              <path d={`M ${-iw * 0.42} ${-ih * 0.18} h ${iw * 0.84} v ${ih * 0.58} h ${-iw * 0.84} Z`} fill="#fff" fillOpacity=".7" />
              <line x1={-iw / 2} y1={-ih * 0.28} x2={iw / 2} y2={-ih * 0.28} />
              <rect x={-iw * 0.36} y={-ih * 0.42} width={iw * 0.3} height={ih * 0.16} rx={u(0.15)} fill="#fff" />
              <rect x={iw * 0.06} y={-ih * 0.42} width={iw * 0.3} height={ih * 0.16} rx={u(0.15)} fill="#fff" />
            </> : null}
            {key === 'sofa' || key === 'armchair' ? <>
              <line x1={-iw * 0.38} y1={-ih * 0.26} x2={iw * 0.38} y2={-ih * 0.26} />
              <line x1={-iw * 0.38} y1={-ih * 0.26} x2={-iw * 0.38} y2={ih * 0.4} />
              <line x1={iw * 0.38} y1={-ih * 0.26} x2={iw * 0.38} y2={ih * 0.4} />
              <line x1={-iw * 0.5} y1={ih * 0.38} x2={iw * 0.5} y2={ih * 0.38} />
            </> : null}
            {key === 'dining' || key === 'table' || key === 'coffee-table' || key === 'sideboard' || key === 'desk' ? <>
              <line x1={-iw * 0.35} y1={-ih * 0.35} x2={-iw * 0.35} y2={ih * 0.35} />
              <line x1={iw * 0.35} y1={-ih * 0.35} x2={iw * 0.35} y2={ih * 0.35} />
            </> : null}
            {key === 'chair' ? <path d={`M ${-iw * 0.42} ${-ih * 0.45} h ${iw * 0.84} v ${ih * 0.35} h ${-iw * 0.84} Z M ${-iw * 0.42} ${-ih * 0.1} v ${ih * 0.5} M ${iw * 0.42} ${-ih * 0.1} v ${ih * 0.5}`} /> : null}
            {key === 'toilet' ? <>
              <ellipse cx="0" cy={ih * 0.1} rx={iw * 0.38} ry={ih * 0.32} fill="#fff" />
              <rect x={-iw * 0.34} y={-ih * 0.43} width={iw * 0.68} height={ih * 0.22} rx={u(0.1)} />
            </> : null}
            {key === 'sink' || key === 'washbasin' ? <>
              <ellipse cx="0" cy="0" rx={iw * 0.34} ry={ih * 0.3} fill="#fff" />
              <circle cx="0" cy="0" r={u(0.12)} />
            </> : null}
            {key === 'shower' ? <>
              <line x1={-iw / 2} y1={-ih / 2} x2={iw / 2} y2={ih / 2} />
              <circle cx={iw * 0.3} cy={-ih * 0.3} r={u(0.2)} />
            </> : null}
            {key === 'bath' ? <>
              <rect x={-iw * 0.4} y={-ih * 0.36} width={iw * 0.8} height={ih * 0.72} rx={u(0.55)} fill="#fff" />
              <ellipse cx="0" cy="0" rx={iw * 0.25} ry={ih * 0.18} />
            </> : null}
            {key === 'fridge' || key === 'kitchen' || key === 'cabinets' || key === 'wardrobe' || key === 'bookshelf' || key === 'storage-rack' ? <>
              <line x1={0} y1={-ih / 2} x2={0} y2={ih / 2} />
              <line x1={iw * 0.35} y1={-ih * 0.2} x2={iw * 0.35} y2={ih * 0.2} />
            </> : null}
            {key === 'cooker' ? <>
              {[[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]].map(([px, py], index) => <circle key={index} cx={px * iw} cy={py * ih} r={Math.min(iw, ih) * 0.12} />)}
            </> : null}
            {key === 'tv-unit' || key === 'tv' ? <>
              <line x1={-iw * 0.35} y1={-ih * 0.25} x2={iw * 0.35} y2={-ih * 0.25} />
              <line x1={-iw * 0.35} y1={ih * 0.25} x2={iw * 0.35} y2={ih * 0.25} />
            </> : null}
          </g>
        )
      })}
    </g>
  )
}
