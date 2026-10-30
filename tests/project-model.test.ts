import { describe, expect, it } from 'vitest'
import type { Building, Project } from '@/types'
import { defaultNewProjectForm } from '@/lib/defaultForm'
import { createProjectFromForm } from '@/lib/projectFactory'
import { mergeProjectModelUpdate, normalizeProjectModel } from '@/lib/projectModel'

function projectFixture() {
  return createProjectFromForm({ ...defaultNewProjectForm(), name: 'Model test' }, 9401)
}

describe('generalized architectural project model', () => {
  it('migrates a legacy residential record and preserves its primary floors', () => {
    const current = projectFixture()
    const { purpose: _purpose, brief: _brief, site: _site, buildings: _buildings, ...legacy } = current
    const migrated = normalizeProjectModel(legacy as Project)

    expect(migrated.purpose).toEqual({ category: 'residential', use: 'bungalow' })
    expect(migrated.buildings).toHaveLength(1)
    expect(migrated.buildings?.[0].role).toBe('primary')
    expect(migrated.buildings?.[0].floors).toEqual(current.floors)
    expect(migrated.floors).toEqual(current.floors)
  })

  it('records dimension-derived rectangular geometry and leaves north/frontage unknown', () => {
    const project = projectFixture()
    const boundary = project.site?.boundary

    expect(boundary?.status).toBe('assumed')
    expect(boundary?.source).toBe('dimension-derived')
    expect(boundary?.vertices).toHaveLength(4)
    expect(boundary?.area).toBe(project.plot.width * project.plot.length)
    expect(project.site?.northDirectionDegrees).toBeNull()
    expect(project.site?.orientationSource).toBe('unknown')
  })

  it('does not fabricate vertices for irregular or corner plots without boundary points', () => {
    const project = projectFixture()
    for (const shape of ['irregular', 'corner'] as const) {
      const migrated = normalizeProjectModel({
        ...project,
        plot: { ...project.plot, shape },
        site: undefined,
      })
      expect(migrated.site?.boundary?.shape).toBe(shape)
      expect(migrated.site?.boundary?.status).toBe('unknown')
      expect(migrated.site?.boundary?.vertices).toEqual([])
      expect(migrated.site?.boundary?.assumptions.join(' ')).toContain('no polygon has been fabricated')
    }
  })

  it('represents non-residential purposes without inventing a house room plan', () => {
    const form = {
      ...defaultNewProjectForm(),
      buildingType: 'other' as const,
      purpose: { category: 'institutional' as const, use: 'hospital' },
    }
    const project = createProjectFromForm(form, 9402)

    expect(project.purpose).toEqual({ category: 'institutional', use: 'hospital' })
    expect(project.brief?.purpose).toEqual(project.purpose)
    expect(project.floors).toHaveLength(1)
    expect(project.floors[0].rooms).toEqual([])
    expect(project.brief?.assumptions.join(' ')).toContain('have not been generated yet')
  })

  it('keeps primary floors and multi-building data synchronized through project updates', () => {
    const project = projectFixture()
    const primary = project.buildings?.[0]
    if (!primary) throw new Error('Factory should create a primary building.')
    const secondary: Building = {
      id: 'building:service',
      name: 'Generator house',
      purpose: { category: 'industrial', use: 'generator-house' },
      role: 'service',
      floors: [{ id: 'floor:service', name: 'Ground floor', level: 1, rooms: [] }],
      assumptions: [],
    }
    const multiBuilding = mergeProjectModelUpdate(project, { buildings: [primary, secondary] })
    const changedFloors = multiBuilding.floors.map((floor) => ({ ...floor, name: 'Updated ' + floor.name }))
    const legacyEdit = mergeProjectModelUpdate(multiBuilding, { floors: changedFloors })

    expect(legacyEdit.buildings?.find((building) => building.role === 'primary')?.floors).toEqual(changedFloors)
    expect(legacyEdit.buildings?.find((building) => building.id === secondary.id)?.floors).toEqual(secondary.floors)
    expect(legacyEdit.floors).toEqual(changedFloors)

    const updatedPrimary = { ...legacyEdit.buildings![0], name: 'Main hospital block' }
    const buildingEdit = mergeProjectModelUpdate(legacyEdit, { buildings: [updatedPrimary, secondary] })
    expect(buildingEdit.floors).toEqual(updatedPrimary.floors)
    expect(buildingEdit.brief?.purpose).toEqual(buildingEdit.purpose)
  })

  it('updates dimension-derived boundary geometry when plot dimensions or units change', () => {
    const project = projectFixture()
    const updated = mergeProjectModelUpdate(project, {
      plot: { ...project.plot, width: 15, length: 30, units: 'm' },
    })
    expect(updated.site?.boundary?.units).toBe('m')
    expect(updated.site?.boundary?.area).toBe(450)
    expect(updated.site?.boundary?.vertices[2]).toMatchObject({ x: 15, y: 30 })
  })
})
