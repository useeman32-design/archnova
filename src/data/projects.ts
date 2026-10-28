import type {
  BuildingType,
  NewProjectForm,
  OutdoorFeature,
  Project,
  ProjectStatus,
  Units,
} from '@/types'
import { createProjectFromForm } from '@/lib/projectFactory'
import { defaultNewProjectForm } from '@/lib/defaultForm'

interface SampleDef {
  seed: number
  name: string
  location: string
  plotWidth: number
  plotLength: number
  units: Units
  buildingType: BuildingType
  bedrooms: number
  bathrooms: number
  outdoor: OutdoorFeature[]
  style: string
  roof: string
  status: ProjectStatus
  budget: number
  updatedAt: string
}

const SAMPLES: SampleDef[] = [
  {
    seed: 1001,
    name: '3 Bedroom Bungalow',
    location: 'Gusau',
    plotWidth: 50,
    plotLength: 50,
    units: 'ft',
    buildingType: 'bungalow',
    bedrooms: 3,
    bathrooms: 2,
    outdoor: ['parking', 'garden', 'pool'],
    style: 'modern-minimal',
    roof: 'flat',
    status: 'in-progress',
    budget: 4500000,
    updatedAt: '2026-10-22T09:24:00.000Z',
  },
  {
    seed: 1002,
    name: '2 Bedroom Modern House',
    location: 'Lagos',
    plotWidth: 40,
    plotLength: 60,
    units: 'ft',
    buildingType: 'detached',
    bedrooms: 2,
    bathrooms: 2,
    outdoor: ['parking', 'garden', 'terrace'],
    style: 'contemporary',
    roof: 'pitched-gable',
    status: 'completed',
    budget: 6200000,
    updatedAt: '2026-10-15T14:02:00.000Z',
  },
  {
    seed: 1003,
    name: '4 Bedroom Duplex',
    location: 'Abuja',
    plotWidth: 60,
    plotLength: 80,
    units: 'ft',
    buildingType: 'duplex',
    bedrooms: 4,
    bathrooms: 4,
    outdoor: ['garage', 'garden', 'terrace', 'fence'],
    style: 'modern-minimal',
    roof: 'flat',
    status: 'review',
    budget: 18500000,
    updatedAt: '2026-10-24T11:48:00.000Z',
  },
  {
    seed: 1004,
    name: '3 Bedroom Family Home',
    location: 'Port Harcourt',
    plotWidth: 45,
    plotLength: 60,
    units: 'ft',
    buildingType: 'bungalow',
    bedrooms: 3,
    bathrooms: 2,
    outdoor: ['parking', 'garden'],
    style: 'tropical',
    roof: 'pitched-gable',
    status: 'draft',
    budget: 3800000,
    updatedAt: '2026-10-08T08:10:00.000Z',
  },
  {
    seed: 1005,
    name: '5 Bedroom Duplex',
    location: 'Kaduna',
    plotWidth: 70,
    plotLength: 90,
    units: 'ft',
    buildingType: 'duplex',
    bedrooms: 5,
    bathrooms: 5,
    outdoor: ['garage', 'garden', 'pool', 'barbecue'],
    style: 'mediterranean',
    roof: 'hip',
    status: 'in-progress',
    budget: 32000000,
    updatedAt: '2026-10-26T16:35:00.000Z',
  },
]

/** Builds the demonstration project list. These are sample records, not real customers. */
export function createSampleProjects(): Project[] {
  return SAMPLES.map((def) => {
    const form: NewProjectForm = {
      ...defaultNewProjectForm(),
      name: def.name,
      location: def.location,
      plotWidth: def.plotWidth,
      plotLength: def.plotLength,
      units: def.units,
      plotShape: def.plotWidth === def.plotLength ? 'square' : 'rectangle',
      buildingType: def.buildingType,
      bedrooms: def.bedrooms,
      bathrooms: def.bathrooms,
      outdoor: [...def.outdoor],
      style: def.style,
      roof: def.roof,
      budget: { amount: def.budget, currency: 'NGN' },
    }
    const project = createProjectFromForm(form, def.seed)
    return {
      ...project,
      status: def.status,
      updatedAt: def.updatedAt,
      createdAt: '2026-09-0' + ((def.seed % 9) + 1) + 'T08:00:00.000Z',
      isSample: true,
    }
  })
}

export const SAMPLE_PROJECTS = createSampleProjects()
