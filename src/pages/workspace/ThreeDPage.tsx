import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Box, Brush, Eye, EyeOff, Layers, Mountain, Move, Plane, Scale, Sofa, Square } from 'lucide-react'
import type { FinishOption } from '@/types'
import { useWorkspace } from './WorkspaceLayout'
import { MassingViewerSafe } from '@/components/3d-viewer/MassingViewer'
import { PropertiesPanel } from '@/components/editor/PropertiesPanel'
import { SegmentedControl } from '@/components/ui/FormControls'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EXTERIOR_FINISHES, INTERIOR_FINISHES, ROOF_TYPES } from '@/data/catalog'
import type { PendingPlacement } from '@/data/toolLibrary'

const FINISH_ICONS: Record<FinishOption, React.ReactNode> = {
  render: <Layers className="h-4 w-4" />,
  paint: <Brush className="h-4 w-4" />,
  brick: <Square className="h-4 w-4" />,
  stone: <Mountain className="h-4 w-4" />,
  wood: <Plane className="h-4 w-4" />,
  glass: <Square className="h-4 w-4" />,
  tile: <Square className="h-4 w-4" />,
  marble: <Mountain className="h-4 w-4" />,
  concrete: <Layers className="h-4 w-4" />,
  carpet: <Sofa className="h-4 w-4" />,
  terrazzo: <Box className="h-4 w-4" />,
  metal: <Square className="h-4 w-4" />,
}

function materialSwatch(value: FinishOption): string {
  const patterns: Record<FinishOption, string> = {
    render: 'linear-gradient(135deg,#eeeae3,#d6d1c8)', paint: 'linear-gradient(135deg,#fafafa,#dfe8f0)',
    brick: 'repeating-linear-gradient(0deg,#b97861 0 7px,#eee3d8 8px 9px)', stone: 'repeating-linear-gradient(45deg,#c8c1b2 0 12px,#aaa394 13px,#d7d1c6 15px)',
    wood: 'repeating-linear-gradient(0deg,#c9a97f 0 7px,#8b6747 8px,#d8bc98 9px)', glass: 'linear-gradient(135deg,#d9f0fb 0 40%,#8eb5ca 42%,#e9f8ff 50%,#bfdbe8 62%)',
    tile: 'repeating-linear-gradient(0deg,#e8e4db 0 14px,#89929b 15px,#e8e4db 16px)', marble: 'linear-gradient(135deg,#eee9df,#c2c4c2 42%,#f7f4ed 60%,#d6d1c7)',
    concrete: 'repeating-linear-gradient(45deg,#c4c5c2 0 3px,#b5b7b6 4px,#c7c8c6 6px)', carpet: 'repeating-linear-gradient(90deg,#8a8790 0 2px,#a09da5 3px,#89868e 4px)',
    terrazzo: 'radial-gradient(#6d8794 1px,transparent 2px),radial-gradient(#b87861 1px,transparent 2px),#d6d2c9', metal: 'repeating-linear-gradient(90deg,#87929a 0 5px,#c0c8ce 6px,#87929a 8px)',
  }
  return patterns[value]
}

export function ThreeDPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roomParam = searchParams.get('room')
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
  const [roofVisible, setRoofVisible] = useState(true)
  const [topDown, setTopDown] = useState(false)

  useEffect(() => {
    if (roomParam && ctx.rooms.some((room) => room.id === roomParam)) {
      ctx.selectRoom(roomParam)
      setMode('interior')
    }
  }, [roomParam, ctx.rooms, ctx.selectRoom])

  const placeDropped = (event: React.DragEvent) => {
    const raw = event.dataTransfer.getData('application/x-archnova')
    if (!raw) return
    event.preventDefault()
    try {
      const placement = JSON.parse(raw) as PendingPlacement
      const target = ctx.selectedRoom ?? ctx.rooms[0]
      if (placement.tool === 'interior' && placement.variant.item && target) {
        ctx.placeInterior(target.id, placement.variant.item)
      } else if (placement.tool === 'door' && target) {
        ctx.addOpening(target.id, 'door', placement.variant.label ?? placement.variant.name, { width: placement.variant.w, height: placement.variant.h })
      } else if (placement.tool === 'window' && target) {
        ctx.addOpening(target.id, 'window', placement.variant.label ?? placement.variant.name, { width: placement.variant.w, height: placement.variant.h })
      } else if (placement.tool === 'trees') {
        const bounds = event.currentTarget.getBoundingClientRect()
        const x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * ctx.project.plot.width
        const y = ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * ctx.project.plot.length
        ctx.addTreeAt({ x: Math.max(0, Math.min(ctx.project.plot.width, x)), y: Math.max(0, Math.min(ctx.project.plot.length, y)) }, placement.variant.kind, { width: placement.variant.w, length: placement.variant.h })
      }
    } catch { /* ignore invalid library payload */ }
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[1fr_auto] lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-1">
      <section className="relative min-h-0" onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-archnova')) event.preventDefault() }} onDrop={placeDropped}>
        <MassingViewerSafe
          project={previewProject}
          mode={mode}
          roofVisible={roofVisible}
          topDown={topDown && mode === 'exterior'}
          className="h-full w-full"
          selectedId={ctx.selectedRoomId}
          onSelectRoom={ctx.selectRoom}
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
          selectedItemId={ctx.selectedItemId}
          onSelectItem={ctx.selectItem}
          selectedSiteId={ctx.selectedSiteId}
          onSelectSite={ctx.selectSite}
          onUpdateSiteLive={(id, x, y, scale) => ctx.liveEdit((state) => ({ ...state, ornaments: state.ornaments.map((site) => site.id === id ? { ...site, x, y, scale } : site) }))}
          onUpdatePlacedItem={(roomId, itemId, patch) => ctx.liveEdit((state) => {
            const items = (state.placed[roomId] ?? []).map((item) => item.id === itemId ? { ...item, ...patch } : item)
            return { ...state, placed: { ...state.placed, [roomId]: items }, rooms: state.rooms.map((room) => room.id === roomId ? { ...room, items } : room) }
          })}
          pendingItem={mode === 'interior' && ctx.pending?.tool === 'interior' ? ctx.pending.variant.item ?? null : null}
          onPlaceInterior={(item) => {
            const target = ctx.selectedRoom ?? ctx.rooms[0]
            if (target) ctx.placeInterior(target.id, item)
            ctx.setPending(null)
          }}
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
          {mode === 'exterior' ? <>
            <button type="button" onClick={() => { const visible = !roofVisible; setRoofVisible(visible); if (!visible) setTopDown(true) }} className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium ${roofVisible ? 'border-line bg-surface text-muted hover:bg-canvas-soft' : 'border-brand-500 bg-brand-50 text-brand-700'}`} title="Hide the roof to inspect the house from above">
              {roofVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{roofVisible ? 'Hide roof' : 'Show roof'}
            </button>
            <button type="button" onClick={() => setTopDown((value) => !value)} className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium ${topDown ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-surface text-muted hover:bg-canvas-soft'}`} title="View the home from directly above">Top view</button>
          </> : null}
          {selectedRoom ? (
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

        {selectedRoom ? (
          <div className="absolute left-3 top-14 flex items-center gap-2 rounded-lg bg-surface/95 px-3 py-2 shadow-sm ring-1 ring-line">
            <span className="text-[12.5px] font-medium text-ink-text">{selectedRoom.name}</span>
            <span className="text-[11.5px] text-muted">
              {selectedRoom.width} × {selectedRoom.length} {ctx.units}
            </span>
            <Badge tone="brand">{mode === 'interior' ? 'Room selected' : transformMode === 'translate' ? 'Dragging moves' : 'Dragging resizes'}</Badge>
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

        {selectedRoom || ctx.selectedSite ? (
          <div className="mb-5 h-[min(58vh,620px)] min-h-[320px] overflow-hidden rounded-xl border border-line">
            <PropertiesPanel
              room={selectedRoom}
              units={ctx.units}
              onClose={() => { ctx.selectItem(null); ctx.selectSite(null); ctx.selectRoom(null) }}
              onRename={ctx.renameRoom}
              onResize={ctx.resizeRoom}
              onSetShape={ctx.setRoomShape}
              wallThicknesses={ctx.wallThicknesses}
              onSetWallThickness={ctx.setWallThickness}
              walls={ctx.walls}
              openings={ctx.openings}
              placed={ctx.placed}
              selectedItem={ctx.selectedItem}
              selectedItemRoomId={ctx.selectedItemRoomId}
              selectedSite={ctx.selectedSite}
              onUpdateSite={ctx.updateOrnament}
              onRemoveSite={ctx.removeOrnament}
              onSelectItem={ctx.selectItem}
              onUpdatePlacedItem={ctx.updatePlacedItem}
              onRemovePlacedItem={ctx.removePlacedItem}
              onDuplicatePlacedItem={ctx.duplicatePlacedItem}
              onUpdateRoomElement={ctx.updateRoomElement}
              onRemoveRoomElement={ctx.removeRoomElement}
              onToggleFurniture={ctx.toggleFurniture}
              showRoomFinish={false}
            />
          </div>
        ) : (
          <div className="mb-5 rounded-xl border border-dashed border-line px-3 py-5 text-center text-[11.5px] text-muted">
            Select a room in the 3D view to inspect its details and actual elements.
          </div>
        )}

        {mode === 'interior' ? (
          <div className="mb-5">
            <p className="mb-2 text-[12px] font-medium text-ink-text">Navigate rooms</p>
            <div className="grid grid-cols-2 gap-1.5">
              {ctx.rooms.map((room) => (
                <button key={room.id} onClick={() => ctx.selectRoom(room.id)} className={`truncate rounded-lg border px-2.5 py-2 text-left text-[11.5px] font-medium ${selectedRoom?.id === room.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-muted hover:bg-canvas-soft'}`}>
                  {room.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">Drag on the view to orbit, scroll to zoom, and select a room to move through the home. Drag a library item over the room to add it.</p>
          </div>
        ) : null}

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
            <label className="mt-2 flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[11px] font-medium text-muted">Roof color<input type="color" value={ctx.previewRoofColor} onChange={(event) => ctx.setPreviewRoofColor(event.target.value)} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
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
                  <span className="h-8 w-full rounded-md border border-black/10" style={{ background: materialSwatch(option.value) }} />
                  <span className="flex items-center gap-1">{FINISH_ICONS[option.value]}{option.label}</span>
                </button>
              ))}
            </div>
            <label className="mt-2 flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[11px] font-medium text-muted">Wall color<input type="color" value={ctx.previewExtColor} onChange={(event) => ctx.setPreviewExtColor(event.target.value)} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
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
                  <span className="h-8 w-full rounded-md border border-black/10" style={{ background: materialSwatch(option.value) }} />
                  <span className="flex items-center gap-1">{FINISH_ICONS[option.value]}{option.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-faint">
              Applies to the interior preview floor; placed furniture shows inside.
            </p>
          </div>


        </div>
      </aside>
    </div>
  )
}
