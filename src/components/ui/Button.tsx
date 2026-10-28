import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/25 active:bg-brand-700',
  secondary:
    'bg-surface border border-line text-ink-text hover:bg-canvas-soft shadow-sm',
  subtle: 'bg-canvas-soft text-ink-text hover:bg-line/70 border border-transparent',
  ghost: 'bg-transparent text-white/80 hover:bg-white/10 border border-transparent',
  danger: 'bg-danger text-white hover:bg-danger/90 shadow-sm',
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
}

export function buttonClasses(variant: Variant = 'secondary', size: Size = 'md', fullWidth = false): string {
  return `inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''}`
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, fullWidth, className = '', children, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={`${buttonClasses(variant, size, fullWidth)} ${className}`} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  )
})
