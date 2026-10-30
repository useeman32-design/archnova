import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Wand2, Loader2 } from 'lucide-react'
import type { NewProjectForm } from '@/types'
import { useProjects } from '@/hooks/useProjects'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { storageKeys } from '@/lib/storage'
import { defaultNewProjectForm } from '@/lib/defaultForm'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ProgressStepper, type Step } from '@/components/ui/ProgressStepper'
import { ProjectStep } from '@/components/forms/steps/ProjectStep'
import { PlotDimensionsStep, PlotShapeStep } from '@/components/forms/steps/PlotSteps'
import { BuildingTypeStep, RoomCountStep } from '@/components/forms/steps/BuildingSteps'
import { RoomsStep, OutdoorStep } from '@/components/forms/steps/SpacesSteps'
import { StyleStep, FinishStep } from '@/components/forms/steps/StyleSteps'
import { BudgetStep, NotesStep } from '@/components/forms/steps/BudgetSteps'
import { ReviewStep } from '@/components/forms/steps/ReviewStep'

const STEP_DEFS: (Step & { label: string })[] = [
  { id: 'project', label: 'Project & location', short: 'Project' },
  { id: 'plot', label: 'Plot dimensions', short: 'Plot' },
  { id: 'site', label: 'Shape & constraints', short: 'Site' },
  { id: 'building', label: 'Building type', short: 'Type' },
  { id: 'beds', label: 'Building scale / project scope', short: 'Scope' },
  { id: 'spaces', label: 'Rooms & spaces', short: 'Spaces' },
  { id: 'outdoor', label: 'Outdoor features', short: 'Outdoor' },
  { id: 'style', label: 'Style & roof', short: 'Style' },
  { id: 'finishes', label: 'Finishes', short: 'Finish' },
  { id: 'budget', label: 'Budget', short: 'Budget' },
  { id: 'notes', label: 'Additional instructions', short: 'Notes' },
  { id: 'review', label: 'Review', short: 'Review' },
]

export function NewProjectPage() {
  const navigate = useNavigate()
  const { createProject, updateProject } = useProjects()
  const [form, setForm] = useLocalStorage(storageKeys.questionnaire, defaultNewProjectForm)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const update = useCallback(
    <K extends keyof NewProjectForm>(key: K, value: NewProjectForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [setForm],
  )

  const validate = (index: number): Record<string, string> => {
    const next: Record<string, string> = {}
    if (index === 0) {
      if (!form.name.trim()) next.name = 'Give your project a name.'
    }
    if (index === 1) {
      if (!(form.plotWidth > 0)) next.plotWidth = 'Enter a plot width.'
      if (!(form.plotLength > 0)) next.plotLength = 'Enter a plot length.'
    }
    if (index === 4 && (form.purpose?.category ?? 'residential') === 'residential') {
      if (form.bedrooms < 1) next.bedrooms = 'You need at least one bedroom.'
    }
    if (index === 9) {
      if (!(form.budget.amount > 0)) next.budget = 'Enter a budget amount.'
    }
    return next
  }

  const goTo = (index: number) => {
    setErrors({})
    setStep(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const next = () => {
    const found = validate(step)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    goTo(Math.min(STEP_DEFS.length - 1, step + 1))
  }

  const back = () => goTo(Math.max(0, step - 1))

  const createBlank = async () => {
    setSubmitting(true)
    const blankForm = { ...defaultNewProjectForm(), name: 'Untitled project' }
    const project = await createProject(blankForm)
    await updateProject(project.id, {
      floors: project.floors.map((floor) => ({ ...floor, rooms: [] })),
    })
    setSubmitting(false)
    navigate(`/workspace/${project.id}`)
  }

  const submit = async () => {
    const found = validate(9)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      goTo(9)
      return
    }
    setSubmitting(true)
    const project = await createProject(form)
    setForm(defaultNewProjectForm())
    setSubmitting(false)
    navigate(`/workspace/${project.id}`)
  }

  const isLast = step === STEP_DEFS.length - 1

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-muted transition-colors hover:text-ink-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
          <h1 className="mt-1.5 text-[20px] font-semibold text-ink-text sm:text-xl">New project</h1>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-success">
          <Save className="h-3.5 w-3.5" />
          Draft saved
        </span>
      </div>

      <div className="mb-5 flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-ink-text">Prefer to design from scratch?</p>
          <p className="mt-0.5 text-[12px] text-muted">Start with an empty plot, set its dimensions in the studio, then build room by room.</p>
        </div>
        <Button variant="secondary" onClick={createBlank} disabled={submitting}>
          {submitting ? 'Preparing…' : 'Open blank studio'}
        </Button>
      </div>

      <div className="mb-6 overflow-x-auto scroll-thin">
        <ProgressStepper steps={STEP_DEFS} current={step} onJump={goTo} />
      </div>

      <Card className="min-h-[420px] p-5 sm:p-7">
        {STEP_DEFS[step].id === 'project' ? <ProjectStep form={form} update={update} errors={errors} /> : null}
        {STEP_DEFS[step].id === 'plot' ? <PlotDimensionsStep form={form} update={update} errors={errors} /> : null}
        {STEP_DEFS[step].id === 'site' ? <PlotShapeStep form={form} update={update} errors={errors} /> : null}
        {STEP_DEFS[step].id === 'building' ? <BuildingTypeStep form={form} update={update} errors={errors} /> : null}
        {STEP_DEFS[step].id === 'beds' ? <RoomCountStep form={form} update={update} errors={errors} /> : null}
        {STEP_DEFS[step].id === 'spaces' ? <RoomsStep form={form} update={update} errors={errors} /> : null}
        {STEP_DEFS[step].id === 'outdoor' ? <OutdoorStep form={form} update={update} errors={errors} /> : null}
        {STEP_DEFS[step].id === 'style' ? <StyleStep form={form} update={update} errors={errors} /> : null}
        {STEP_DEFS[step].id === 'finishes' ? <FinishStep form={form} update={update} errors={errors} /> : null}
        {STEP_DEFS[step].id === 'budget' ? <BudgetStep form={form} update={update} errors={errors} /> : null}
        {STEP_DEFS[step].id === 'notes' ? <NotesStep form={form} update={update} errors={errors} /> : null}
        {STEP_DEFS[step].id === 'review' ? (
          <ReviewStep form={form} update={update} errors={errors} onJump={goTo} />
        ) : null}
      </Card>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="subtle" onClick={back} disabled={step === 0} icon={<ArrowLeft className="h-4 w-4" />}>
          Back
        </Button>
        {isLast ? (
          <Button variant="primary" onClick={submit} disabled={submitting} icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}>
            {submitting ? 'Creating…' : 'Create project'}
          </Button>
        ) : (
          <Button variant="primary" onClick={next} icon={<Wand2 className="h-4 w-4" />}>
            Continue
          </Button>
        )}
      </div>

      <p className="mt-4 text-center text-[12px] text-faint">
        Creating a project in this prototype stores a demonstration record in your browser only. No
        design is generated yet.
      </p>
    </div>
  )
}
