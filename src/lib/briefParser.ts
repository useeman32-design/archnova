import type { NewProjectForm, OutdoorFeature } from '@/types'
import { defaultNewProjectForm } from './defaultForm'

/**
 * On-device brief interpreter (demo).
 *
 * Extracts the obvious facts from a natural-language sentence — bedroom count,
 * plot size, building type, outdoor features — so the assistant can offer to
 * create a project straight from a prompt. This is a *frontend stand-in* for
 * the Groq-powered workspace assistant now handles these prompts directly;
 * this small parser remains as a standalone offline utility for forms only.
 */

export interface ParsedBrief {
  form: NewProjectForm
  /** Human-readable summary of what was understood. */
  summary: string
  /** True when the sentence carried enough signal to draft a project. */
  confident: boolean
}

export function parseBrief(prompt: string, locationFallback = ''): ParsedBrief {
  const text = prompt.toLowerCase()
  const form = defaultNewProjectForm()
  const found: string[] = []

  const beds = text.match(/(\d+)\s*(?:bed|bedroom)/)
  if (beds) {
    form.bedrooms = clamp(parseInt(beds[1], 10), 1, 12)
    form.bathrooms = Math.max(1, Math.round(form.bedrooms * 0.7))
    form.rooms = ['living', 'dining', 'kitchen']
    found.push(`${form.bedrooms} bedroom${form.bedrooms > 1 ? 's' : ''}`)
  }

  const baths = text.match(/(\d+)\s*(?:bath|bathroom|en-?suite)/)
  if (baths) {
    form.bathrooms = clamp(parseInt(baths[1], 10), 1, 12)
    found.push(`${form.bathrooms} bathroom${form.bathrooms > 1 ? 's' : ''}`)
  }

  const plot = text.match(/(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(ft|feet|m|metres|meters)?/)
  if (plot) {
    form.plotWidth = clamp(parseFloat(plot[1]), 10, 400)
    form.plotLength = clamp(parseFloat(plot[2]), 10, 400)
    if (plot[3]?.startsWith('m')) form.units = 'm'
    found.push(`${form.plotWidth} × ${form.plotLength} ${form.units} plot`)
  }

  if (/(duplex|two storey|two-storey|2 storey|storey house)/.test(text)) {
    form.buildingType = 'duplex'
    found.push('duplex')
  } else if (/(bungalow|single storey|single-storey|flat roof house)/.test(text)) {
    form.buildingType = 'bungalow'
    found.push('bungalow')
  }

  const outdoor: OutdoorFeature[] = []
  if (/(pool|swimming)/.test(text)) outdoor.push('pool')
  if (/(garage|car ?port|carport)/.test(text)) outdoor.push('garage')
  else if (/(car park|parking|driveway)/.test(text)) outdoor.push('parking')
  if (/(garden|landscap|lawn)/.test(text)) outdoor.push('garden')
  if (/(terrace|veranda|porch|patio)/.test(text)) outdoor.push('terrace')
  if (/(fence|boundary wall)/.test(text)) outdoor.push('fence')
  if (outdoor.length) {
    form.outdoor = outdoor
    found.push(outdoor.join(', '))
  }

  if (/(modern|contemporary|minimal)/.test(text)) form.style = 'modern-minimal'
  else if (/(tropical)/.test(text)) form.style = 'tropical'
  else if (/(traditional|classic)/.test(text)) form.style = 'traditional'

  const city = text.match(/\bin ([a-z][a-z '-]{2,20})\b/)
  if (city && !/(plot|ft|metres|meters|front|back|mind|view)/.test(city[1])) {
    form.location = titleCase(city[1].trim())
    found.push(form.location)
  } else if (locationFallback) {
    form.location = locationFallback
  }

  if (!form.name || form.name === '') {
    form.name = form.bedrooms
      ? `${form.bedrooms} Bedroom ${form.buildingType === 'duplex' ? 'Duplex' : 'Bungalow'}`
      : 'AI brief project'
  }

  return {
    form,
    summary: found.length ? `Understood: ${found.join(' · ')}.` : '',
    confident: Boolean(beds || plot),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
