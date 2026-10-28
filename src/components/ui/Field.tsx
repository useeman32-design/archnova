import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

const CONTROL =
  'w-full h-10 rounded-lg border bg-surface px-3 text-sm text-ink-text placeholder:text-faint transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20'

function Label({ label, required, hint, error }: { label: ReactNode; required?: boolean; hint?: ReactNode; error?: ReactNode }) {
  return (
    <span className="mb-1.5 block">
      <span className="text-[13px] font-medium text-ink-text">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </span>
      {hint && !error ? <span className="mt-1 block text-[12px] text-muted">{hint}</span> : null}
      {error ? <span className="mt-1 block text-[12px] font-medium text-danger">{error}</span> : null}
    </span>
  )
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
}

export function TextField({ label, hint, error, required, className = '', ...rest }: TextFieldProps) {
  return (
    <label className="block">
      <Label label={label} required={required} hint={hint} error={error} />
      <input
        className={`${CONTROL} ${error ? 'border-danger focus:ring-danger/20' : 'border-line focus:border-brand-500'} ${className}`}
        {...rest}
      />
    </label>
  )
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
}

export function TextArea({ label, hint, error, required, className = '', ...rest }: TextAreaProps) {
  return (
    <label className="block">
      <Label label={label} required={required} hint={hint} error={error} />
      <textarea
        className={`${CONTROL} h-auto py-2.5 leading-relaxed resize-y ${error ? 'border-danger focus:ring-danger/20' : 'border-line focus:border-brand-500'} ${className}`}
        {...rest}
      />
    </label>
  )
}

export interface NumberFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  suffix?: ReactNode
}

export function NumberField({ label, hint, error, required, suffix, className = '', ...rest }: NumberFieldProps) {
  return (
    <label className="block">
      <Label label={label} required={required} hint={hint} error={error} />
      <div className="relative">
        <input
          type="number"
          className={`${CONTROL} ${error ? 'border-danger focus:ring-danger/20' : 'border-line focus:border-brand-500'} ${suffix ? 'pr-16' : ''} ${className}`}
          {...rest}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] font-medium text-faint">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  )
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
}

export function SelectField({ label, hint, error, required, className = '', children, ...rest }: SelectFieldProps) {
  return (
    <label className="block">
      <Label label={label} required={required} hint={hint} error={error} />
      <select
        className={`${CONTROL} appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${error ? 'border-danger focus:ring-danger/20' : 'border-line focus:border-brand-500'} ${className}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
        }}
        {...rest}
      >
        {children}
      </select>
    </label>
  )
}
