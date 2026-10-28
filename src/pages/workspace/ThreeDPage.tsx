import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Box, Brush, Layers, Mountain, Plane, Sofa, Square } from 'lucide-react'
import type { FinishOption } from '@/types'
import { useWorkspace } from './WorkspaceLayout'
import { MassingViewerSafe } from '@/components/3d-viewer/MassingViewer'
import { SegmentedControl } from '@/components/ui/FormControls'
import { Button } from '@/components/ui/Button'
import { EXTERIOR_FINISHES, ROOF_TYPES } from '@/data/catalog'

const FINISH_ICONS: Record<FinishOption, React.ReactNode> = {
  render: <Layers className="h-4 w-4" />,
  paint: <Brush className="h-4 w-4" />,
  brick: <Square className="h-4 w-4" />,
  stone: <Mountain className="h-4 w-4" />,
  wood: <Plane className="h-4 w-4" />,
  glass: <Square className="h-4 w-4" />,
}

const CATEGORIES = [
  { icon: <Sofa className="h-4 w-4" />, label: 'Furniture' },
  { icon: <Square className="h-4 w-4" />, label: 'Walls & openings' },
  { icon: <Layers className="h-4 w-4" />, label: 'Roof & structure' },
  { icon: <Mountain className="h-4 w-4" />, label: 'Site & landscape' },
]

export function ThreeDPage() {
  const navigate = useNavigate()
  const { project } = useWorkspace()
  const [mode, setMode] = useState<'exterior' | 'interior'>('exterior')
  const [roof, setRoof] = useState(project.roof)
  const [finish, setFinish] = useState<FinishOption>(project.preferences.exteriorFinish)

  const previewProject = {
    ...project,
    roof,
    preferences: { ...project.preferences, exteriorFinish: finish },
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[1fr_auto] lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-1">
      <section className="relative min-h-0">
        <MassingViewerSafe project={previewProject} mode={mode} className="h-full w-full" />

        <div className="absolute left-3 top-3 flex items-center gap-2">
          <SegmentedControl<'exterior' | 'interior'>
            size="sm"
            options={[
              { value: 'exterior', label: 'Exterior' },
              { value: 'interior', label: 'Interior' },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>

        <Button
          variant="primary"
          className="absolute bottom-3 left-3 shadow-lg"
          onClick={() => navigate('../floor-plan')}
          icon={<ArrowLeft className="h-4 w-4" />}
        >
          Back to editor
        </Button>
      </section>

      <aside className="min-h-0 overflow-y-auto scroll-thin border-t border-line bg-surface p-4 lg:border-l lg:border-t-0">
        <div className="mb-4 flex items-center gap-2">
          <Box className="h-4 w-4 text-brand-600" />
          <h2 className="text-[14px] font-semibold text-ink-text">Materials & view</h2>
        </div>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[12px] font-medium text-ink-text">Roof form</p>
            <div className="flex flex-wrap gap-1.5">
              {ROOF_TYPES.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRoof(option.value)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    roof === option.value
                      ? 'bg-brand-600 text-white'
                      : 'bg-canvas-soft text-muted hover:bg-line/70'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[12px] font-medium text-ink-text">Exterior finish</p>
            <div className="grid grid-cols-3 gap-2">
              {EXTERIOR_FINISHES.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFinish(option.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-[11.5px] font-medium transition-colors ${
                    finish === option.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-line text-muted hover:bg-canvas-soft'
                  }`}
                >
                  {FINISH_ICONS[option.value]}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[12px] font-medium text-ink-text">Element categories</p>
            <div className="space-y-2">
              {CATEGORIES.map((category) => (
                <div
                  key={category.label}
                  className="flex items-center justify-between rounded-lg border border-dashed border-line px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-[12.5px] text-muted">
                    {category.icon}
                    {category.label}
                  </span>
                  <span className="text-[10.5px] font-medium uppercase tracking-wide text-faint">
                    Later
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
              Object libraries (furniture, windows, roofing) plug in with the 3D model service. The
              current viewer shows massing only.
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}
