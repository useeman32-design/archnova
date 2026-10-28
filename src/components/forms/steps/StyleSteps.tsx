import { Palette, Wand2 } from 'lucide-react'
import type { NewProjectForm } from '@/types'
import { StepShell, type StepProps } from '../StepShell'
import { OptionGrid } from '../OptionGrid'
import { ARCHITECTURAL_STYLES, ROOF_TYPES, EXTERIOR_FINISHES, INTERIOR_FINISHES } from '@/data/catalog'

export function StyleStep({ form, update }: StepProps & { form: NewProjectForm }) {
  return (
    <StepShell
      icon={<Palette className="h-5 w-5" />}
      title="Architectural style & roof"
      description="The look of the house. You can refine it later in the workspace."
    >
      <div className="space-y-7">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-text">Architectural style</span>
          <OptionGrid<string>
            options={ARCHITECTURAL_STYLES}
            value={form.style}
            onChange={(value) => update('style', value)}
            columns={3}
          />
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-text">Roof preference</span>
          <OptionGrid<string>
            options={ROOF_TYPES}
            value={form.roof}
            onChange={(value) => update('roof', value)}
            columns={3}
          />
        </div>
      </div>
    </StepShell>
  )
}

export function FinishStep({ form, update }: StepProps & { form: NewProjectForm }) {
  return (
    <StepShell
      icon={<Wand2 className="h-5 w-5" />}
      title="Finishes"
      description="The materials and surfaces on the outside and inside of the house."
    >
      <div className="space-y-7">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-text">Exterior finish</span>
          <OptionGrid<NewProjectForm['exteriorFinish']>
            options={EXTERIOR_FINISHES}
            value={form.exteriorFinish}
            onChange={(value) => update('exteriorFinish', value)}
            columns={3}
          />
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-text">Interior finish</span>
          <OptionGrid<NewProjectForm['interiorFinish']>
            options={INTERIOR_FINISHES}
            value={form.interiorFinish}
            onChange={(value) => update('interiorFinish', value)}
            columns={3}
          />
        </div>
      </div>
    </StepShell>
  )
}
