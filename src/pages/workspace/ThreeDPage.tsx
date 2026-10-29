import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Box, Brush, Layers, Mountain, Move, Plane, Scale, Sofa, Square } from 'lucide-react'
import type { FinishOption } from '@/types'
import { useWorkspace } from './WorkspaceLayout'
import { MassingViewerSafe } from '@/components/3d-viewer/MassingViewer'
import { SegmentedControl } from '@/components/ui/FormControls'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EXTERIOR_FINISHES, INTERIOR_FINISHES, ROOF_TYPES } from '@/data/catalog'

const FINISH_ICONS: Record<FinishOption, React.ReactNode> = {
  render: <Layers className="h-4 w-4" />,
  paint: <Brush className="h-4 w-4" />,
  brick: <Square className="h-4 w-4" />,
  stone: <Mountain className="h-4 w-4" />,
  wood: <Plane className="h-4 w-4" />,
  glass: <Square className="h-4 w-4" />,
}

const CATEGORIES = [
  { icon: <Sofa className="h-4 w-4" />, label: 'Furniture', note: 'Interior tool' },
  { icon: <Square className="h-4 w-4" />, label: 'Walls & openings', note: 'Door / Window tools' },
  { icon: <Layers className="h-4 w-4" />, label: 'Roof & structure', note: 'Roof tool' },
  { icon: <Mountain className="h-4 w-4" />, label: 'Site & landscape', note: 'Trees tool' },
]

export function ThreeDPage() {
  const navigate = useNavigate()
  const ctx = useWorkspace()
  const {
    previewProject,
    previewRoof: roof,
    setPreviewRoof: setRoof,
    previewExt: finish,
    setPreviewExt: setFinish,
    previewInt: interior,
    setPreviewInt: setInterior,
    selectedRoom,
  } = ctx
  const [mode, setMode] = useState<'exterior' | 'interior'>('exterior')
  const [transformMode, setTransformMode] = useState<'translate' | 'scale'>('translate')

  return (
    <div className="grid h-full min-h-0 grid-rows-[1fr_auto] lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-1">
      <section className="relative min-h-0">
        <MassingViewerSafe
          project={previewProject}
          mode={mode}
          className="h-full w-full"
          selectedId={mode === 'exterior' ? ctx.selectedRoomId : null}
          onSelectRoom={mode === 'exterior' ? ctx.selectRoom : undefined}
          transformMode={transformMode}
          onMoveLive={(id, x, y) =>
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
                room.id === id ? { ...room, width: w, length: h, rect: { ...room.rect, w, h } } : room,
              ),
            }))
          }
          onEditBegin={ctx.beginEdit}
          onEditEnd={ctx.endEdit}
          ornaments={ctx.ornaments}
          placed={ctx.placed}
        />

        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          <SegmentedControl<'exterior' | 'interior'>
            size="sm"
            options={[
              { value: 'exterior', label: 'Exterior' },
              { value: 'interior', label: 'Interior' },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === 'exterior' && selectedRoom ? (
            <SegmentedControl<'translate' | 'scale'>
              size="sm"
              options={[
                { value: 'translate', label: 'Move', icon: <Move className="h-3.5 w-3.5" /> },
                { value: 'scale', label: 'Scale', icon: <Scale className="h-3.5 w-3.5" /> },
              ]}
              value={transformMode}
              onChange={setTransformMode}
            />
          ) : null}
        </div>

        {mode === 'exterior' && selectedRoom ? (
          <div className="absolute left-3 top-14 flex items-center gap-2 rounded-lg bg-surface/95 px-3 py-2 shadow-sm ring-1 ring-line">
            <span className="text-[12.5px] font-medium text-ink-text">{selectedRoom.name}</span>
            <span className="text-[11.5px] text-muted">
              {selectedRoom.width} × {selectedRoom.length} {ctx.units}
            </span>
            <Badge tone="brand">{transformMode === 'translate' ? 'Dragging moves' : 'Dragging resizes'}</Badge>
          </div>
        ) : null}

        <Button
          variant="primary"
          className="absolute bottom-3 left-3 shadow-lg"
          onClick={() => navigate('../')}
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
            <p className="mb-2 text-[12px] font-medium text-ink-text">Interior finish</p>
            <div className="grid grid-cols-3 gap-2">
              {INTERIOR_FINISHES.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setInterior(option.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-[11.5px] font-medium transition-colors ${
                    interior === option.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-line text-muted hover:bg-canvas-soft'
                  }`}
                >
                  {FINISH_ICONS[option.value]}
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-faint">
              Applies to the interior preview floor; placed furniture shows inside.
            </p>
          </div>

          <div>
            <p className="mb-2 text-[12px] font-medium text-ink-text">Element categories</p>
            <div className="space-y-2">
              {CATEGORIES.map((category) => (
                <div
                  key={category.label}
                  className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-[12.5px] text-muted">
                    {category.icon}
                    {category.label}
                  </span>
                  <span className="text-[10.5px] font-medium uppercase tracking-wide text-brand-700">
                    {category.note}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
              Everything you place with the left-hand tools appears here: rooms as volumes, trees
              on the site, furniture in the interior. Full object libraries plug in with the 3D
              model service.
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}
