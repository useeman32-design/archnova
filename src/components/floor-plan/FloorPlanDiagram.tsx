import { useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
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

  if (!hasRooms) {
    return (
      <div className={`flex items-center justify-center text-[13px] text-muted ${className}`}>
        No rooms to display yet.
      </div>
    )
  }

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

  const handleBackgroundClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!measure) return
    const point = toPlanPoint(event)
    if (!point) return
    setMeasurePts((prev) => (prev.length >= 2 ? [point] : [...prev, point]))
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
            onClick={
              onSelectRoom && !measure
                ? (event) => {
                    event.stopPropagation()
                    onSelectRoom(room)
                  }
                : undefined
            }
            role={onSelectRoom && !measure ? 'button' : undefined}
            aria-label={onSelectRoom ? `Select ${room.name}` : undefined}
          >
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

function pickScaleBar(s: number, units: Units): { units: number } | null {
  const candidates = units === 'ft' ? [2, 5, 10, 20, 40] : [1, 2, 5, 10]
  const target = candidates.find((c) => c * s >= 56 && c * s <= 160)
  return target ? { units: target } : null
}
