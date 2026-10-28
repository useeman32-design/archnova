import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import type { Project } from '@/types'
import { HouseIllustration } from '@/components/illustrations/HouseIllustration'
import { Spinner } from '@/components/ui/Feedback'

/**
 * Interactive massing preview surface.
 *
 * The React Three Fiber scene lives in `./MassingCanvas` and is loaded lazily
 * so the three.js bundle only downloads when a 3D surface mounts. This
 * component is the seam: when `@/services/threeModelService` gains a real
 * implementation, replace the lazy scene with a GLTF viewer and keep the
 * props, badge and error boundary as they are.
 */

const MassingCanvas = lazy(() => import('./MassingCanvas'))

interface MassingProps {
  project: Project
  mode?: 'exterior' | 'interior'
  className?: string
}

export function MassingViewer({ project, mode = 'exterior', className = '' }: MassingProps) {
  const [resetKey, setResetKey] = useState(0)
  const label = mode === 'interior' ? 'Interior massing preview' : 'Interactive massing preview'

  return (
    <div className={`relative overflow-hidden bg-[#e8edf2] ${className}`}>
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <Spinner className="h-6 w-6 text-brand-600" />
          </div>
        }
      >
        <MassingCanvas key={`${mode}-${resetKey}`} project={project} mode={mode} />
      </Suspense>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-[10.5px] font-medium text-white/90 backdrop-blur">
        {label} · drag to orbit, scroll to zoom
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

export function MassingViewerSafe({ project, mode, className }: MassingProps) {
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
      <MassingViewer project={project} mode={mode} className={className} />
    </ThreeErrorBoundary>
  )
}
