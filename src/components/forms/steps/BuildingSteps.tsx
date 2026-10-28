import { Building2, BedDouble, Minus, Plus } from 'lucide-react'
import type { NewProjectForm } from '@/types'
import { StepShell, type StepProps } from '../StepShell'
import { OptionGrid } from '../OptionGrid'
import { BUILDING_TYPES } from '@/data/catalog'

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  hint: string
}) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next))
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-medium text-ink-text">{label}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange(clamp(value - 1))}
            disabled={value <= min}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-text transition-colors hover:bg-canvas-soft disabled:opacity-40"
            aria-label={`Decrease ${label}`}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-9 text-center text-[19px] font-semibold leading-none text-ink-text">{value}</span>
          <button
            type="button"
            onClick={() => onChange(clamp(value + 1))}
            disabled={value >= max}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-text transition-colors hover:bg-canvas-soft disabled:opacity-40"
            aria-label={`Increase ${label}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-muted">{hint}</p>
    </div>
  )
}

export function BuildingTypeStep({ form, update }: StepProps & { form: NewProjectForm }) {
  return (
    <StepShell
      icon={<Building2 className="h-5 w-5" />}
      title="Building type"
      description="What kind of home are you designing?"
    >
      <OptionGrid<NewProjectForm['buildingType']>
        options={BUILDING_TYPES}
        value={form.buildingType}
        onChange={(value) => update('buildingType', value)}
        columns={3}
      />
    </StepShell>
  )
}

export function RoomCountStep({ form, update, errors }: StepProps & { form: NewProjectForm }) {
  return (
    <StepShell
      icon={<BedDouble className="h-5 w-5" />}
      title="Bedrooms & bathrooms"
      description="The two numbers that shape the plan most."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Stepper
          label="Bedrooms"
          value={form.bedrooms}
          min={1}
          max={12}
          onChange={(value) => update('bedrooms', value)}
          hint="Include the master bedroom. Studios count as one."
        />
        <Stepper
          label="Bathrooms"
          value={form.bathrooms}
          min={0}
          max={12}
          onChange={(value) => update('bathrooms', value)}
          hint="En-suite and guest bathrooms both count."
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[2, 3, 4, 5].map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => update('bedrooms', count)}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              form.bedrooms === count
                ? 'bg-brand-600 text-white'
                : 'bg-canvas-soft text-muted hover:bg-line/70'
            }`}
          >
            {count} bed{count > 1 ? 's' : ''}
          </button>
        ))}
      </div>

      {errors.bedrooms ? <p className="mt-3 text-[12px] font-medium text-danger">{errors.bedrooms}</p> : null}
    </StepShell>
  )
}
