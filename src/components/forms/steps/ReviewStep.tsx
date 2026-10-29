import type { ReactNode } from 'react'
import { Pencil, Check, MapPin, Ruler, Building2, LayoutGrid, Palette, Wallet, StickyNote } from 'lucide-react'
import type { NewProjectForm } from '@/types'
import { StepShell, type StepProps } from '../StepShell'
import { Badge } from '@/components/ui/Badge'
import { HouseIllustration } from '@/components/illustrations/HouseIllustration'
import { formatDimensions, formatMoney } from '@/lib/format'
import {
  ARCHITECTURAL_STYLES,
  BUILDING_TYPES,
  EXTERIOR_FINISHES,
  INTERIOR_FINISHES,
  OUTDOOR_FEATURES,
  PLOT_SHAPES,
  ROOM_OPTIONS,
  ROOF_TYPES,
  SITE_CONSTRAINTS,
} from '@/data/catalog'

const labelIn = <T extends string>(options: { value: T; label: string }[], value: T) =>
  options.find((o) => o.value === value)?.label ?? value

export function ReviewStep({
  form,
  onJump,
}: StepProps & { form: NewProjectForm; onJump: (index: number) => void }) {
  return (
    <StepShell
      icon={<Check className="h-5 w-5" />}
      title="Review your brief"
      description="Everything you picked. Jump back to any section to change it."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Group icon={<MapPin className="h-4 w-4" />} title="Project" onEdit={() => onJump(0)}>
            <ReviewRow label="Project name" value={form.name || '—'} />
            <ReviewRow label="Location" value={form.location || 'Not set'} />
          </Group>

          <Group icon={<Ruler className="h-4 w-4" />} title="Plot" onEdit={() => onJump(1)}>
            <ReviewRow label="Dimensions" value={formatDimensions(form.plotWidth, form.plotLength, form.units)} />
            <ReviewRow label="Shape" value={labelIn(PLOT_SHAPES, form.plotShape)} />
          </Group>

          <Group icon={<MapPin className="h-4 w-4" />} title="Site" onEdit={() => onJump(2)}>
            <ReviewRow
              label="Constraints"
              value={form.constraints.length ? form.constraints.map((c) => labelIn(SITE_CONSTRAINTS, c)).join(', ') : 'None selected'}
            />
          </Group>

          <Group icon={<Building2 className="h-4 w-4" />} title="Building" onEdit={() => onJump(3)}>
            <ReviewRow label="Type" value={labelIn(BUILDING_TYPES, form.buildingType)} />
            <ReviewRow label="Bedrooms / bathrooms" value={`${form.bedrooms} / ${form.bathrooms}`} />
          </Group>

          <Group icon={<LayoutGrid className="h-4 w-4" />} title="Spaces & outdoor" onEdit={() => onJump(5)}>
            <ReviewRow
              label="Extra rooms"
              value={form.rooms.length ? form.rooms.map((r) => labelIn(ROOM_OPTIONS, r)).join(', ') : 'None selected'}
            />
            <ReviewRow
              label="Outdoor features"
              value={form.outdoor.length ? form.outdoor.map((o) => labelIn(OUTDOOR_FEATURES, o)).join(', ') : 'None selected'}
            />
          </Group>

          <Group icon={<Palette className="h-4 w-4" />} title="Style & finishes" onEdit={() => onJump(7)}>
            <ReviewRow label="Architectural style" value={labelIn(ARCHITECTURAL_STYLES, form.style)} />
            <ReviewRow label="Roof" value={labelIn(ROOF_TYPES, form.roof)} />
            <ReviewRow label="Exterior finish" value={labelIn(EXTERIOR_FINISHES, form.exteriorFinish)} />
            <ReviewRow label="Interior finish" value={labelIn(INTERIOR_FINISHES, form.interiorFinish)} />
          </Group>

          <Group icon={<Wallet className="h-4 w-4" />} title="Budget & notes" onEdit={() => onJump(9)}>
            <ReviewRow label="Budget" value={formatMoney(form.budget.amount, form.budget.currency)} />
            <ReviewRow label="Currency" value={form.budget.currency} />
          </Group>

          <Group icon={<StickyNote className="h-4 w-4" />} title="Additional instructions" onEdit={() => onJump(10)}>
            <p className="rounded-lg bg-canvas-soft/70 px-3.5 py-3 text-[13px] leading-relaxed text-ink-text">
              {form.notes.trim() || 'No additional notes provided.'}
            </p>
          </Group>
        </div>

        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="aspect-[4/3] bg-canvas-soft">
              <HouseIllustration
                roof={form.roof}
                exterior={form.exteriorFinish}
                showPool={form.outdoor.includes('pool')}
                showGarage={form.outdoor.includes('garage')}
                showGarden={form.outdoor.includes('garden') || form.outdoor.includes('terrace')}
                className="h-full w-full"
              />
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink-text">Ready to draft</span>
              <Badge tone="brand">Preview</Badge>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              ArchNova will use this brief to produce a starting floor plan and 3D preview. This
              prototype creates a demonstration project only — no design is actually generated yet.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md bg-canvas-soft px-2.5 py-1 text-[11.5px] font-medium text-muted">
                {form.bedrooms} bed{form.bedrooms > 1 ? 's' : ''}
              </span>
              <span className="rounded-md bg-canvas-soft px-2.5 py-1 text-[11.5px] font-medium text-muted">
                {form.bathrooms} bath{form.bathrooms !== 1 ? 's' : ''}
              </span>
              <span className="rounded-md bg-canvas-soft px-2.5 py-1 text-[11.5px] font-medium text-muted">
                {formatDimensions(form.plotWidth, form.plotLength, form.units)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </StepShell>
  )
}

function Group({
  icon,
  title,
  onEdit,
  children,
}: {
  icon: ReactNode
  title: string
  onEdit: () => void
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-text">
          <span className="text-brand-600">{icon}</span>
          {title}
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-800"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

function ReviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-right text-[12.5px] font-medium text-ink-text">{value}</span>
    </div>
  )
}
