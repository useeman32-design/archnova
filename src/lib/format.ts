import type { Units } from '@/types'

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  NGN: '₦',
  GBP: '£',
  EUR: '€',
  AED: 'AED ',
  CAD: 'C$',
}

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency} `
}

/** "₦ 4,500,000" / "$120,000". */
export function formatMoney(amount: number, currency = 'NGN'): string {
  const symbol = currencySymbol(currency)
  const rounded = Math.round(amount)
  return `${symbol}${rounded.toLocaleString('en-US')}`
}

/** "50 × 50 ft" or "15.2 × 15.2 m". */
export function formatDimensions(width: number, length: number, units: Units): string {
  const w = Number.isInteger(width) ? String(width) : width.toFixed(1)
  const l = Number.isInteger(length) ? String(length) : length.toFixed(1)
  return `${w} × ${l} ${units}`
}

/** "50 × 50 ft · Gusau" */
export function formatPlotSummary(plot: { width: number; length: number; units: Units }, location?: string): string {
  const base = formatDimensions(plot.width, plot.length, plot.units)
  return location ? `${base} · ${location}` : base
}

export function formatArea(width: number, length: number, units: Units): string {
  const value = width * length
  const suffix = units === 'ft' ? 'ft²' : 'm²'
  return `${Math.round(value).toLocaleString('en-US')} ${suffix}`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function relativeTime(iso: string, now = Date.now()): string {
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return '—'
  const diff = Math.max(0, now - d)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

/** Short human labels for building types. */
export function buildingTypeLabel(type: string): string {
  const map: Record<string, string> = {
    bungalow: 'Bungalow',
    duplex: 'Duplex',
    detached: 'Detached house',
    'semi-detached': 'Semi-detached',
    flats: 'Block of flats',
    other: 'Other',
  }
  return map[type] ?? type
}

export function projectStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    'in-progress': 'In progress',
    review: 'In review',
    completed: 'Completed',
  }
  return map[status] ?? status
}
