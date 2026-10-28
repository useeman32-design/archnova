import type { ReactNode } from 'react'

export function StepShell({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-start gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold leading-tight text-ink-text">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        </div>
      </div>
      {children}
    </div>
  )
}

export interface StepProps {
  update: <K extends keyof import('@/types').NewProjectForm>(
    key: K,
    value: import('@/types').NewProjectForm[K],
  ) => void
  errors: Record<string, string>
}
