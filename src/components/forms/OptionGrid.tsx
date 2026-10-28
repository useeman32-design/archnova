import type { ReactNode } from 'react'
import {
  Home,
  Building2,
  Car,
  Trees,
  Waves,
  Umbrella,
  Fence,
  Flame,
  Layers,
  Brush,
  Square,
  Mountain,
  Plane,
  Sparkles,
  Plus,
  Ruler,
  type LucideIcon,
} from 'lucide-react'
import { CheckboxCard } from '@/components/ui/FormControls'

const ICONS: Record<string, LucideIcon> = {
  bungalow: Home,
  detached: Home,
  'semi-detached': Building2,
  duplex: Building2,
  flats: Building2,
  other: Plus,
  parking: Car,
  garage: Car,
  garden: Trees,
  pool: Waves,
  terrace: Umbrella,
  fence: Fence,
  barbecue: Flame,
  shed: Home,
  render: Layers,
  paint: Brush,
  brick: Square,
  stone: Mountain,
  wood: Plane,
  glass: Square,
  'modern-minimal': Square,
  contemporary: Layers,
  traditional: Home,
  tropical: Trees,
  industrial: Building2,
  mediterranean: Umbrella,
  scandinavian: Home,
  victorian: Home,
  flat: Square,
  'pitched-gable': Home,
  hip: Mountain,
  roof_shed: Plane,
  mansard: Home,
  dome: Sparkles,
  living: Home,
  dining: Home,
  kitchen: Home,
  study: Home,
  laundry: Home,
  storage: Home,
  porch: Home,
  balcony: Umbrella,
}

export function optionIcon(value: string, className = 'h-[18px] w-[18px]'): ReactNode {
  const Icon = ICONS[value] ?? Sparkles
  return <Icon className={className} />
}

export function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  multiple = false,
  columns = 2,
}: {
  options: { value: T; label: string; description?: string }[]
  value: T | T[]
  onChange: (value: T, checked: boolean) => void
  multiple?: boolean
  columns?: 2 | 3
}) {
  const values = multiple ? (value as T[]) : [value as T]
  const grid = columns === 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2'
  return (
    <div className={`grid gap-3 ${grid}`}>
      {options.map((option) => {
        const checked = values.includes(option.value)
        return (
          <CheckboxCard
            key={option.value}
            checked={checked}
            onChange={(next) => onChange(option.value, next)}
            icon={optionIcon(option.value)}
            title={option.label}
            description={option.description}
          />
        )
      })}
    </div>
  )
}

export function InfoRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-canvas-soft/70 px-3.5 py-3">
      <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
      <div className="text-[12.5px] leading-relaxed text-muted">{children}</div>
    </div>
  )
}
