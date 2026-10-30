import { Building2, BedDouble, Minus, Plus } from 'lucide-react'
import type { BuildingCategory, BuildingType, NewProjectForm, ProjectPurpose } from '@/types'
import { StepShell, type StepProps } from '../StepShell'
import { OptionGrid } from '../OptionGrid'
import { BUILDING_CATEGORIES, BUILDING_USES } from '@/data/catalog'

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
  const purpose: ProjectPurpose = form.purpose ?? (form.buildingType === 'other'
    ? { category: 'other', use: 'custom' }
    : { category: 'residential', use: form.buildingType })
  const uses = BUILDING_USES[purpose.category]
  const selectedUse = uses.some((option) => option.value === purpose.use) ? purpose.use : uses[0].value
  const customUse = selectedUse === 'other' || selectedUse === 'custom' || selectedUse === 'custom-mixed-use'

  const setCategory = (category: BuildingCategory) => {
    const use = BUILDING_USES[category][0].value
    const nextPurpose = { category, use }
    update('purpose', nextPurpose)
    update('buildingType', category === 'residential' ? legacyResidentialType(use) : 'other')
    update('rooms', category === 'residential' ? ['living'] : [])
  }

  const setUse = (use: string) => {
    update('purpose', { ...purpose, use, description: undefined })
    if (purpose.category === 'residential') update('buildingType', legacyResidentialType(use))
    else update('buildingType', 'other')
  }

  const setCustomDescription = (description: string) => update('purpose', { ...purpose, description })

  return (
    <StepShell
      icon={<Building2 className="h-5 w-5" />}
      title="Building purpose"
      description="Choose the project's main use. ArchNova records the purpose separately from the legacy residential layout type."
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Project category</p>
          <OptionGrid<BuildingCategory>
            options={BUILDING_CATEGORIES}
            value={purpose.category}
            onChange={setCategory}
            columns={3}
          />
        </div>
        <div>
          <label htmlFor="building-purpose-use" className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-muted">
            Intended use
          </label>
          <select
            id="building-purpose-use"
            value={selectedUse}
            onChange={(event) => setUse(event.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[13px] text-ink-text outline-none focus:border-brand-500"
          >
            {uses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <p className="mt-1.5 text-[12px] text-muted">{uses.find((option) => option.value === selectedUse)?.description}</p>
        </div>
        {customUse ? (
          <div>
            <label htmlFor="custom-building-purpose" className="mb-2 block text-[12px] font-semibold text-ink-text">Describe the custom purpose</label>
            <input
              id="custom-building-purpose"
              value={purpose.description ?? ''}
              onChange={(event) => setCustomDescription(event.target.value)}
              placeholder="e.g. Ministry of Health headquarters"
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[13px] text-ink-text outline-none focus:border-brand-500"
            />
          </div>
        ) : null}
        {purpose.category !== 'residential' ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] leading-relaxed text-amber-900">
            This phase saves a generalized project brief and an empty ground-floor workspace for non-residential uses. It does not yet generate institutional or commercial space schedules, floor layouts, or regulatory checks.
          </div>
        ) : null}
      </div>
    </StepShell>
  )
}

function legacyResidentialType(use: string): BuildingType {
  if (use === 'bungalow' || use === 'duplex' || use === 'detached' || use === 'semi-detached' || use === 'flats') return use
  return 'other'
}

export function RoomCountStep({ form, update, errors }: StepProps & { form: NewProjectForm }) {
  const purposeCategory = form.purpose?.category ?? (form.buildingType === 'other' ? 'other' : 'residential')
  if (purposeCategory !== 'residential') {
    return (
      <StepShell
        icon={<Building2 className="h-5 w-5" />}
        title="Project scope"
        description="Residential bedroom and bathroom counts do not apply to this project purpose."
      >
        <div className="rounded-xl border border-line bg-surface p-4 text-[13px] leading-relaxed text-muted">
          <p className="font-medium text-ink-text">{form.purpose?.description || form.purpose?.use.split('-').join(' ') || 'Custom project purpose'}</p>
          <p className="mt-2">List requested departments and facilities in the next step. Dynamic AI clarification and purpose-specific space planning are planned for the AI planning phase; no residential room layout will be generated for this project.</p>
        </div>
      </StepShell>
    )
  }
  return (
    <StepShell
      icon={<BedDouble className="h-5 w-5" />}
      title="Bedrooms & bathrooms"
      description="The two numbers that shape the residential starter plan most."
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
