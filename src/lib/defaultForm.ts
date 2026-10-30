import type { NewProjectForm } from '@/types'

export function defaultNewProjectForm(): NewProjectForm {
  return {
    name: '',
    location: '',
    plotWidth: 50,
    plotLength: 50,
    units: 'ft',
    plotShape: 'rectangle',
    constraints: [],
    buildingType: 'bungalow',
    purpose: { category: 'residential', use: 'bungalow' },
    bedrooms: 3,
    bathrooms: 2,
    rooms: ['living'],
    outdoor: ['parking', 'garden'],
    style: 'modern-minimal',
    roof: 'flat',
    exteriorFinish: 'render',
    interiorFinish: 'wood',
    budget: { amount: 4500000, currency: 'NGN' },
    notes: '',
  }
}
