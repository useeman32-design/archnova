import { useState, type DragEvent } from 'react'
import {
  AppWindow,
  Armchair,
  Bath,
  BedDouble,
  Box,
  Car,
  ChevronLeft,
  Crosshair,
  DoorClosed,
  DoorOpen,
  Fence,
  Flower2,
  Hand,
  Home,
  Lamp,
  Laptop,
  Monitor,
  MousePointer2,
  Paintbrush,
  Refrigerator,
  Sofa,
  Sprout,
  TreePalm,
  TreePine,
  Trees,
  Umbrella,
  Utensils,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import type { FinishOption } from '@/types'
import type { ToolId, WorkspaceContext } from '@/pages/workspace/WorkspaceLayout'
import { TOOL_GROUPS, type ToolVariant } from '@/data/toolLibrary'
import { ROOF_TYPES, EXTERIOR_FINISHES, INTERIOR_FINISHES } from '@/data/catalog'
import { LazyAssetPreview } from '@/components/assets/RealAssetModel'

const ICONS: Record<string, LucideIcon> = {
  BedDouble, Sofa, Laptop, UtensilsCrossed, Utensils, Box, Bath, Car, Umbrella, Waves,
  DoorOpen, DoorClosed, Fence, AppWindow, Armchair, Monitor, Lamp, Refrigerator,
  TreePalm, TreePine, Sprout, Flower2, Trees,
}

const PALETTE: { id: ToolId; icon: LucideIcon; label: string; hint: string; planOnly?: boolean; group?: boolean }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select / move', hint: 'Select, drag and resize rooms' },
  { id: 'pan', icon: Hand, label: 'Pan', hint: 'Drag to move around the plan', planOnly: true },
  { id: 'room', icon: Box, label: 'Rooms', hint: 'Room library — click or drag onto the plan', planOnly: true, group: true },
  { id: 'door', icon: DoorOpen, label: 'Doors & gates', hint: 'Place on a selected room in 2D or 3D', group: true },
  { id: 'window', icon: AppWindow, label: 'Windows', hint: 'Place on a selected room in 2D or 3D', group: true },
  { id: 'interior', icon: Sofa, label: 'Interior', hint: 'Click a room in 2D, or drop items into the 3D view', group: true },
  { id: 'trees', icon: TreePine, label: 'Site objects', hint: 'Planting, cars and scale figures', group: true },
  { id: 'roof', icon: Home, label: 'Roof', hint: 'Roof forms for the 3D preview', group: true },
  { id: 'finish', icon: Paintbrush, label: 'Finishes', hint: 'Exterior & interior materials', group: true },
  { id: 'measure', icon: Crosshair, label: 'Measure', hint: 'Click two points to read a distance', planOnly: true },
]

const BREAKS = new Set<ToolId>(['room', 'interior', 'roof', 'measure'])

export function ToolPalette({ ctx }: { ctx: WorkspaceContext }) {
  const [drawer, setDrawer] = useState<ToolId | null>(null)
  const planActive = ctx.showProperties

  const click = (entry: (typeof PALETTE)[number]) => {
    if (entry.planOnly && !planActive) return
    ctx.setTool(entry.id)
    setDrawer(entry.group ? entry.id : null)
  }

  return (
    <>
      <div className="relative z-30 flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-2">
        {PALETTE.map((entry) => {
          const disabled = entry.planOnly && !planActive
          const active = ctx.tool === entry.id
          return (
            <div key={entry.id} className="contents">
              {BREAKS.has(entry.id) ? <span className="my-1 h-px w-6 bg-line" aria-hidden /> : null}
              <button
                type="button"
                disabled={disabled}
                onClick={() => click(entry)}
                title={`${entry.label} — ${entry.hint}${disabled ? ' (Floor Plan view only)' : ''}`}
                aria-pressed={active}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  active
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                    : disabled
                      ? 'text-line'
                      : 'text-muted hover:bg-canvas-soft hover:text-ink-text'
                }`}
              >
                <entry.icon className="h-[18px] w-[18px]" />
              </button>
            </div>
          )
        })}
        <div className="mt-auto flex flex-col items-center gap-1 pb-1">
          <button
            type="button"
            onClick={ctx.undo}
            disabled={!ctx.canUndo}
            title="Undo (Ctrl+Z)"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas-soft hover:text-ink-text disabled:opacity-35"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={ctx.redo}
            disabled={!ctx.canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas-soft hover:text-ink-text disabled:opacity-35"
          >
            <UndoIcon flip />
          </button>
        </div>
      </div>

      {drawer ? (
        <ToolDrawer ctx={ctx} tool={drawer} onClose={() => setDrawer(null)} />
      ) : null}
    </>
  )
}

function UndoIcon({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-[18px] w-[18px] ${flip ? '-scale-x-100' : ''}`}
    >
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  )
}

function ToolDrawer({
  ctx,
  tool,
  onClose,
}: {
  ctx: WorkspaceContext
  tool: ToolId
  onClose: () => void
}) {
  const group = TOOL_GROUPS.find((g) => g.tool === tool)

  return (
    <div className="absolute inset-y-0 left-12 z-30 flex w-64 flex-col border-r border-line bg-surface shadow-xl animate-slide-in-left">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas-soft hover:text-ink-text"
          aria-label="Collapse library"
          title="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink-text">
            {group?.title ?? (tool === 'roof' ? 'Roof forms' : 'Finishes')}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin p-3">
        {group ? (
          <>
            <p className="mb-3 text-[11.5px] leading-relaxed text-muted">{group.blurb}</p>
            {group.categories.map((category) => (
              <div key={category.id} className="mb-4">
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                  {category.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {category.variants.map((variant) => (
                    <VariantTile
                      key={variant.id}
                      variant={variant}
                      armed={ctx.pending?.variant.id === variant.id}
                      onArm={() =>
                        ctx.setPending(
                          ctx.pending?.variant.id === variant.id ? null : { tool: group.tool, variant },
                        )
                      }
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/x-archnova', JSON.stringify({ tool: group.tool, variant }))
                        event.dataTransfer.effectAllowed = 'copy'
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : tool === 'roof' ? (
          <div className="grid grid-cols-2 gap-2">
            {ROOF_TYPES.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  ctx.setPreviewRoof(option.value)
                  onClose()
                }}
                className={`rounded-lg border p-2.5 text-left text-[12px] font-medium transition-colors ${
                  ctx.previewRoof === option.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-line text-muted hover:bg-canvas-soft'
                }`}
              >
                <Home className="mb-1.5 h-4 w-4" />
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <SwatchSection
              title="Exterior finish"
              options={EXTERIOR_FINISHES}
              current={ctx.previewExt}
              onPick={(v) => ctx.setPreviewExt(v as FinishOption)}
            />
            <SwatchSection
              title="Interior finish"
              options={INTERIOR_FINISHES}
              current={ctx.previewInt}
              onPick={(v) => ctx.setPreviewInt(v as FinishOption)}
            />
          </div>
        )}
      </div>

      {ctx.pending ? (
        <div className="border-t border-line bg-brand-50/60 px-3 py-2">
          <p className="text-[11.5px] text-brand-800">
            Placing <span className="font-semibold">{ctx.pending.variant.name}</span> — click the
            plan{group?.tool === 'room' || group?.tool === 'trees' ? '' : ' on a room'}, or drag a
            tile.{' '}
            <button className="underline underline-offset-2" onClick={() => ctx.setPending(null)}>
              Cancel
            </button>
          </p>
        </div>
      ) : null}
    </div>
  )
}

function VariantTile({
  variant,
  armed,
  onArm,
  onDragStart,
}: {
  variant: ToolVariant
  armed: boolean
  onArm: () => void
  onDragStart: (event: DragEvent) => void
}) {
  const Icon = ICONS[variant.icon] ?? Box
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onArm}
      title={`${variant.name}${variant.w ? ` · ${variant.w} × ${variant.h}` : ''} — click to arm, or drag onto the plan`}
      className={`group flex cursor-grab flex-col items-start gap-1.5 rounded-lg border p-2 text-left transition-colors active:cursor-grabbing ${
        armed ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300' : 'border-line hover:border-brand-300 hover:bg-canvas-soft'
      }`}
    >
      <span className="flex h-12 w-full items-center justify-center overflow-hidden rounded-md border border-line-soft bg-canvas-soft/70">
        {variant.assetId ? <LazyAssetPreview assetId={variant.assetId} className="h-full w-full" />
          : variant.previewImage ? <img src={variant.previewImage} alt={`${variant.name} preview`} loading="lazy" className="h-full w-full object-cover" />
          : <Icon className="h-5 w-5 text-ink-500" strokeWidth={1.6} />}
      </span>
      <span className="w-full truncate text-[11.5px] font-medium text-ink-text">{variant.name}</span>
      {variant.w ? (
        <span className="text-[10px] text-faint">{variant.w} × {variant.h}</span>
      ) : null}
    </button>
  )
}

function finishSwatch(value: string): string {
  const patterns: Record<string, string> = {
    render: 'linear-gradient(135deg,#eeeae3,#d6d1c8)', paint: 'linear-gradient(135deg,#fafafa,#dfe8f0)',
    brick: 'repeating-linear-gradient(0deg,#b97861 0 7px,#eee3d8 8px 9px)', stone: 'repeating-linear-gradient(45deg,#c8c1b2 0 12px,#aaa394 13px,#d7d1c6 15px)',
    wood: 'repeating-linear-gradient(0deg,#c9a97f 0 7px,#8b6747 8px,#d8bc98 9px)', glass: 'linear-gradient(135deg,#d9f0fb 0 40%,#8eb5ca 42%,#e9f8ff 50%,#bfdbe8 62%)',
    tile: 'repeating-linear-gradient(0deg,#e8e4db 0 12px,#89929b 13px,#e8e4db 14px)', marble: 'linear-gradient(135deg,#eee9df,#c2c4c2 42%,#f7f4ed 60%,#d6d1c7)',
    concrete: 'repeating-linear-gradient(45deg,#c4c5c2 0 3px,#b5b7b6 4px,#c7c8c6 6px)', carpet: 'repeating-linear-gradient(90deg,#8a8790 0 2px,#a09da5 3px,#89868e 4px)',
    terrazzo: 'radial-gradient(#6d8794 1px,transparent 2px),radial-gradient(#b87861 1px,transparent 2px),#d6d2c9', metal: 'repeating-linear-gradient(90deg,#87929a 0 5px,#c0c8ce 6px,#87929a 8px)',
  }
  return patterns[value] ?? 'linear-gradient(135deg,#e5e7eb,#cbd5e1)'
}

function SwatchSection({
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
      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onPick(option.value)}
            aria-pressed={current === option.value}
            className={`flex flex-col gap-1.5 rounded-lg border p-2 text-left text-[11px] font-medium transition-colors ${
              current === option.value ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'border-line bg-white text-muted hover:bg-canvas-soft'
            }`}
          >
            <span className="h-9 w-full rounded-md border border-black/10" style={{ background: finishSwatch(option.value) }} />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
