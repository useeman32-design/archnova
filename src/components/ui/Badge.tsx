import type { ReactNode } from 'react'

type Tone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'violet'

export function toneClasses(tone: Tone): string {
  switch (tone) {
    case 'brand':
      return 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
    case 'success':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
    case 'warning':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
    case 'danger':
      return 'bg-red-50 text-red-700 ring-1 ring-red-100'
    case 'violet':
      return 'bg-violet-50 text-violet-700 ring-1 ring-violet-100'
    default:
      return 'bg-canvas-soft text-muted ring-1 ring-line'
  }
}

export function Badge({
  tone = 'neutral',
  children,
  dot = false,
}: {
  tone?: Tone
  children: ReactNode
  dot?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${toneClasses(tone)}`}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  )
}

const STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral',
  'in-progress': 'brand',
  review: 'warning',
  completed: 'success',
}

export function StatusBadge({ status }: { status: string }) {
  const label =
    status === 'in-progress' ? 'In progress' : status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot>
      {label}
    </Badge>
  )
}
