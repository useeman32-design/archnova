import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import type { PlacedItem, Project } from '@/types'
import { HouseIllustration } from '@/components/illustrations/HouseIllustration'
import { Spinner } from '@/components/ui/Feedback'

/**
 * Interactive massing preview surface.
 *
 * The React Three Fiber scene lives in `./MassingCanvas` and is loaded lazily
 * so the three.js bundle only downloads when a 3D surface mounts. Props mirror
 * the editor contract: selection, move/scale transforms and site ornaments
 * flow straight through, keeping 2D and 3D in sync.
 */

const MassingCanvas = lazy(() => import('./MassingCanvas'))

export interface MassingProps {
  project: Project
  mode?: 'exterior' | 'interior'
  className?: string
  selectedId?: string | null
  onSelectRoom?: (id: string | null) => void
  transformMode?: 'translate' | 'scale'
  onMoveLive?: (id: string, x: number, y: number) => void
  onResizeLive?: (id: string, w: number, h: number) => void
  onEditBegin?: () => void
  onEditEnd?: () => void
  ornaments?: { id: string; x: number; y: number; kind?: string; rotation: number; scale: number; color: string }[]
  placed?: Record<string, PlacedItem[]>
  selectedItemId?: string | null
  onSelectItem?: (id: string | null) => void
  onUpdatePlacedItem?: (roomId: string, itemId: string, patch: Partial<PlacedItem>) => void
  selectedSiteId?: string | null
  onSelectSite?: (id: string | null) => void
  onUpdateSiteLive?: (id: string, x: number, y: number, scale: number) => void
  pendingItem?: string | null
  onPlaceInterior?: (item: string) => void
}

export function MassingViewer({ project, mode = 'exterior', className = '', ...rest }: MassingProps) {
  const [resetKey, setResetKey] = useState(0)
  const label = mode === 'interior' ? 'Interior preview' : 'Interactive massing preview'
  const hint =
    mode === 'interior'
      ? 'drag to look around'
      : rest.onSelectRoom
        ? 'click a volume to select · drag to orbit · use Move/Scale to edit'
        : 'drag to orbit, scroll to zoom'

  return (
    <div className={`relative overflow-hidden bg-[#e8edf2] ${className}`}>
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <Spinner className="h-6 w-6 text-brand-600" />
          </div>
        }
      >
        <MassingCanvas key={`${mode}-${resetKey}`} project={project} mode={mode} {...rest} />
      </Suspense>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-[10.5px] font-medium text-white/90 backdrop-blur">
        {label} · {hint}
      </span>
      <button
        type="button"
        onClick={() => setResetKey((k) => k + 1)}
        className="absolute bottom-3 right-3 rounded-lg bg-surface/90 px-2.5 py-1.5 text-[11.5px] font-medium text-ink-text shadow-sm ring-1 ring-line backdrop-blur hover:bg-surface"
      >
        Reset view
      </button>
    </div>
  )
}

/** Keeps a broken WebGL context from taking the whole workspace down. */
export class ThreeErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

export function MassingViewerSafe(props: MassingProps) {
  const { project, className } = props
  return (
    <ThreeErrorBoundary
      fallback={
        <HouseIllustration
          roof={project.roof}
          exterior={project.preferences.exteriorFinish}
          showPool={project.preferences.outdoor.includes('pool')}
          showGarage={project.preferences.outdoor.includes('garage')}
          showGarden={project.preferences.outdoor.includes('garden')}
          variant={project.thumbnailSeed % 3}
          className={`h-full w-full ${className ?? ''}`}
        />
      }
    >
      <MassingViewer {...props} />
    </ThreeErrorBoundary>
  )
}
