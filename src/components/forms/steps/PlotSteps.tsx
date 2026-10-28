import { Ruler, MapPin } from 'lucide-react'
import type { NewProjectForm, PlotShape, Units } from '@/types'
import { StepShell, type StepProps } from '../StepShell'
import { SegmentedControl, CheckboxCard } from '@/components/ui/FormControls'
import { NumberField } from '@/components/ui/Field'
import { OptionGrid, InfoRow } from '../OptionGrid'
import { SITE_CONSTRAINTS, PLOT_SHAPES } from '@/data/catalog'
import { formatDimensions, formatArea } from '@/lib/format'

export function PlotDimensionsStep({ form, update, errors }: StepProps & { form: NewProjectForm }) {
  return (
    <StepShell
      icon={<Ruler className="h-5 w-5" />}
      title="Plot dimensions"
      description="Measure the plot. You can revisit these numbers after the first draft."
    >
      <div className="space-y-5">
        <div className="flex justify-end">
          <SegmentedControl<Units>
            options={[
              { value: 'ft', label: 'Feet' },
              { value: 'm', label: 'Metres' },
            ]}
            value={form.units}
            onChange={(units) => {
              update('units', units)
              if (units === 'm' && form.plotWidth > 40) {
                update('plotWidth', Math.round((form.plotWidth / 3.281) * 10) / 10)
                update('plotLength', Math.round((form.plotLength / 3.281) * 10) / 10)
              }
            }}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            label="Plot width"
            required
            min={1}
            step={1}
            suffix={form.units === 'ft' ? 'ft' : 'm'}
            value={form.plotWidth}
            onChange={(event) => update('plotWidth', Number(event.target.value))}
            error={errors.plotWidth}
          />
          <NumberField
            label="Plot length"
            required
            min={1}
            step={1}
            suffix={form.units === 'ft' ? 'ft' : 'm'}
            value={form.plotLength}
            onChange={(event) => update('plotLength', Number(event.target.value))}
            error={errors.plotLength}
          />
        </div>

        <InfoRow>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-brand-600" />
            <span className="font-semibold text-ink-text">
              {formatDimensions(form.plotWidth, form.plotLength, form.units)}
            </span>
            <span className="text-muted">
              · total site area {formatArea(form.plotWidth, form.plotLength, form.units)}
            </span>
          </div>
        </InfoRow>
      </div>
    </StepShell>
  )
}

export function PlotShapeStep({ form, update, errors }: StepProps & { form: NewProjectForm }) {
  const toggleConstraint = (value: string, checked: boolean) => {
    update(
      'constraints',
      checked ? [...form.constraints, value] : form.constraints.filter((c) => c !== value),
    )
  }

  return (
    <StepShell
      icon={<MapPin className="h-5 w-5" />}
      title="Plot shape & site constraints"
      description="The shape of the plot and anything the design has to work around."
    >
      <div className="space-y-6">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-text">Plot shape</span>
          <OptionGrid<PlotShape>
            options={PLOT_SHAPES}
            value={form.plotShape}
            onChange={(value) => update('plotShape', value)}
          />
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-text">
            Known site constraints
          </span>
          <p className="mb-3 text-[12.5px] text-muted">
            Tick anything that applies. Nothing here blocks you — it just steers the first draft.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {SITE_CONSTRAINTS.map((constraint) => (
              <CheckboxCard
                key={constraint.value}
                checked={form.constraints.includes(constraint.value)}
                onChange={(checked) => toggleConstraint(constraint.value, checked)}
                title={constraint.label}
              />
            ))}
          </div>
        </div>

        {errors.constraints ? <p className="text-[12px] font-medium text-danger">{errors.constraints}</p> : null}
      </div>
    </StepShell>
  )
}
