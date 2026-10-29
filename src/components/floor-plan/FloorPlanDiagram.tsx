import { useLayoutEffect, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { Room, RoomCategory, Units, Vec2 } from '@/types'
import { formatArea } from '@/lib/format'

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
  className?: string
  showLabels?: boolean
  showDimensions?: boolean
  selectedId?: string | null
  onSelectRoom?: (room: Room) => void
  showBoundary?: boolean
  showCompass?: boolean
  showAreas?: boolean
  /** Measure mode: click two points to read a distance; click again to restart. */
  measure?: boolean
  /** Receives background clicks in plan units (used by placement tools). */
  onCanvasClick?: (point: Vec2) => void
  /** Site ornaments (trees) rendered as planting glyphs. */
  trees?: (Vec2 & { kind?: string })[]
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
  const minX = hasRooms ? Math.min(...rooms.map((r) => r.rect.x)) : 0
  const minY = hasRooms ? Math.min(...rooms.map((r) => r.rect.y)) : 0
  const maxX = hasRooms ? Math.max(...rooms.map((r) => r.rect.x + r.rect.w)) : 1
  const maxY = hasRooms ? Math.max(...rooms.map((r) => r.rect.y + r.rect.h)) : 1

  const padX = 8
  const padY = 13
  const vbX = minX - padX
  const vbY = minY - padY
  const vbW = maxX - minX + padX * 2
  const vbH = maxY - minY + padY * 2

  useLayoutEffect(() => {
    if (!hasRooms) return
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
  }, [vbW, vbH, hasRooms])

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

  /* Early return AFTER every hook — changing hook order between renders
     crashes React ("Rendered more hooks than during the previous render"). */
  if (!hasRooms) {
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
          x={minX - 2}
          y={minY - 2}
          width={maxX - minX + 4}
          height={maxY - minY + 4}
          fill="none"
          stroke="#9aa7b8"
          strokeWidth={u(1)}
          strokeDasharray={`${u(6)} ${u(5)}`}
          opacity="0.7"
        />
      ) : null}

      {/* Overall dimension lines (top + left), shown once there is room */}
      {showDimensions && s > 2.2 ? (
        <g stroke="#8792a2" strokeWidth={u(1)} fill="#5b6572">
          <DimensionLine
            x1={minX}
            y1={minY - 5}
            x2={maxX}
            y2={minY - 5}
            label={`${fmt(maxX - minX)}'`}
            u={u}
            vertical={false}
          />
          <DimensionLine
            x1={minX - 5}
            y1={minY}
            x2={minX - 5}
            y2={maxY}
            label={`${fmt(maxY - minY)}'`}
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
        const name = room.name.length > maxChars ? `${room.name.slice(0, maxChars - 1)}…` : room.name

        return (
          <g
            key={room.id}
            className={onSelectRoom && !measure ? 'room-hit cursor-pointer' : undefined}
            style={dragEnabled ? { cursor: 'move' } : undefined}
            onClick={
              onSelectRoom && !measure
                ? (event) => {
                    event.stopPropagation()
                    onSelectRoom(room)
                  }
                : undefined
            }
            onPointerDown={dragEnabled ? (event) => startDrag(event, room, 'move') : undefined}
            onPointerMove={dragEnabled ? moveDrag : undefined}
            onPointerUp={dragEnabled ? endDrag : undefined}
            onPointerCancel={dragEnabled ? endDrag : undefined}
            role={onSelectRoom && !measure ? 'button' : undefined}
            aria-label={onSelectRoom ? `Select ${room.name}` : undefined}
          >
            <title>{`${room.name} — ${formatArea(room.rect.w, room.rect.h, units)}`}</title>
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
            {showLabel ? (
              <text
                x={room.rect.x + room.rect.w / 2}
                y={room.rect.y + room.rect.h / 2 - (showArea ? u(3) : -u(4))}
                textAnchor="middle"
                fontSize={u(LABEL_PX)}
                fontWeight={600}
                fill={isSelected ? '#1a56f5' : palette.text}
              >
                {name}
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
                {formatArea(room.rect.w, room.rect.h, units)}
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
                {fmt(room.rect.w)} × {fmt(room.rect.h)}
              </text>
            ) : null}
            {rw >= 70 && rh >= 48 ? <RoomFurniture room={room} u={u} color={palette.text} /> : null}
            {rw >= 60 && rh >= 40 ? (
              <RoomOpenings room={room} u={u} stroke={palette.stroke} />
            ) : null}
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

      {/* Site ornaments (trees) */}
      {trees.map((point, index) => (
        <g key={`tree-${index}`} pointerEvents="none" opacity={0.8}>
          <circle cx={point.x} cy={point.y} r={1.8} fill="#dbeccd" stroke="#7fa668" strokeWidth={u(1)} />
          <circle cx={point.x} cy={point.y} r={u(1.6)} fill="#5d8a43" stroke="none" />
        </g>
      ))}

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
function RoomFurniture({ room, u, color }: { room: Room; u: (px: number) => number; color: string }) {
  const { x, y, w, h } = room.rect
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: u(1),
    opacity: 0.5,
    strokeLinecap: 'round' as const,
  }
  const min = Math.min

  switch (room.category) {
    case 'bedroom': {
      const bw = min(6, w - 2)
      const bh = min(7.5, h - 2)
      return (
        <g {...common}>
          <rect x={x + 1.5} y={y + 1.5} width={bw} height={bh} rx={u(2)} />
          <line x1={x + 1.5} y1={y + 3} x2={x + 1.5 + bw} y2={y + 3} />
        </g>
      )
    }
    case 'living': {
      const sw = min(7, w - 3)
      const sx = x + (w - sw) / 2
      const sy = y + h - 3.4
      return (
        <g {...common}>
          <rect x={sx} y={sy} width={sw} height={2.4} rx={u(2)} />
          <line x1={sx} y1={sy + 0.7} x2={sx + sw} y2={sy + 0.7} />
          <rect x={x + w / 2 - 1.4} y={sy - 2.6} width={2.8} height={1.5} rx={u(2)} />
        </g>
      )
    }
    case 'dining': {
      const r = min(w, h) * 0.2
      const cx = x + w / 2
      const cy = y + h / 2
      return (
        <g {...common}>
          <circle cx={cx} cy={cy} r={r} />
          <rect x={cx - 0.7} y={cy - r - 1.7} width={1.4} height={1.2} />
          <rect x={cx - 0.7} y={cy + r + 0.5} width={1.4} height={1.2} />
          <rect x={cx - r - 1.7} y={cy - 0.7} width={1.2} height={1.4} />
          <rect x={cx + r + 0.5} y={cy - 0.7} width={1.2} height={1.4} />
        </g>
      )
    }
    case 'kitchen':
      return (
        <g {...common}>
          <rect x={x + 1} y={y + 1} width={w - 2} height={2} />
          <rect x={x + 1} y={y + 1} width={2} height={min(h - 2, 6)} />
          <circle cx={x + w / 2} cy={y + 2} r={0.7} />
        </g>
      )
    case 'bathroom':
    case 'laundry':
      return (
        <g {...common}>
          <rect x={x + 1.2} y={y + 1.2} width={1.7} height={1.3} />
          <circle cx={x + 2.05} cy={y + 3.4} r={0.85} />
          <rect x={x + w - 3.2} y={y + 1.2} width={2} height={1.6} />
        </g>
      )
    case 'garage': {
      const cw = min(6.5, w - 3)
      const ch = min(12, h - 3)
      const cx = x + (w - cw) / 2
      const cy = y + (h - ch) / 2
      return (
        <g {...common}>
          <rect x={cx} y={cy} width={cw} height={ch} rx={u(6)} />
          <line x1={cx} y1={cy + ch * 0.28} x2={cx + cw} y2={cy + ch * 0.28} />
          <line x1={cx} y1={cy + ch * 0.72} x2={cx + cw} y2={cy + ch * 0.72} />
        </g>
      )
    }
    case 'study':
      return (
        <g {...common}>
          <rect x={x + (w - min(6, w - 3)) / 2} y={y + 1.5} width={min(6, w - 3)} height={2.5} />
          <circle cx={x + w / 2} cy={y + 5.4} r={0.9} />
        </g>
      )
    case 'storage':
      return (
        <g {...common}>
          <line x1={x + 1} y1={y + 2} x2={x + w - 1} y2={y + 2} />
          <line x1={x + 1} y1={y + 3.4} x2={x + w - 1} y2={y + 3.4} />
        </g>
      )
    case 'pool':
      return (
        <g {...common}>
          {[0.3, 0.5, 0.7].map((t) => (
            <path
              key={t}
              d={`M ${x + 1.5} ${y + h * t} q ${(w - 3) / 4} -1 ${(w - 3) / 2} 0 q ${(w - 3) / 4} 1 ${(w - 3) / 2} 0`}
            />
          ))}
        </g>
      )
    case 'garden':
      return (
        <g {...common}>
          <circle cx={x + w * 0.25} cy={y + h * 0.5} r={1.7} />
          <circle cx={x + w * 0.6} cy={y + h * 0.35} r={1.4} />
          <circle cx={x + w * 0.78} cy={y + h * 0.65} r={1.6} />
        </g>
      )
    case 'porch':
    case 'balcony':
      return (
        <g {...common}>
          <line x1={x + 0.6} y1={y + h - 0.6} x2={x + w - 0.6} y2={y + h - 0.6} strokeDasharray={`${u(4)} ${u(3)}`} />
        </g>
      )
    default:
      return null
  }
}

/** Door swings + window bands on the room envelope (drafting convention).
 *  Counts follow the room's element list, so the Door/Window tools give
 *  immediate visual feedback. */
function RoomOpenings({ room, u, stroke }: { room: Room; u: (px: number) => number; stroke: string }) {
  if (['circulation', 'garden', 'pool', 'balcony'].includes(room.category)) return null
  const { x, y, w, h } = room.rect
  const doors = Math.max(1, room.elements.filter((e) => e.type === 'door').length)
  const windows = Math.max(1, room.elements.filter((e) => e.type === 'window').length)
  const doorGap = Math.min(6, (w - 2) / doors)
  const leaf = Math.min(3, h * 0.5)
  const wl = Math.min(3.4, (w - 2) / windows - 1)

  return (
    <g fill="none" strokeWidth={u(1)} opacity={0.75}>
      {Array.from({ length: doors }).map((_, i) => {
        const hinge = x + 1.2 + i * doorGap
        return (
          <g key={`d${i}`} stroke={stroke}>
            <line x1={hinge} y1={y + h} x2={hinge} y2={y + h - leaf} />
            <path d={`M ${hinge} ${y + h - leaf} A ${leaf} ${leaf} 0 0 1 ${hinge + leaf} ${y + h}`} />
          </g>
        )
      })}
      {Array.from({ length: windows }).map((_, i) => {
        const wx = x + ((w * (i + 1)) / (windows + 1)) - wl / 2
        return (
          <g key={`w${i}`} stroke={stroke}>
            <rect x={wx} y={y - 0.35} width={wl} height={0.7} fill="#ffffff" />
            <line x1={wx} y1={y} x2={wx + wl} y2={y} />
          </g>
        )
      })}
    </g>
  )
}
