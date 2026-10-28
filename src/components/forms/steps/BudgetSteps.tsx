import { Wallet, StickyNote } from 'lucide-react'
import type { NewProjectForm } from '@/types'
import { StepShell, type StepProps } from '../StepShell'
import { NumberField, TextArea, SelectField } from '@/components/ui/Field'
import { CURRENCIES } from '@/data/catalog'
import { formatMoney } from '@/lib/format'

export function BudgetStep({ form, update, errors }: StepProps & { form: NewProjectForm }) {
  return (
    <StepShell
      icon={<Wallet className="h-5 w-5" />}
      title="Budget"
      description="An indicative figure to steer the design — you can change it at any time."
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
        <NumberField
          label="Estimated construction budget"
          required
          min={0}
          step={10000}
          suffix={form.budget.currency}
          value={form.budget.amount}
          onChange={(event) => update('budget', { ...form.budget, amount: Number(event.target.value) })}
          error={errors.budget}
          hint="Enter the total budget for the whole project, including finishes."
        />
        <SelectField
          label="Currency"
          value={form.budget.currency}
          onChange={(event) => update('budget', { ...form.budget, currency: event.target.value })}
        >
          {CURRENCIES.map((currency) => (
            <option key={currency.value} value={currency.value}>
              {currency.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-lg bg-brand-50 px-3.5 py-3">
        <span className="text-[12.5px] text-brand-800">
          {formatMoney(form.budget.amount, form.budget.currency)} targeted budget
        </span>
      </div>
    </StepShell>
  )
}

export function NotesStep({ form, update }: StepProps & { form: NewProjectForm }) {
  return (
    <StepShell
      icon={<StickyNote className="h-5 w-5" />}
      title="Additional instructions"
      description="Anything else the design should know about — styles you love, must-haves, things to avoid."
    >
      <TextArea
        label="Notes"
        rows={8}
        placeholder="For example: keep the living room bright, avoid a north-facing main bedroom, use local sandcrete blocks, include a generator room…"
        value={form.notes}
        onChange={(event) => update('notes', event.target.value)}
        hint="Free text. This is passed straight to the assistant when you start a design."
      />
    </StepShell>
  )
}
