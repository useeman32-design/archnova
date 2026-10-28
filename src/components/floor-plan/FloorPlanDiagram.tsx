import type { Room, RoomCategory, Units } from '@/types'
import { formatArea, formatDimensions } from '@/lib/format'

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

export interface FloorPlanDiagramProps {
  rooms: Room[]
  units: Units
  className?: string
  showLabels?: boolean
  showDimensions?: boolean
  selectedId?: string | null
  onSelectRoom?: (room: Room) => void
  /** Plot boundary — drawn as a dashed rectangle around all rooms. */
  showBoundary?: boolean
  /** Render a north arrow and scale bar. */
  showCompass?: boolean
  /** Render area values under each room label. */
  showAreas?: boolean
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
}: FloorPlanDiagramProps) {
  if (rooms.length === 0) {
    return (
      <div className={`flex items-center justify-center text-[13px] text-muted ${className}`}>
        No rooms to display yet.
      </div>
    )
  }

  const padX = 6
  const padY = 12
  const minX = Math.min(...rooms.map((r) => r.rect.x))
  const minY = Math.min(...rooms.map((r) => r.rect.y))
  const maxX = Math.max(...rooms.map((r) => r.rect.x + r.rect.w))
  const maxY = Math.max(...rooms.map((r) => r.rect.y + r.rect.h))

  const vbX = minX - padX
  const vbY = minY - padY
  const vbW = maxX - minX + padX * 2
  const vbH = maxY - minY + padY * 2
  const scale = vbW / 60
  const fontSize = Math.max(7, Math.min(13, scale))

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      className={`h-full w-full ${className}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Floor plan diagram"
    >
      {showBoundary ? (
        <rect
          x={vbX + 2}
          y={vbY + 2}
          width={vbW - 4}
          height={vbH - 4}
          fill="none"
          stroke="#9aa7b8"
          strokeWidth="1"
          strokeDasharray="6 5"
          opacity="0.7"
        />
      ) : null}

      {rooms.map((room) => {
        const palette = ROOM_COLORS[room.category] ?? ROOM_COLORS.other
        const isSelected = selectedId === room.id
        return (
          <g
            key={room.id}
            className="room-hit cursor-pointer"
            onClick={() => onSelectRoom?.(room)}
            role={onSelectRoom ? 'button' : undefined}
            aria-label={onSelectRoom ? `Select ${room.name}` : undefined}
          >
            <rect
              x={room.rect.x}
              y={room.rect.y}
              width={room.rect.w}
              height={room.rect.h}
              rx="1.5"
              fill={palette.fill}
              stroke={isSelected ? '#1a56f5' : palette.stroke}
              strokeWidth={isSelected ? 2.2 : 1.2}
              className="transition-colors"
              opacity={selectedId && !isSelected ? 0.65 : 1}
            />
            {showLabels ? (
              <text
                x={room.rect.x + room.rect.w / 2}
                y={room.rect.y + room.rect.h / 2 - 1.5}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight={600}
                fill={isSelected ? '#1a56f5' : palette.text}
              >
                {room.name.length > 16 ? `${room.name.slice(0, 15)}…` : room.name}
              </text>
            ) : null}
            {showAreas ? (
              <text
                x={room.rect.x + room.rect.w / 2}
                y={room.rect.y + room.rect.h / 2 + fontSize + 1}
                textAnchor="middle"
                fontSize={Math.max(6, fontSize - 1.5)}
                fill={isSelected ? '#1a56f5' : palette.text}
                opacity="0.85"
              >
                {formatArea(room.rect.w, room.rect.h, units)}
              </text>
            ) : null}
            {showDimensions && room.rect.w > 22 && room.rect.h > 20 ? (
              <text
                x={room.rect.x + room.rect.w / 2}
                y={room.rect.y + room.rect.h + fontSize + 5}
                textAnchor="middle"
                fontSize={Math.max(6, fontSize - 1.5)}
                fill="#5b6572"
              >
                {formatDimensions(room.rect.w, room.rect.h, units)}
              </text>
            ) : null}
          </g>
        )
      })}

      {showCompass ? (
        <g transform={`translate(${vbX + vbW - 18} ${vbY + 18})`}>
          <circle r="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" opacity="0.95" />
          <polygon points="0,-6 4,4 0,1 -4,4" fill="#1a56f5" />
          <text x="0" y="-11" textAnchor="middle" fontSize="8" fontWeight="700" fill="#475569">
            N
          </text>
        </g>
      ) : null}
    </svg>
  )
}
