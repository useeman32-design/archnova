import type { NewProjectForm, Project } from '@/types'
import { loadJSON, saveJSON, storageKeys } from '@/lib/storage'
import { createSampleProjects } from '@/data/projects'
import { createProjectFromForm } from '@/lib/projectFactory'
import { uid } from '@/lib/id'

/**
 * Project persistence contract.
 *
 * `createLocalProjectService` backs it with `localStorage` for the prototype.
 * The component layer only ever talks to this interface, so swapping in a
 * PHP/MySQL REST client later means implementing the same methods against
 * `fetch` — no component changes required.
 */
export interface ProjectService {
  list(): Promise<Project[]>
  get(id: string): Promise<Project | undefined>
  create(form: NewProjectForm): Promise<Project>
  update(id: string, patch: Partial<Project>): Promise<Project | undefined>
  duplicate(id: string): Promise<Project | undefined>
  remove(id: string): Promise<void>
  resetToSamples(): Promise<Project[]>
}

export function createLocalProjectService(): ProjectService {
  function read(): Project[] {
    const stored = loadJSON<Project[] | null>(storageKeys.projects, null)
    if (Array.isArray(stored) && stored.length > 0) return stored
    const samples = createSampleProjects()
    saveJSON(storageKeys.projects, samples)
    return samples
  }

  function write(projects: Project[]): void {
    saveJSON(storageKeys.projects, projects)
  }

  return {
    async list() {
      return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    async get(id) {
      return read().find((p) => p.id === id)
    },

    async create(form) {
      const projects = read()
      const project = createProjectFromForm(form)
      const now = new Date().toISOString()
      const next = { ...project, updatedAt: now }
      projects.push(next)
      write(projects)
      return next
    },

    async update(id, patch) {
      const projects = read()
      const index = projects.findIndex((p) => p.id === id)
      if (index === -1) return undefined
      const updated: Project = { ...projects[index], ...patch, id, updatedAt: new Date().toISOString() }
      projects[index] = updated
      write(projects)
      return updated
    },

    async duplicate(id) {
      const source = await this.get(id)
      if (!source) return undefined
      const now = new Date().toISOString()
      const copy: Project = {
        ...structuredClone(source),
        id: uid('proj'),
        name: `${source.name} (copy)`,
        status: 'draft',
        isSample: false,
        createdAt: now,
        updatedAt: now,
      }
      const projects = read()
      projects.push(copy)
      write(projects)
      return copy
    },

    async remove(id) {
      const projects = read().filter((p) => p.id !== id)
      write(projects)
    },

    async resetToSamples() {
      const samples = createSampleProjects()
      write(samples)
      return samples
    },
  }
}

export const projectService: ProjectService = createLocalProjectService()
