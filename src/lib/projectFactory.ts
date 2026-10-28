import type { NewProjectForm, Project } from '@/types'
import { uid } from './id'
import { generateFloors } from './floorPlan'

export function createProjectFromForm(form: NewProjectForm, seed?: number): Project {
  const now = new Date().toISOString()
  return {
    id: seed != null ? uid('proj', seed) : uid('proj'),
    name: form.name.trim() || 'Untitled project',
    status: seed != null ? 'in-progress' : 'draft',
    buildingType: form.buildingType,
    location: form.location,
    plot: {
      width: form.plotWidth,
      length: form.plotLength,
      units: form.units,
      shape: form.plotShape,
      location: form.location,
    },
    bedrooms: form.bedrooms,
    bathrooms: form.bathrooms,
    style: form.style,
    roof: form.roof,
    budget: { ...form.budget },
    thumbnailSeed: seed != null ? seed : Math.floor(Math.random() * 1000),
    isSample: seed != null,
    createdAt: now,
    updatedAt: now,
    floors: generateFloors(form),
    preferences: {
      style: form.style,
      roof: form.roof,
      exteriorFinish: form.exteriorFinish,
      interiorFinish: form.interiorFinish,
      outdoor: [...form.outdoor],
      notes: form.notes,
    },
  }
}
