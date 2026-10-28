import type { ReactNode } from 'react'

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth,
}: {
  options: { value: T; label: string; icon?: ReactNode; hint?: string }[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  fullWidth?: boolean
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]'
  return (
    <div
      className={`inline-flex rounded-lg border border-line bg-canvas-soft p-1 ${fullWidth ? 'flex w-full' : ''}`}
      role="radiogroup"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            title={option.hint}
            className={`inline-flex items-center justify-center gap-1.5 font-medium transition-colors ${pad} rounded-md ${
              active ? 'bg-surface text-ink-text shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink-text'
            } ${fullWidth ? 'flex-1' : ''}`}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: ReactNode
  description?: ReactNode
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 text-left">
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink-text">{label}</span>
        {description ? <span className="block text-[12px] text-muted">{description}</span> : null}
      </span>
      <span
        role="switch"
        aria-checked={checked}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-line'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  )
}

export function CheckboxCard({
  checked,
  onChange,
  title,
  description,
  icon,
  meta,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  meta?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`relative flex h-full w-full flex-col gap-2 rounded-xl border p-4 text-left transition-all ${
        checked
          ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-200'
          : 'border-line bg-surface hover:border-brand-300 hover:bg-canvas-soft/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon ? (
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${checked ? 'bg-brand-600 text-white' : 'bg-canvas-soft text-muted'}`}
            >
              {icon}
            </span>
          ) : null}
          <span className="text-[14px] font-semibold text-ink-text">{title}</span>
        </div>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
            checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface'
          }`}
        >
          {checked ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : null}
        </span>
      </div>
      {description ? <p className="text-[12px] leading-snug text-muted">{description}</p> : null}
      {meta ? <div className="mt-auto pt-1 text-[11px] font-medium text-brand-700">{meta}</div> : null}
    </button>
  )
}
