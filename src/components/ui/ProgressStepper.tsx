import { Check } from 'lucide-react'

export interface Step {
  id: string
  label: string
  short: string
}

export function ProgressStepper({
  steps,
  current,
  onJump,
}: {
  steps: Step[]
  current: number
  onJump?: (index: number) => void
}) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto scroll-thin">
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'active' : 'idle'
        return (
          <li key={step.id} className="flex items-center shrink-0">
            <button
              type="button"
              disabled={!onJump || state === 'done'}
              onClick={() => onJump?.(index)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                state === 'active'
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                  : state === 'done'
                    ? 'bg-brand-50 text-brand-700'
                    : 'bg-surface text-muted border border-line'
              } ${onJump && state !== 'done' ? 'cursor-pointer hover:bg-line/60' : ''} disabled:cursor-default`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  state === 'done'
                    ? 'bg-brand-600 text-white'
                    : state === 'active'
                      ? 'bg-white/20 text-white'
                      : 'bg-line text-muted'
                }`}
              >
                {state === 'done' ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              {step.short}
            </button>
            {index < steps.length - 1 ? (
              <span className="mx-1 h-px w-6 bg-line" aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
