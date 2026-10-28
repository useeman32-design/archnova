import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Render without padding (useful when the card owns its own layout). */
  flush?: boolean
  as?: 'div' | 'button' | 'a'
}

export function Card({ flush, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface shadow-sm ${flush ? '' : 'p-5'} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-soft pb-4">
      <div className="flex items-start gap-3">
        {icon ? <div className="mt-0.5 text-brand-600">{icon}</div> : null}
        <div>
          <h3 className="text-[15px] font-semibold leading-tight text-ink-text">{title}</h3>
          {subtitle ? <p className="mt-1 text-[13px] text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}
