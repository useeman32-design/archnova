import { Building2, LayoutGrid, TreePine } from 'lucide-react'
import type { NewProjectForm, OutdoorFeature, RoomCategory } from '@/types'
import { StepShell, type StepProps } from '../StepShell'
import { OptionGrid } from '../OptionGrid'
import { ROOM_OPTIONS, OUTDOOR_FEATURES } from '@/data/catalog'

export function RoomsStep({ form, update }: StepProps & { form: NewProjectForm }) {
  const purposeCategory = form.purpose?.category ?? (form.buildingType === 'other' ? 'other' : 'residential')
  const toggle = (value: RoomCategory, checked: boolean) => {
    update(
      'rooms',
      checked ? [...form.rooms, value] : form.rooms.filter((r) => r !== value),
    )
  }

  if (purposeCategory !== 'residential') {
    return (
      <StepShell
        icon={<Building2 className="h-5 w-5" />}
        title="Required spaces and departments"
        description="List the key facilities ArchNova should remember in the project brief."
      >
        <label htmlFor="project-space-requirements" className="mb-2 block text-[12px] font-semibold text-ink-text">
          Required spaces (one per line)
        </label>
        <textarea
          id="project-space-requirements"
          value={form.rooms.join('\n')}
          onChange={(event) => update('rooms', event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))}
          placeholder={'Reception\nPublic waiting\nDepartment offices\nAccessible toilets'}
          rows={7}
          className="w-full resize-y rounded-lg border border-line bg-white px-3 py-2.5 text-[13px] leading-relaxed text-ink-text outline-none focus:border-brand-500"
        />
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          These entries are stored as a preliminary space schedule only. This phase does not size, arrange, or validate them.
        </p>
      </StepShell>
    )
  }

  return (
    <StepShell
      icon={<LayoutGrid className="h-5 w-5" />}
      title="Rooms & spaces"
      description="Pick the spaces you need beyond the bedrooms and bathrooms."
    >
      <OptionGrid<RoomCategory>
        options={ROOM_OPTIONS}
        value={form.rooms as RoomCategory[]}
        onChange={toggle}
        multiple
        columns={3}
      />
      <p className="mt-4 text-[12px] text-muted">
        Bedrooms and bathrooms are set on the previous step. Everything here is added on top.
      </p>
    </StepShell>
  )
}

export function OutdoorStep({ form, update }: StepProps & { form: NewProjectForm }) {
  const toggle = (value: OutdoorFeature, checked: boolean) => {
    update(
      'outdoor',
      checked ? [...form.outdoor, value] : form.outdoor.filter((o) => o !== value),
    )
  }

  return (
    <StepShell
      icon={<TreePine className="h-5 w-5" />}
      title="Outdoor features"
      description="Parking, gardens, a pool and anything else outside the main building."
    >
      <OptionGrid<OutdoorFeature>
        options={OUTDOOR_FEATURES}
        value={form.outdoor}
        onChange={toggle}
        multiple
        columns={3}
      />
      <p className="mt-4 text-[12px] text-muted">
        These are placed around the building footprint by the generation engine once it is connected.
      </p>
    </StepShell>
  )
}
