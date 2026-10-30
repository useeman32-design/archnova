import type { NewProjectForm, Project, ProjectPurpose } from '@/types'
import { uid } from './id'
import { generateFloors } from './floorPlan'
import { normalizeProjectModel } from './projectModel'

export function createProjectFromForm(form: NewProjectForm, seed?: number): Project {
  const now = new Date().toISOString()
  const id = seed != null ? uid('proj', seed) : uid('proj')
  const purpose: ProjectPurpose = form.purpose ?? (form.buildingType === 'other'
    ? { category: 'other', use: 'custom' }
    : { category: 'residential', use: form.buildingType })
  const isResidential = purpose.category === 'residential'
  const floors = isResidential
    ? generateFloors(form)
    : [{ id: uid('floor'), name: 'Ground floor', level: 1, rooms: [] }]
  const assumptions = isResidential
    ? ['The generated room layout is a conceptual starter plan and requires review.']
    : ['Project purpose is recorded, but a non-residential space schedule and floor layout have not been generated yet.']
  const project: Project = {
    id,
    name: form.name.trim() || 'Untitled project',
    status: seed != null ? 'in-progress' : 'draft',
    buildingType: form.buildingType,
    purpose,
    brief: {
      purpose,
      goals: form.notes.trim() || undefined,
      requiredSpaces: form.rooms.filter((name) => name.trim()).map((name, index) => ({
        id: `space:${id}:${index + 1}`,
        name: name.trim(),
        category: isResidential ? name : 'other',
        quantity: 1,
      })),
      constraints: [...form.constraints],
      preferences: [form.style, form.roof].filter(Boolean),
      assumptions,
    },
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
    floors,
    preferences: {
      style: form.style,
      roof: form.roof,
      exteriorFinish: form.exteriorFinish,
      interiorFinish: form.interiorFinish,
      outdoor: [...form.outdoor],
      notes: form.notes,
    },
  }
  return normalizeProjectModel(project)
}
