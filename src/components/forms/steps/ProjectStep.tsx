import { Type } from 'lucide-react'
import type { NewProjectForm } from '@/types'
import { StepShell, type StepProps } from '../StepShell'
import { TextField } from '@/components/ui/Field'

const CITIES = [
  'Lagos',
  'Abuja',
  'Port Harcourt',
  'Kaduna',
  'Gusau',
  'Ibadan',
  'Kano',
  'Benin City',
  'Enugu',
  'Jos',
  'Abeokuta',
  'Warri',
  'Sokoto',
  'Maiduguri',
  'Zaria',
  'Onitsha',
]

export function ProjectStep({ form, update, errors }: StepProps & { form: NewProjectForm }) {
  return (
    <StepShell
      icon={<Type className="h-5 w-5" />}
      title="Project name & location"
      description="Name your project so you can find it later in the dashboard."
    >
      <div className="space-y-5">
        <TextField
          label="Project name"
          required
          placeholder="e.g. 3 Bedroom Bungalow"
          value={form.name}
          onChange={(event) => update('name', event.target.value)}
          error={errors.name}
          hint="This appears on the dashboard, in the workspace and in the drawing set."
        />
        <div>
          <TextField
            label="Location"
            placeholder="e.g. Gusau"
            list="ps-city-list"
            value={form.location}
            onChange={(event) => update('location', event.target.value)}
            error={errors.location}
            hint="City, town or neighbourhood — used for orientation and climate defaults."
          />
          <datalist id="ps-city-list">
            {CITIES.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </div>
      </div>
    </StepShell>
  )
}
