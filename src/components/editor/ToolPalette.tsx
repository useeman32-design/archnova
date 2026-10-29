import { useState } from 'react'
import {
  AppWindow,
  Crosshair,
  DoorOpen,
  Hand,
  Home,
  MousePointer2,
  Paintbrush,
  Sofa,
  SquarePlus,
  TreePine,
  type LucideIcon,
} from 'lucide-react'
import type { FinishOption, RoomCategory } from '@/types'
import { useWorkspace, type ToolId } from '@/pages/workspace/WorkspaceLayout'
import { ROOM_OPTIONS, ROOF_TYPES, EXTERIOR_FINISHES, INTERIOR_FINISHES } from '@/data/catalog'
import { ASSETS } from '@/data/assets'

const INTERIOR_ITEMS = ASSETS.filter((a) => a.category === 'interior').map((a) => a.name)

const TOOLS: { id: ToolId; icon: LucideIcon; label: string; hint: string; planOnly?: boolean }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', hint: 'Select rooms to inspect and edit' },
  { id: 'pan', icon: Hand, label: 'Pan', hint: 'Drag to move around the plan', planOnly: true },
  { id: 'room', icon: SquarePlus, label: 'Add room', hint: 'Pick a room type, then click the plan to place it', planOnly: true },
  { id: 'door', icon: DoorOpen, label: 'Door', hint: 'Click a room to add a door opening', planOnly: true },
  { id: 'window', icon: AppWindow, label: 'Window', hint: 'Click a room to add a window', planOnly: true },
  { id: 'roof', icon: Home, label: 'Roof', hint: 'Choose the roof form for the 3D preview' },
  { id: 'interior', icon: Sofa, label: 'Interior', hint: 'Pick an item, then click a room to place it', planOnly: true },
  { id: 'trees', icon: TreePine, label: 'Trees', hint: 'Click the plan to plant a tree', planOnly: true },
  { id: 'finish', icon: Paintbrush, label: 'Finishes', hint: 'Exterior & interior materials for the preview' },
  { id: 'measure', icon: Crosshair, label: 'Measure', hint: 'Click two points to read a distance', planOnly: true },
]

const GROUP_BREAKS = new Set<ToolId>(['room', 'interior', 'finish', 'measure'])

export function ToolPalette() {
  const ctx = useWorkspace()
  const [picker, setPicker] = useState<ToolId | null>(null)
  const is2D = ctx.canvasView === '2D' && ctx.showProperties

  const activate = (tool: ToolId) => {
    if (tool === 'room' || tool === 'roof' || tool === 'interior' || tool === 'finish') {
      setPicker(picker === tool ? null : tool)
      ctx.setTool(tool)
      return
    }
    setPicker(null)
    ctx.setTool(tool)
  }

  return (
    <div className="relative flex shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-2 w-12">
      {TOOLS.map((tool) => {
        const disabled = tool.planOnly && !is2D
        const active = ctx.tool === tool.id
        return (
          <div key={tool.id} className="contents">
            {GROUP_BREAKS.has(tool.id) ? (
              <span className="my-1 h-px w-6 bg-line" aria-hidden />
            ) : null}
            <button
              type="button"
              disabled={disabled}
              onClick={() => activate(tool.id)}
              title={`${tool.label} — ${tool.hint}${disabled ? ' (2D view only)' : ''}`}
              aria-pressed={active}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                active
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                  : disabled
                    ? 'text-line'
                    : 'text-muted hover:bg-canvas-soft hover:text-ink-text'
              }`}
            >
              <tool.icon className="h-[18px] w-[18px]" />
            </button>
          </div>
        )
      })}

      {picker ? (
        <div className="absolute left-full top-8 z-40 ml-2 w-60 rounded-xl border border-line bg-surface p-3 shadow-xl animate-fade-in">
          {picker === 'room' ? (
            <PickerList
              title="Room type"
              options={ROOM_OPTIONS.map((r) => ({ value: r.value as string, label: r.label }))}
              onPick={(value) => {
                ctx.setPendingRoom(value as RoomCategory)
                setPicker(null)
              }}
            />
          ) : null}
          {picker === 'roof' ? (
            <PickerList
              title="Roof form"
              options={ROOF_TYPES.map((r) => ({ value: r.value, label: r.label }))}
              current={ctx.previewRoof}
              onPick={(value) => {
                ctx.setPreviewRoof(value)
                ctx.setTool('select')
                setPicker(null)
              }}
            />
          ) : null}
          {picker === 'interior' ? (
            <PickerList
              title="Interior item"
              options={INTERIOR_ITEMS.map((name) => ({ value: name, label: name }))}
              onPick={(value) => {
                ctx.setPendingInterior(value)
                setPicker(null)
              }}
            />
          ) : null}
          {picker === 'finish' ? (
            <div className="space-y-3">
              <SwatchRow
                title="Exterior"
                options={EXTERIOR_FINISHES}
                current={ctx.previewExt}
                onPick={(value) => ctx.setPreviewExt(value as FinishOption)}
              />
              <SwatchRow
                title="Interior"
                options={INTERIOR_FINISHES}
                current={ctx.previewInt}
                onPick={(value) => ctx.setPreviewInt(value as FinishOption)}
              />
              <button
                onClick={() => {
                  ctx.setTool('select')
                  setPicker(null)
                }}
                className="w-full rounded-lg bg-canvas-soft px-3 py-1.5 text-[12px] font-medium text-muted hover:text-ink-text"
              >
                Done
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function PickerList({
  title,
  options,
  current,
  onPick,
}: {
  title: string
  options: { value: string; label: string }[]
  current?: string
  onPick: (value: string) => void
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto scroll-thin">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onPick(option.value)}
            className={`rounded-lg px-2 py-1.5 text-left text-[12px] font-medium transition-colors ${
              current === option.value
                ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300'
                : 'bg-canvas-soft text-muted hover:text-ink-text'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SwatchRow({
  title,
  options,
  current,
  onPick,
}: {
  title: string
  options: { value: string; label: string }[]
  current: string
  onPick: (value: string) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onPick(option.value)}
            className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
              current === option.value
                ? 'bg-brand-600 text-white'
                : 'bg-canvas-soft text-muted hover:text-ink-text'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
