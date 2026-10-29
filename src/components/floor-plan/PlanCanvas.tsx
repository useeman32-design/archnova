import { useState, type ReactNode } from 'react'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'

const STEPS = [0.6, 0.8, 1, 1.25, 1.6, 2]

/**
 * Scrollable, zoomable canvas surface for the 2D plan.
 * The grid is pure CSS so it scales with the zoom level.
 * With `pan` enabled, dragging scrolls the canvas like a CAD viewport.
 */
export function PlanCanvas({
  zoom,
  pan = false,
  children,
  className = '',
}: {
  zoom: number
  pan?: boolean
  children: ReactNode
  className?: string
}) {
  const [dragging, setDragging] = useState(false)
  const last = useState<{ x: number; y: number } | null>(null)
  const [ref, setRef] = useState<HTMLDivElement | null>(null)

  return (
    <div
      ref={setRef}
      className={`relative overflow-auto scroll-thin bg-canvas-soft/70 ${pan ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''} ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(100,116,139,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.10) 1px, transparent 1px)',
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
      }}
      onPointerDown={
        pan
          ? (event) => {
              last[1]({ x: event.clientX, y: event.clientY })
              setDragging(true)
              event.currentTarget.setPointerCapture(event.pointerId)
            }
          : undefined
      }
      onPointerMove={
        pan
          ? (event) => {
              const prev = last[0]
              if (!prev || !ref) return
              ref.scrollLeft -= event.clientX - prev.x
              ref.scrollTop -= event.clientY - prev.y
              last[1]({ x: event.clientX, y: event.clientY })
            }
          : undefined
      }
      onPointerUp={
        pan
          ? (event) => {
              setDragging(false)
              last[1](null)
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          : undefined
      }
    >
      {/* The inner box has an explicit size on BOTH axes so the SVG letterboxes
          into the pane instead of overflowing it; zoom scales both axes. */}
      <div
        className="flex items-center justify-center p-4"
        style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
      >
        {children}
      </div>
    </div>
  )
}

export function ZoomControls({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  const index = STEPS.indexOf(zoom)
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-sm">
      <button
        onClick={() => setZoom(STEPS[Math.max(0, (index === -1 ? 2 : index) - 1)])}
        disabled={zoom <= STEPS[0]}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-canvas-soft hover:text-ink-text disabled:opacity-40"
        aria-label="Zoom out"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
      <span className="w-11 text-center text-[11.5px] font-medium tabular-nums text-muted">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => setZoom(STEPS[Math.min(STEPS.length - 1, (index === -1 ? 2 : index) + 1)])}
        disabled={zoom >= STEPS[STEPS.length - 1]}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-canvas-soft hover:text-ink-text disabled:opacity-40"
        aria-label="Zoom in"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setZoom(1)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-canvas-soft hover:text-ink-text"
        aria-label="Reset zoom"
        title="Fit"
      >
        <Maximize className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function useZoom() {
  return useState(1)
}
