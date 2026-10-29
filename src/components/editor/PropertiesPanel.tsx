import { useState } from 'react'
import { ChevronsRight, X, Sofa, Ruler, Check } from 'lucide-react'
import type { FinishOption, Room, Units } from '@/types'
import { roomArea } from '@/lib/floorPlan'
import { NumberField } from '@/components/ui/Field'
import { SegmentedControl } from '@/components/ui/FormControls'
import { EmptyState } from '@/components/ui/Feedback'
import { INTERIOR_FINISHES } from '@/data/catalog'
import { Button } from '@/components/ui/Button'
import { Box } from 'lucide-react'

export type PropertyTab = 'room' | 'wall' | 'door' | 'window'

const WALLS = ['North wall', 'East wall', 'South wall', 'West wall']

export interface PropertiesPanelProps {
  room: Room | null
  units: Units
  onClose?: () => void
  onRename?: (id: string, name: string) => void
  onResize?: (id: string, width: number, length: number) => void
  /** Furniture currently placed per room id. */
  placed?: Record<string, string[]>
  onToggleFurniture?: (roomId: string, item: string) => void
  onSetFinish?: (roomId: string, finish: FinishOption) => void
  onViewIn3D?: (roomId: string) => void
  /** Desktop: collapse the panel to a slim strip. */
  onCollapse?: () => void
}

export function PropertiesPanel({
  room,
  units,
  onClose,
  onRename,
  onResize,
  placed = {},
  onToggleFurniture,
  onSetFinish,
  onViewIn3D,
  onCollapse,
}: PropertiesPanelProps) {
  const [tab, setTab] = useState<PropertyTab>('room')
  const placedHere = room ? (placed[room.id] ?? []) : []

  return (
    <div className="flex h-full flex-col bg-surface">
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
            { value: 'room', label: 'Room' },
            { value: 'wall', label: 'Wall' },
            { value: 'door', label: 'Door' },
            { value: 'window', label: 'Window' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin p-4">
        {!room ? (
          <EmptyState
            icon={<Ruler className="h-5 w-5" />}
            title="Nothing selected"
            description="Select a room on the floor plan to see and edit its properties."
          />
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

            <div className="space-y-2.5 rounded-xl border border-line p-3">
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
                    className={`rounded-lg border px-2 py-2 text-left text-[11px] font-medium ${
                      (room.finish ?? 'wood') === finish.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-line text-muted hover:bg-canvas-soft'
                    }`}
                  >
                    {finish.label}
                  </button>
                ))}
              </div>
              <Button size="sm" variant="secondary" className="w-full" onClick={() => onViewIn3D?.(room.id)} icon={<Box className="h-3.5 w-3.5" />}>
                View this room in 3D
              </Button>
            </div>

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
                    const active = placedHere.includes(item)
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
              <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
                Furniture placement is a visual aid in this prototype; real placement arrives with
                the geometry engine.
              </p>
            </div>
          </div>
        ) : (
          <ElementList tab={tab} room={room} units={units} />
        )}
      </div>
    </div>
  )
}

function ElementList({ tab, room, units }: { tab: PropertyTab; room: Room; units: Units }) {
  if (tab === 'wall') {
    return (
      <div className="space-y-2.5">
        {WALLS.map((wall, index) => (
          <div key={wall} className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink-text">{wall}</span>
              <span className="text-[12px] text-muted">
                {index % 2 === 0 ? room.width : room.length} {units}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] text-faint">9 in blockwork · finish follows exterior spec</p>
          </div>
        ))}
        <p className="text-[11.5px] leading-relaxed text-faint">
          Wall editing (openings, thickness, layers) is handled by the geometry engine in a later
          phase — values shown are derived from the room size.
        </p>
      </div>
    )
  }

  const type = tab === 'door' ? 'door' : 'window'
  const elements = room.elements.filter((element) => element.type === type)

  if (elements.length === 0) {
    return (
      <EmptyState
        icon={<Ruler className="h-5 w-5" />}
        title={`No ${type}s on this room`}
        description="Openings are added automatically once the geometry engine is connected."
      />
    )
  }

  return (
    <div className="space-y-2.5">
      {elements.map((element, index) => (
        <div key={element.id} className="rounded-lg border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-text">
              {element.label ?? type} {index + 1}
            </span>
            <span className="text-[12px] text-muted">
              {element.width ?? (type === 'door' ? 3 : 4)} {units} × {element.height ?? (type === 'door' ? 7 : 4)} {units}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-faint">
            {type === 'door' ? 'Solid core, frame per schedule' : 'Aluminium frame, double glazing'}
          </p>
        </div>
      ))}
      <p className="text-[11.5px] leading-relaxed text-faint">
        Sizes are indicative placeholders for the prototype, not a construction schedule.
      </p>
    </div>
  )
}
