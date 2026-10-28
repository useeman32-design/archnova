import { useCallback, useEffect, useState } from 'react'
import type { NewProjectForm, Project } from '@/types'
import { projectService } from '@/services/projectService'

/** Project list + mutations, backed by the (swappable) ProjectService. */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const list = await projectService.list()
    setProjects(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createProject = useCallback(async (form: NewProjectForm) => {
    const project = await projectService.create(form)
    setProjects((prev) => [project, ...prev.filter((p) => p.id !== project.id)])
    return project
  }, [])

  const updateProject = useCallback(async (id: string, patch: Partial<Project>) => {
    const updated = await projectService.update(id, patch)
    if (updated) setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)))
    return updated
  }, [])

  const duplicateProject = useCallback(async (id: string) => {
    const copy = await projectService.duplicate(id)
    if (copy) setProjects((prev) => [copy, ...prev])
    return copy
  }, [])

  const removeProject = useCallback(async (id: string) => {
    await projectService.remove(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects],
  )

  const resetSamples = useCallback(async () => {
    const samples = await projectService.resetToSamples()
    setProjects(samples)
  }, [])

  return {
    projects,
    loading,
    refresh,
    createProject,
    updateProject,
    duplicateProject,
    removeProject,
    getProject,
    resetSamples,
  }
}
