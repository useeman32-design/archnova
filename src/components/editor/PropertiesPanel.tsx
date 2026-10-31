import { useEffect, useState } from 'react'
import { ChevronsRight, X, Sofa, Ruler, Check, Trash2, Move3D, Copy } from 'lucide-react'
import type { ArchitecturalWall, Element, FinishOption, PlacedItem, Room, RoomShape, Units, Vec2, WallOpening } from '@/types'
import { roomArea } from '@/lib/floorPlan'
import { getFurnitureDimensions, validateFurniture, type FurnitureIssue } from '@/lib/furniture'
import { validateOpenings, wallLength } from '@/lib/architecturalModel'
import { NumberField } from '@/components/ui/Field'
import { SegmentedControl } from '@/components/ui/FormControls'
import { EmptyState } from '@/components/ui/Feedback'
import { INTERIOR_FINISHES } from '@/data/catalog'
import { Button } from '@/components/ui/Button'
import { Box } from 'lucide-react'
import { ASSET_LOOKUP } from '@/data/toolLibrary'
import { LazyAssetPreview } from '@/components/assets/RealAssetModel'

export type PropertyTab = 'room' | 'elements' | 'wall' | 'door' | 'window'

const WALLS = ['North wall', 'East wall', 'South wall', 'West wall']

function openingWidthDefault(units: Units, type: 'door' | 'window'): number {
  return units === 'ft' ? (type === 'door' ? 3 : 4) : (type === 'door' ? 0.9 : 1.2)
}

function openingHeightDefault(units: Units, type: 'door' | 'window'): number {
  return units === 'ft' ? (type === 'door' ? 7 : 4) : (type === 'door' ? 2.1 : 1.2)
}

export interface PropertiesPanelProps {
  room: Room | null
  units: Units
  onClose?: () => void
  onRename?: (id: string, name: string) => void
  onResize?: (id: string, width: number, length: number) => void
  wallThicknesses?: { exterior: number; interior: number }
  walls?: ArchitecturalWall[]
  openings?: WallOpening[]
  onSetWallThickness?: (kind: 'exterior' | 'interior', value: number) => void
  onSetShape?: (id: string, shape: RoomShape, outline?: Vec2[]) => void
  /** Furniture currently placed per room id. */
  placed?: Record<string, PlacedItem[]>
  selectedItem?: PlacedItem | null
  selectedItemRoomId?: string | null
  selectedSite?: { id: string; assetId?: string; kind?: string; x: number; y: number; scale: number; rotation: number; color: string; width?: number; length?: number } | null
  onUpdateSite?: (id: string, patch: Partial<{ x: number; y: number; scale: number; rotation: number; color: string; width: number; length: number }>) => void
  onRemoveSite?: (id: string) => void
  onDuplicateSite?: (id: string) => void
  onSelectItem?: (id: string | null) => void
  onUpdatePlacedItem?: (roomId: string, itemId: string, patch: Partial<PlacedItem>) => void
  onRemovePlacedItem?: (roomId: string, itemId: string) => void
  onDuplicatePlacedItem?: (roomId: string, itemId: string) => void
  onUpdateRoomElement?: (roomId: string, elementId: string, patch: Partial<Element>) => void
  onRemoveRoomElement?: (roomId: string, elementId: string) => void
  onToggleFurniture?: (roomId: string, item: string) => void
  onSetFinish?: (roomId: string, finish: FinishOption, color?: string) => void
  onViewIn3D?: (roomId: string) => void
  /** Hide the room-specific finish control when a global interior finish is used. */
  showRoomFinish?: boolean
  /** Desktop: collapse the panel to a slim strip. */
  onCollapse?: () => void
}

export function PropertiesPanel({
  room,
  units,
  onClose,
  onRename,
  onResize,
  wallThicknesses = { exterior: units === 'ft' ? 0.75 : 0.23, interior: units === 'ft' ? 0.375 : 0.12 },
  walls = [],
  openings = [],
  onSetWallThickness,
  onSetShape,
  placed = {},
  selectedItem = null,
  selectedItemRoomId = null,
  selectedSite = null,
  onUpdateSite,
  onRemoveSite,
  onDuplicateSite,
  onSelectItem,
  onUpdatePlacedItem,
  onRemovePlacedItem,
  onDuplicatePlacedItem,
  onUpdateRoomElement,
  onRemoveRoomElement,
  onToggleFurniture,
  onSetFinish,
  onViewIn3D,
  showRoomFinish = true,
  onCollapse,
}: PropertiesPanelProps) {
  const [tab, setTab] = useState<PropertyTab>('elements')
  useEffect(() => setTab('elements'), [room?.id])
  const placedHere = room ? (placed[room.id] ?? []) : []

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[14px] font-semibold text-ink-text">Properties</h2>
        <div className="flex items-center gap-1">
          {onCollapse ? (
            <button
              onClick={onCollapse}
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas-soft hover:text-ink-text lg:flex"
              aria-label="Collapse properties panel"
              title="Collapse panel"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          ) : null}
          {onClose ? (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas-soft hover:text-ink-text"
              aria-label="Close properties"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-b border-line px-4 py-2.5">
        <SegmentedControl<PropertyTab>
          fullWidth
          size="sm"
          options={[
            { value: 'room', label: 'Details' },
            { value: 'elements', label: 'Elements' },
            { value: 'wall', label: 'Walls' },
            { value: 'door', label: 'Doors' },
            { value: 'window', label: 'Windows' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin p-4">
        {selectedSite ? (
          <SiteInspector site={selectedSite} onUpdate={onUpdateSite} onRemove={onRemoveSite} onDuplicate={onDuplicateSite} onClose={onClose} units={units} />
        ) : selectedItem && selectedItemRoomId ? (
          <ItemInspector
            item={selectedItem}
            roomId={selectedItemRoomId}
            room={room}
            issues={room ? validateFurniture(room, placed[selectedItemRoomId] ?? [], openings, walls).filter((issue) => issue.itemIds.includes(selectedItem.id)) : []}
            onUpdate={onUpdatePlacedItem}
            onRemove={onRemovePlacedItem}
            onDuplicate={onDuplicatePlacedItem}
            units={units}
            onClose={() => onSelectItem?.(null)}
          />
        ) : !room ? (
          <EmptyState
            icon={<Ruler className="h-5 w-5" />}
            title="Nothing selected"
            description="Select a room on the floor plan to see and edit its properties."
          />
        ) : tab === 'elements' ? (
          <RoomElementsList room={room} placed={placedHere} onOpenTab={setTab} onSelectItem={onSelectItem} onRemoveOpening={onRemoveRoomElement} onRemoveItem={onRemovePlacedItem} />
        ) : tab === 'room' ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2">
              {onRename ? (
                <input
                  value={room.name}
                  onChange={(event) => onRename(room.id, event.target.value)}
                  className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-[15px] font-semibold text-ink-text hover:border-line focus:border-brand-500 focus:outline-none"
                  aria-label="Room name"
                />
              ) : (
                <span className="text-[15px] font-semibold text-ink-text">{room.name}</span>
              )}
              <span className="shrink-0 rounded-md bg-canvas-soft px-2 py-1 text-[11px] font-medium capitalize text-muted">
                {room.category}
              </span>
            </div>

            <div className="space-y-3 rounded-xl border border-line p-3">
              <div>
                <p className="text-[12px] font-semibold text-ink-text">Room shape</p>
                <p className="mt-0.5 text-[11px] text-muted">Choose a preset, then refine the outline with normalized points.</p>
              </div>
              <select
                value={room.shape ?? 'rectangle'}
                onChange={(event) => onSetShape?.(room.id, event.target.value as RoomShape)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12px] text-ink-text"
                aria-label="Room shape"
              >
                <option value="rectangle">Rectangle</option>
                <option value="L">L-shape</option>
                <option value="T">T-shape</option>
                <option value="U">U-shape</option>
                <option value="custom">Custom outline</option>
              </select>
              {(room.shape === 'custom' || room.outline) ? (
                <div className="space-y-2">
                  {(room.outline ?? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]).map((point, index, points) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-10 text-[10px] font-semibold text-muted">Point {index + 1}</span>
                      <label className="flex min-w-0 flex-1 items-center gap-1 text-[10px] text-muted">X
                        <input type="number" min="0" max="1" step="0.01" value={point.x} onChange={(event) => {
                          const next = points.map((p) => ({ ...p })); next[index].x = Math.max(0, Math.min(1, Number(event.target.value)));
                          onSetShape?.(room.id, 'custom', next)
                        }} className="w-full rounded border border-line px-1.5 py-1 text-[11px] text-ink-text" />
                      </label>
                      <label className="flex min-w-0 flex-1 items-center gap-1 text-[10px] text-muted">Y
                        <input type="number" min="0" max="1" step="0.01" value={point.y} onChange={(event) => {
                          const next = points.map((p) => ({ ...p })); next[index].y = Math.max(0, Math.min(1, Number(event.target.value)));
                          onSetShape?.(room.id, 'custom', next)
                        }} className="w-full rounded border border-line px-1.5 py-1 text-[11px] text-ink-text" />
                      </label>
                      <button type="button" disabled={points.length <= 3} onClick={() => onSetShape?.(room.id, 'custom', points.filter((_, i) => i !== index))} className="rounded px-1.5 py-1 text-xs text-muted hover:bg-canvas-soft disabled:opacity-30" aria-label={`Remove point ${index + 1}`}>×</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => {
                    const points = room.outline ?? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
                    const first = points[0], second = points[1];
                    onSetShape?.(room.id, 'custom', [...points.slice(0, 1), { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }, ...points.slice(1)])
                  }} className="w-full rounded-lg border border-dashed border-line py-1.5 text-[11px] font-medium text-brand-700 hover:bg-brand-50">+ Add outline point</button>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Width"
                min={4}
                max={200}
                step={0.5}
                suffix={units}
                value={room.width}
                onChange={(event) =>
                  onResize?.(room.id, Number(event.target.value), room.length)
                }
              />
              <NumberField
                label="Length"
                min={4}
                max={200}
                step={0.5}
                suffix={units}
                value={room.length}
                onChange={(event) =>
                  onResize?.(room.id, room.width, Number(event.target.value))
                }
              />
            </div>

            {showRoomFinish ? <div className="space-y-2.5 rounded-xl border border-line p-3">
              <div>
                <p className="text-[12px] font-semibold text-ink-text">Room finish</p>
                <p className="mt-0.5 text-[11px] text-muted">Choose a floor material for this room.</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {INTERIOR_FINISHES.map((finish) => (
                  <button
                    key={finish.value}
                    type="button"
                    onClick={() => onSetFinish?.(room.id, finish.value)}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-[11px] font-medium ${
                      (room.finish ?? 'wood') === finish.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-line text-muted hover:bg-canvas-soft'
                    }`}
                  >
                    <span className="h-6 w-7 shrink-0 rounded border border-black/10" style={{ background: finishPreviewPattern(finish.value) }} />
                    {finish.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center justify-between rounded-lg border border-line px-2.5 py-2 text-[11px] font-medium text-muted">
                Finish tint
                <input type="color" value={room.finishColor ?? '#ffffff'} onChange={(event) => onSetFinish?.(room.id, room.finish ?? 'wood', event.target.value)} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Room finish color" />
              </label>
              <Button size="sm" variant="secondary" className="w-full" onClick={() => onViewIn3D?.(room.id)} icon={<Box className="h-3.5 w-3.5" />}>
                Preview room in 3D
              </Button>
            </div> : null}

            <div className="flex items-center justify-between rounded-lg bg-canvas-soft px-3.5 py-3">
              <span className="text-[13px] text-muted">Area</span>
              <span className="text-[14px] font-semibold text-ink-text">
                {roomArea(room).toLocaleString('en-US')}{' '}
                <span className="text-[11px] font-normal text-muted">
                  {units === 'ft' ? 'sq ft' : 'sq m'}
                </span>
              </span>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Sofa className="h-4 w-4 text-brand-600" />
                <span className="text-[13px] font-medium text-ink-text">Furniture</span>
              </div>
              {room.furniture.length === 0 ? (
                <p className="text-[12.5px] text-muted">No furniture suggestions for this space.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {room.furniture.map((item) => {
                    const active = placedHere.some((placedItem) => placedItem.item === itemKey(item))
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => onToggleFurniture?.(room.id, item)}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[12px] font-medium transition-colors ${
                          active
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-line bg-surface text-muted hover:bg-canvas-soft'
                        }`}
                      >
                        {item}
                        {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="mt-4 space-y-2">
                <p className="text-[12px] font-semibold text-ink-text">Placed items <span className="font-normal text-muted">({placedHere.length})</span></p>
                {placedHere.length === 0 ? <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11.5px] text-muted">No items yet. Choose a suggestion or drag an item from the library.</p> : placedHere.map((placedItem) => (
                  <div key={placedItem.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
                    <button type="button" onClick={() => onSelectItem?.(placedItem.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <ObjectPreview item={placedItem.item} color={placedItem.color} />
                      <span className="truncate text-[11.5px] font-medium capitalize text-ink-text">{placedItem.item.replace(/[-_]/g, ' ')}</span>
                    </button>
                    <input type="color" value={placedItem.color} onChange={(event) => onUpdatePlacedItem?.(room.id, placedItem.id, { color: event.target.value })} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={`Change ${placedItem.item} color`} />
                    <button type="button" onClick={() => onRemovePlacedItem?.(room.id, placedItem.id)} aria-label={`Remove ${placedItem.item}`} className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ElementList tab={tab} room={room} units={units} wallThicknesses={wallThicknesses} walls={walls} openings={openings} onSetWallThickness={onSetWallThickness} onUpdate={onUpdateRoomElement} onRemove={onRemoveRoomElement} />
        )}
      </div>
    </div>
  )
}

function RoomElementsList({ room, placed, onOpenTab, onSelectItem, onRemoveOpening, onRemoveItem }: {
  room: Room
  placed: PlacedItem[]
  onOpenTab: (tab: PropertyTab) => void
  onSelectItem?: (id: string | null) => void
  onRemoveOpening?: (roomId: string, elementId: string) => void
  onRemoveItem?: (roomId: string, itemId: string) => void
}) {
  const openings = room.elements.filter((element) => element.type === 'door' || element.type === 'window')
  return <div className="space-y-4">
    <div>
      <div className="mb-2 flex items-center justify-between"><h3 className="text-[12px] font-semibold text-ink-text">Doors & windows</h3><span className="text-[10px] text-muted">{openings.length}</span></div>
      {openings.length ? <div className="space-y-2">{openings.map((element, index) => <div key={element.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
        <ObjectPreview item={element.label ?? element.type} color={element.color ?? (element.type === 'door' ? '#8a6a48' : '#9fd4ee')} />
        <button type="button" onClick={() => onOpenTab(element.type as 'door' | 'window')} className="min-w-0 flex-1 text-left"><span className="block truncate text-[11.5px] font-medium text-ink-text">{element.label || `${element.type} ${index + 1}`}</span><span className="text-[10px] capitalize text-muted">{element.type} · {element.width ?? 'default'} × {element.height ?? 'default'} {room.units} · Edit</span></button>
        <button type="button" onClick={() => onRemoveOpening?.(room.id, element.id)} aria-label={`Remove ${element.label ?? element.type}`} className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>)}</div> : <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11px] text-muted">No doors or windows in this room yet. Choose a window or door in the left library.</p>}
    </div>
    <div>
      <div className="mb-2 flex items-center justify-between"><h3 className="text-[12px] font-semibold text-ink-text">Furniture & appliances</h3><span className="text-[10px] text-muted">{placed.length}</span></div>
      {placed.length ? <div className="space-y-2">{placed.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
        <button type="button" onClick={() => onSelectItem?.(item.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><ObjectPreview item={item.item} color={item.color} assetId={item.assetId} /><span className="min-w-0"><span className="block truncate text-[11.5px] font-medium text-ink-text">{item.assetId ? (ASSET_LOOKUP[item.assetId]?.name ?? item.item.replace(/[-_]/g, ' ')) : item.item.replace(/[-_]/g, ' ')}</span><span className="text-[10px] text-muted">Select to adjust position, size or color</span></span></button>
        <button type="button" onClick={() => onRemoveItem?.(room.id, item.id)} aria-label={`Remove ${item.item}`} className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>)}</div> : <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11px] text-muted">No placed items yet. Add furniture from the Interior library.</p>}
    </div>
  </div>
}

function SiteInspector({ site, onUpdate, onRemove, onDuplicate, onClose, units }: {
  site: { id: string; assetId?: string; kind?: string; x: number; y: number; scale: number; rotation: number; color: string; width?: number; length?: number }
  onUpdate?: (id: string, patch: Partial<{ x: number; y: number; scale: number; rotation: number; color: string; width: number; length: number }>) => void
  onRemove?: (id: string) => void
  onDuplicate?: (id: string) => void
  onClose?: () => void
  units: Units
}) {
  const title = site.assetId ? (ASSET_LOOKUP[site.assetId]?.name ?? (site.kind ?? 'landscape object').replace(/[-_]/g, ' ')) : (site.kind ?? 'landscape object').replace(/[-_]/g, ' ')
  return (
    <div className="space-y-4">
      <ObjectPreview item={site.kind ?? 'tree'} color={site.color} assetId={site.assetId} large />
      <div><p className="text-[15px] font-semibold text-ink-text">{title}</p><p className="mt-1 text-[11.5px] text-muted">Site object · editable placement and scale{site.assetId ? ` · saved catalog ID ${site.assetId}` : ''}</p></div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Plot X" min={0} max={1000} step={0.5} suffix={units} value={Number(site.x.toFixed(2))} onChange={(event) => onUpdate?.(site.id, { x: Number(event.target.value) })} />
        <NumberField label="Plot Y" min={0} max={1000} step={0.5} suffix={units} value={Number(site.y.toFixed(2))} onChange={(event) => onUpdate?.(site.id, { y: Number(event.target.value) })} />
        <NumberField label="Rotation" min={0} max={359} step={5} suffix="°" value={Math.round(site.rotation * 180 / Math.PI)} onChange={(event) => onUpdate?.(site.id, { rotation: Number(event.target.value) * Math.PI / 180 })} />
        <NumberField label="Scale" min={0.35} max={3} step={0.05} value={site.scale} onChange={(event) => onUpdate?.(site.id, { scale: Number(event.target.value) })} />
        {['road', 'path', 'fence', 'gate'].includes(site.kind ?? '') ? <>
          <NumberField label="Width" min={0.1} max={1000} step={units === 'ft' ? 0.5 : 0.1} suffix={units} value={site.width ?? (units === 'ft' ? 4 : 1.2)} onChange={(event) => onUpdate?.(site.id, { width: Number(event.target.value) })} />
          <NumberField label="Length" min={0.1} max={1000} step={units === 'ft' ? 1 : 0.25} suffix={units} value={site.length ?? (units === 'ft' ? 24 : 7.2)} onChange={(event) => onUpdate?.(site.id, { length: Number(event.target.value) })} />
        </> : null}
      </div>
      <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[12px] font-medium text-muted">Object color<input type="color" value={site.color} onChange={(event) => onUpdate?.(site.id, { color: event.target.value })} className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
      <p className="text-[11px] text-muted">Drag the object in the floor plan or use numeric controls to reposition it.</p>
      <div className="flex gap-2"><Button size="sm" variant="secondary" className="flex-1" onClick={onClose}>Done</Button><Button size="sm" variant="secondary" onClick={() => onDuplicate?.(site.id)} icon={<Copy className="h-3.5 w-3.5" />}>Duplicate</Button><Button size="sm" variant="danger" onClick={() => onRemove?.(site.id)} icon={<Trash2 className="h-3.5 w-3.5" />}>Remove</Button></div>
    </div>
  )
}

function ItemInspector({ item, roomId, room, units, issues, onUpdate, onRemove, onDuplicate, onClose }: {
  item: PlacedItem
  roomId: string
  room: Room | null
  units: Units
  issues: FurnitureIssue[]
  onUpdate?: (roomId: string, itemId: string, patch: Partial<PlacedItem>) => void
  onRemove?: (roomId: string, itemId: string) => void
  onDuplicate?: (roomId: string, itemId: string) => void
  onClose: () => void
}) {
  const roomWidth = room?.width ?? 1
  const roomLength = room?.length ?? 1
  const defaults = getFurnitureDimensions(item.item, units)
  const width = item.width ?? defaults.width
  const depth = item.depth ?? defaults.depth
  const height = item.height ?? defaults.height
  const step = units === 'ft' ? 0.25 : 0.05
  return (
    <div className="space-y-4">
      <ObjectPreview item={item.item} color={item.color} assetId={item.assetId} large />
      <div>
        <p className="text-[15px] font-semibold text-ink-text">{item.assetId ? (ASSET_LOOKUP[item.assetId]?.name ?? item.item.replace(/[-_]/g, ' ')) : item.item.replace(/[-_]/g, ' ')}</p>
        <p className="mt-1 text-[11.5px] text-muted">In {room?.name ?? 'selected room'} · editable to scale{item.assetId ? ` · saved catalog ID ${item.assetId}` : ''}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Width" min={units === 'ft' ? 0.5 : 0.15} max={roomWidth} step={step} suffix={units} value={width} onChange={(event) => onUpdate?.(roomId, item.id, { width: Number(event.target.value) })} />
        <NumberField label="Depth" min={units === 'ft' ? 0.5 : 0.15} max={roomLength} step={step} suffix={units} value={depth} onChange={(event) => onUpdate?.(roomId, item.id, { depth: Number(event.target.value) })} />
        <NumberField label="Height" min={units === 'ft' ? 0.5 : 0.15} max={units === 'ft' ? 12 : 3.6} step={step} suffix={units} value={height} onChange={(event) => onUpdate?.(roomId, item.id, { height: Number(event.target.value) })} />
        <NumberField label="Left / right" min={-roomWidth / 2} max={roomWidth / 2} step={step} suffix={units} value={Number((item.x * roomWidth).toFixed(2))} onChange={(event) => onUpdate?.(roomId, item.id, { x: Math.max(-0.48, Math.min(0.48, Number(event.target.value) / roomWidth)) })} />
        <NumberField label="Front / back" min={-roomLength / 2} max={roomLength / 2} step={step} suffix={units} value={Number((item.z * roomLength).toFixed(2))} onChange={(event) => onUpdate?.(roomId, item.id, { z: Math.max(-0.48, Math.min(0.48, Number(event.target.value) / roomLength)) })} />
        <NumberField label="Rotation" min={0} max={359} step={5} suffix="°" value={Math.round(item.rotation * 180 / Math.PI)} onChange={(event) => onUpdate?.(roomId, item.id, { rotation: Number(event.target.value) * Math.PI / 180 })} />
        <NumberField label="Scale" min={0.35} max={2.5} step={0.05} value={item.scale} onChange={(event) => onUpdate?.(roomId, item.id, { scale: Number(event.target.value) })} />
      </div>
      {issues.map((issue, index) => <p key={`${issue.code}-${index}`} className={`rounded-md px-2 py-1.5 text-[10.5px] ${issue.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{issue.message}</p>)}
      <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[12px] font-medium text-muted">
        Object color
        <input type="color" value={item.color} onChange={(event) => onUpdate?.(roomId, item.id, { color: event.target.value })} className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0" />
      </label>
      <p className="text-[11px] leading-relaxed text-muted"><Move3D className="mr-1 inline h-3.5 w-3.5" />Drag the 2D footprint or 3D gizmo to move this item. Dimensions are stored in project units.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={onClose}>Done</Button>
        <Button size="sm" variant="secondary" onClick={() => onDuplicate?.(roomId, item.id)} icon={<Copy className="h-3.5 w-3.5" />}>Duplicate</Button>
        <Button size="sm" variant="danger" onClick={() => onRemove?.(roomId, item.id)} icon={<Trash2 className="h-3.5 w-3.5" />}>Remove</Button>
      </div>
    </div>
  )
}

function ObjectPreview({ item, color, assetId, large = false }: { item: string; color: string; assetId?: string; large?: boolean }) {
  const key = item.toLowerCase()
  if (assetId) return <LazyAssetPreview assetId={assetId} className={`rounded-xl border border-line ${large ? 'h-36 w-full' : 'h-10 w-12'}`} />
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-gradient-to-br from-[#f5f7fa] to-[#e7ebf0] ${large ? 'h-36 w-full' : 'h-10 w-12'}`}>
      <svg viewBox="0 0 120 80" className={large ? 'h-32 w-48' : 'h-8 w-10'} aria-label={`${item} model preview`}>
        <ellipse cx="60" cy="67" rx="43" ry="7" fill="#203044" opacity=".12" />
        {key.includes('bed') ? <g><rect x="27" y="29" width="66" height="34" rx="5" fill={color} /><rect x="32" y="34" width="25" height="14" rx="4" fill="#fff" /><rect x="59" y="34" width="29" height="25" rx="3" fill="#e6e9ed" /><rect x="24" y="25" width="72" height="5" rx="2" fill="#8b6647" /></g>
          : key.includes('sofa') || key.includes('chair') ? <g><rect x="23" y="38" width="74" height="24" rx="8" fill={color} /><rect x="28" y="24" width="64" height="23" rx="8" fill={color} /><rect x="19" y="38" width="11" height="22" rx="5" fill="#6b7786" /><rect x="90" y="38" width="11" height="22" rx="5" fill="#6b7786" /></g>
          : key.includes('table') || key.includes('dining') ? <g><path d="M30 34h60l-8 9H38z" fill={color} /><path d="M42 42v22m35-22v22" stroke="#74583e" strokeWidth="5" /></g>
          : key.includes('window') ? <g><rect x="27" y="16" width="66" height="48" rx="3" fill="#e9f5fb" stroke="#536a7b" strokeWidth="5" /><path d="M60 18v44M29 40h62" stroke="#fff" strokeWidth="4" /></g>
          : key.includes('door') || key.includes('gate') ? <g><rect x="38" y="12" width="44" height="56" rx="3" fill={color} stroke="#57422e" strokeWidth="4" /><circle cx="72" cy="42" r="3" fill="#e1c078" /></g>
          : key.includes('tree') || key.includes('palm') ? <g><path d="M58 60l3-35" stroke="#78563a" strokeWidth="8" /><circle cx="60" cy="22" r="17" fill={color} /><circle cx="47" cy="28" r="11" fill={color} /><circle cx="74" cy="28" r="11" fill={color} /></g>
          : <g><rect x="33" y="32" width="54" height="30" rx="5" fill={color} /><path d="M42 32l8-12h20l9 12" fill="#a9c9d9" stroke="#748696" strokeWidth="3" /><circle cx="45" cy="64" r="7" fill="#303944" /><circle cx="77" cy="64" r="7" fill="#303944" /></g>}
      </svg>
    </div>
  )
}

function finishPreviewPattern(finish: FinishOption): string {
  const patterns: Record<FinishOption, string> = {
    render: 'linear-gradient(135deg,#eeeae3 25%,#ddd8d0 25%,#ddd8d0 50%,#eeeae3 50%,#eeeae3 75%,#ddd8d0 75%)',
    paint: 'linear-gradient(135deg,#f7f5ef,#d9e3eb)', brick: 'repeating-linear-gradient(0deg,#b97861 0 8px,#eee3d8 8px 10px)',
    stone: 'repeating-linear-gradient(45deg,#c8c1b2 0 14px,#aaa394 15px,#d7d1c6 17px)', wood: 'repeating-linear-gradient(0deg,#c9a97f 0 7px,#8b6747 8px,#d8bc98 9px)',
    glass: 'linear-gradient(135deg,#d9f0fb 0 40%,#8eb5ca 42%,#e9f8ff 50%,#bfdbe8 62%)',
    tile: 'repeating-linear-gradient(0deg,#e8e4db 0 14px,#89929b 15px,#e8e4db 16px),repeating-linear-gradient(90deg,transparent 0 14px,#89929b 15px,transparent 16px)',
    marble: 'linear-gradient(135deg,#eee9df,#c2c4c2 42%,#f7f4ed 60%,#d6d1c7)',
    concrete: 'repeating-linear-gradient(45deg,#c4c5c2 0 3px,#b5b7b6 4px,#c7c8c6 6px)',
    carpet: 'repeating-linear-gradient(90deg,#8a8790 0 2px,#a09da5 3px,#89868e 4px)',
    terrazzo: 'radial-gradient(#6d8794 1px,transparent 2px),radial-gradient(#b87861 1px,transparent 2px),#d6d2c9',
    metal: 'repeating-linear-gradient(90deg,#87929a 0 5px,#c0c8ce 6px,#87929a 8px)',
  }
  return patterns[finish]
}

function itemKey(value: string): string {
  const lower = value.toLowerCase()
  if (lower.includes('bed')) return 'bed'
  if (lower.includes('sofa')) return 'sofa'
  if (lower.includes('armchair')) return 'armchair'
  if (lower.includes('wardrobe')) return 'wardrobe'
  if (lower.includes('table')) return 'table'
  if (lower.includes('chair')) return 'chair'
  if (lower.includes('tv')) return 'tv'
  if (lower.includes('fridge')) return 'fridge'
  if (lower.includes('lamp') || lower.includes('light')) return 'lamp'
  if (lower.includes('fan')) return 'fan'
  if (lower.includes('ac')) return 'ac'
  if (lower.includes('bath') || lower.includes('shower') || lower.includes('toilet')) return 'bath'
  if (lower.includes('desk')) return 'desk'
  if (lower.includes('kitchen') || lower.includes('cabinet')) return 'kitchen'
  if (lower.includes('dining')) return 'dining'
  return lower.replace(/\s+/g, '-')
}

function ElementList({ tab, room, units, wallThicknesses, walls, openings, onSetWallThickness, onUpdate, onRemove }: {
  tab: PropertyTab
  room: Room
  units: Units
  wallThicknesses: { exterior: number; interior: number }
  walls: ArchitecturalWall[]
  openings: WallOpening[]
  onSetWallThickness?: (kind: 'exterior' | 'interior', value: number) => void
  onUpdate?: (roomId: string, elementId: string, patch: Partial<Element>) => void
  onRemove?: (roomId: string, elementId: string) => void
}) {
  if (tab === 'wall') {
    return (
      <div className="space-y-2.5">
        {WALLS.map((wall, index) => (
          <div key={wall} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
            <span className="text-[12.5px] font-medium text-ink-text">{wall}</span>
            <span className="text-[12px] text-muted">{index % 2 === 0 ? room.width : room.length} {units}</span>
          </div>
        ))}
        <div className="space-y-3 rounded-xl border border-line p-3">
          <div>
            <p className="text-[12px] font-semibold text-ink-text">Default wall thickness</p>
            <p className="mt-0.5 text-[10.5px] text-muted">Applies to exterior and shared interior walls in both views.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Exterior" min={units === 'ft' ? 0.1 : 0.03} max={units === 'ft' ? 2 : 0.6} step={units === 'ft' ? 0.125 : 0.025} suffix={units} value={wallThicknesses.exterior} onChange={(event) => onSetWallThickness?.('exterior', Number(event.target.value))} />
            <NumberField label="Interior" min={units === 'ft' ? 0.1 : 0.03} max={units === 'ft' ? 2 : 0.6} step={units === 'ft' ? 0.125 : 0.025} suffix={units} value={wallThicknesses.interior} onChange={(event) => onSetWallThickness?.('interior', Number(event.target.value))} />
          </div>
        </div>
      </div>
    )
  }

  const type = tab === 'door' ? 'door' : 'window'
  const elements = room.elements.filter((element) => element.type === type)
  const hostWalls = walls.filter((wall) => wall.roomIds.includes(room.id) && wall.level === room.level)
  const issues = validateOpenings(walls, openings)

  if (elements.length === 0) {
    return (
      <EmptyState
        icon={<Ruler className="h-5 w-5" />}
        title={`No ${type}s on this room`}
        description={`Use the ${type === 'door' ? 'Door' : 'Window'} tool in the editor palette to place an opening on this room.`}
      />
    )
  }

  return (
    <div className="space-y-2.5">
      {elements.map((element, index) => {
        const opening = openings.find((candidate) => candidate.id === element.id)
        const host = hostWalls.find((wall) => wall.id === opening?.wallId)
        const hostLength = host ? wallLength(host) : 0
        const width = element.width ?? opening?.width ?? openingWidthDefault(units, type)
        const openingIssues = issues.filter((issue) => issue.openingId === element.id)
        return (
          <div key={element.id} className="space-y-2.5 rounded-xl border border-line p-3">
            <div className="flex items-center gap-2">
              <ObjectPreview item={element.label ?? type} color={element.color ?? (type === 'door' ? '#8a6a48' : '#9fd4ee')} />
              <div className="min-w-0 flex-1">
                <input value={element.label ?? `${type} ${index + 1}`} onChange={(event) => onUpdate?.(room.id, element.id, { label: event.target.value })} className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-[12px] font-semibold text-ink-text focus:border-brand-500 focus:outline-none" aria-label={`${type} name`} />
                <p className="text-[10.5px] text-muted">{type === 'door' ? 'Door leaf & frame' : 'Glazed unit & frame'}</p>
              </div>
              <button type="button" onClick={() => onRemove?.(room.id, element.id)} aria-label={`Remove ${type}`} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>

            <label className="block text-[10.5px] font-medium text-muted">Host wall
              <select value={opening?.wallId ?? ''} onChange={(event) => {
                const nextWall = hostWalls.find((candidate) => candidate.id === event.target.value)
                if (!nextWall) return
                const nextLength = wallLength(nextWall)
                const nextWidth = Math.min(width, nextLength)
                onUpdate?.(room.id, element.id, { wallId: nextWall.id, offset: Math.max(0, (nextLength - nextWidth) / 2) })
              }} className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[11.5px] text-ink-text">
                {hostWalls.map((wall) => <option key={wall.id} value={wall.id}>{wall.kind === 'exterior' ? 'Exterior' : 'Interior'} · {wallAxisLabel(wall)} · {wallLength(wall).toFixed(1)} {units}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Width" min={units === 'ft' ? 1 : 0.3} max={Math.max(units === 'ft' ? 1 : 0.3, hostLength)} step={units === 'ft' ? 0.25 : 0.05} suffix={units} value={width} onChange={(event) => {
                const nextWidth = Math.max(0.1, Math.min(hostLength || room.width, Number(event.target.value)))
                const currentOffset = opening?.offset ?? 0
                onUpdate?.(room.id, element.id, { width: nextWidth, offset: Math.min(currentOffset, Math.max(0, hostLength - nextWidth)) })
              }} />
              <NumberField label="Height" min={units === 'ft' ? 1 : 0.3} max={units === 'ft' ? 10 : 3} step={units === 'ft' ? 0.25 : 0.05} suffix={units} value={element.height ?? opening?.height ?? openingHeightDefault(units, type)} onChange={(event) => onUpdate?.(room.id, element.id, { height: Number(event.target.value) })} />
            </div>

            {type === 'door' ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10.5px] font-medium text-muted">Door type
                  <select value={element.doorStyle ?? opening?.style ?? 'single-hinged'} onChange={(event) => onUpdate?.(room.id, element.id, { doorStyle: event.target.value as Element['doorStyle'] })} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-[11px] text-ink-text">
                    <option value="single-hinged">Single hinged</option><option value="double-hinged">Double hinged</option><option value="sliding">Sliding</option><option value="pocket">Pocket</option><option value="folding">Folding</option>
                  </select>
                </label>
                <label className="block text-[10.5px] font-medium text-muted">Swing
                  <select value={element.openingDirection ?? opening?.direction ?? 'inward'} onChange={(event) => onUpdate?.(room.id, element.id, { openingDirection: event.target.value as Element['openingDirection'] })} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-[11px] text-ink-text">
                    <option value="inward">Inward</option><option value="outward">Outward</option>
                  </select>
                </label>
                <label className="col-span-2 block text-[10.5px] font-medium text-muted">Hinge side
                  <select value={element.hingeSide ?? opening?.hingeSide ?? 'left'} onChange={(event) => onUpdate?.(room.id, element.id, { hingeSide: event.target.value as Element['hingeSide'] })} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-[11px] text-ink-text">
                    <option value="left">Left jamb</option><option value="right">Right jamb</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10.5px] font-medium text-muted">Window type
                  <select value={element.windowStyle ?? opening?.style ?? 'sliding'} onChange={(event) => onUpdate?.(room.id, element.id, { windowStyle: event.target.value as Element['windowStyle'] })} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-[11px] text-ink-text">
                    <option value="casement">Casement</option><option value="sliding">Sliding</option><option value="bay">Bay</option><option value="fixed">Fixed</option>
                  </select>
                </label>
                <NumberField label="Sill height" min={0} max={units === 'ft' ? 8 : 2.4} step={units === 'ft' ? 0.25 : 0.05} suffix={units} value={element.sillHeight ?? opening?.sillHeight ?? (units === 'ft' ? 3 : 0.9)} onChange={(event) => onUpdate?.(room.id, element.id, { sillHeight: Number(event.target.value) })} />
              </div>
            )}

            <NumberField label="Offset from wall start" min={0} max={Math.max(0, hostLength - width)} step={units === 'ft' ? 0.25 : 0.05} suffix={units} value={element.offset ?? opening?.offset ?? 0} onChange={(event) => onUpdate?.(room.id, element.id, { offset: Number(event.target.value), wallId: opening?.wallId })} />
            {openingIssues.map((issue) => <p key={issue.code} className={`rounded-md px-2 py-1.5 text-[10.5px] ${issue.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{issue.message}</p>)}
            <label className="flex items-center justify-between text-[11px] font-medium text-muted">Frame / panel color <input type="color" value={element.color ?? (type === 'door' ? '#8a6a48' : '#9fd4ee')} onChange={(event) => onUpdate?.(room.id, element.id, { color: event.target.value })} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
          </div>
        )
      })}
    </div>
  )
}

function wallAxisLabel(wall: ArchitecturalWall): string {
  const dx = Math.abs(wall.end.x - wall.start.x)
  const dy = Math.abs(wall.end.y - wall.start.y)
  return dx >= dy ? 'Horizontal' : 'Vertical'
}
