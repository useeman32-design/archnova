import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'

/**
 * Scrollable, zoomable canvas surface for the 2D plan.
 * The grid is pure CSS so it scales with the zoom level.
 * With `pan` enabled, dragging scrolls the canvas like a CAD viewport.
 */
export function PlanCanvas({
  zoom,
  pan = false,
  setZoom,
  children,
  className = '',
}: {
  zoom: number
  pan?: boolean
  setZoom: (zoom: number) => void
  children: ReactNode
  className?: string
}) {
  const [dragging, setDragging] = useState(false)
  const last = useState<{ x: number; y: number } | null>(null)
  const [ref, setRef] = useState<HTMLDivElement | null>(null)
  const pendingAnchor = useRef<{ clientX: number; clientY: number; xRatio: number; yRatio: number } | null>(null)

  useLayoutEffect(() => {
    const anchor = pendingAnchor.current
    if (!ref || !anchor) return
    const containerRect = ref.getBoundingClientRect()
    const svgRect = ref.querySelector('svg')?.getBoundingClientRect()
    const contentRect = svgRect ?? containerRect
    const pointX = contentRect.left - containerRect.left + ref.scrollLeft + anchor.xRatio * contentRect.width
    const pointY = contentRect.top - containerRect.top + ref.scrollTop + anchor.yRatio * contentRect.height
    ref.scrollLeft += pointX - (anchor.clientX - containerRect.left)
    ref.scrollTop += pointY - (anchor.clientY - containerRect.top)
    pendingAnchor.current = null
  }, [zoom, ref])

  return (
    <div
      ref={setRef}
      className={`relative overflow-auto scroll-thin bg-canvas-soft/70 ${pan ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''} ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(100,116,139,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.10) 1px, transparent 1px)',
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
      }}
      onWheel={(event) => {
        event.preventDefault()
        if (event.ctrlKey) {
          if (ref) { ref.scrollLeft += event.deltaX || event.deltaY; ref.scrollTop += event.deltaY }
        } else {
          const nextZoom = Math.max(0.4, Math.min(3, zoom * Math.exp(-event.deltaY * 0.0012)))
          if (nextZoom === zoom || !ref) return
          const target = ref.querySelector('svg') ?? ref
          const rect = target.getBoundingClientRect()
          pendingAnchor.current = {
            clientX: event.clientX,
            clientY: event.clientY,
            xRatio: rect.width ? (event.clientX - rect.left) / rect.width : 0.5,
            yRatio: rect.height ? (event.clientY - rect.top) / rect.height : 0.5,
          }
          setZoom(nextZoom)
        }
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
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-sm">
      <button
        onClick={() => setZoom(Math.max(0.4, zoom / 1.25))}
        disabled={zoom <= 0.4}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-canvas-soft hover:text-ink-text disabled:opacity-40"
        aria-label="Zoom out"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
      <span className="w-11 text-center text-[11.5px] font-medium tabular-nums text-muted">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => setZoom(Math.min(3, zoom * 1.25))}
        disabled={zoom >= 3}
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
