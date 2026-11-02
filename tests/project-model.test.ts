import { describe, expect, it } from 'vitest'
import type { Building, Project } from '@/types'
import { defaultNewProjectForm } from '@/lib/defaultForm'
import { createProjectFromForm } from '@/lib/projectFactory'
import { mergeProjectModelUpdate, normalizeProjectModel, translateBuildingFootprint } from '@/lib/projectModel'
import { convertBuildingLayoutUnits } from '@/lib/unitConversion'

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

  it('translates an explicit building footprint without changing edge IDs or entrance anchors', () => {
    const building: Building = {
      id: 'building:block-a',
      name: 'Block A',
      purpose: { category: 'residential', use: 'bungalow' },
      role: 'secondary',
      floors: [{ id: 'floor-ground', name: 'Ground Floor', level: 1, rooms: [{
        id: 'room-living', name: 'Living Room', category: 'living', width: 10, length: 8, units: 'ft',
        rect: { x: 15, y: 12, w: 10, h: 8 }, level: 1, furniture: [], elements: [],
      }] }],
      footprint: {
        id: 'footprint:block-a', shape: 'rectangle', units: 'ft', status: 'defined', source: 'user-drawn', assumptions: [],
        vertices: [
          { id: 'a1', x: 10, y: 10 }, { id: 'a2', x: 30, y: 10 },
          { id: 'a3', x: 30, y: 24 }, { id: 'a4', x: 10, y: 24 },
        ],
      },
      entrances: [{ id: 'main-entry', fromVertexId: 'a1', toVertexId: 'a2', fraction: 0.4, type: 'main' }],
      assumptions: [],
    }
    const moved = translateBuildingFootprint(building, 5.25, -2)

    expect(moved.footprint?.vertices).toEqual([
      { id: 'a1', x: 15.25, y: 8 }, { id: 'a2', x: 35.25, y: 8 },
      { id: 'a3', x: 35.25, y: 22 }, { id: 'a4', x: 15.25, y: 22 },
    ])
    expect(moved.entrances).toEqual(building.entrances)
    expect(moved.floors[0].rooms[0].rect).toMatchObject({ x: 20.25, y: 10, w: 10, h: 8 })
    expect(moved.footprint?.units).toBe('ft')
    const metric = convertBuildingLayoutUnits(moved, 'm')
    expect(metric.footprint?.units).toBe('m')
    expect(metric.footprint?.vertices[0].x).toBeCloseTo(15.25 * 0.3048)
    expect(metric.floors[0].rooms[0].rect.x).toBeCloseTo(20.25 * 0.3048)
    expect(metric.floors[0].rooms[0].units).toBe('m')
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
      entrances: [{ id: 'service-entry', fromVertexId: 'service-v1', toVertexId: 'service-v2', fraction: 0.6, type: 'service' }],
      assumptions: [],
    }
    const multiBuilding = mergeProjectModelUpdate(project, { buildings: [primary, secondary] })
    const changedFloors = multiBuilding.floors.map((floor) => ({ ...floor, name: 'Updated ' + floor.name }))
    const legacyEdit = mergeProjectModelUpdate(multiBuilding, { floors: changedFloors })

    expect(legacyEdit.buildings?.find((building) => building.role === 'primary')?.floors).toEqual(changedFloors)
    expect(legacyEdit.buildings?.find((building) => building.id === secondary.id)?.floors).toEqual(secondary.floors)
    expect(legacyEdit.buildings?.find((building) => building.id === secondary.id)?.entrances).toEqual(secondary.entrances)
    expect(legacyEdit.floors).toEqual(changedFloors)

    const updatedPrimary = { ...legacyEdit.buildings![0], name: 'Main hospital block' }
    const buildingEdit = mergeProjectModelUpdate(legacyEdit, { buildings: [updatedPrimary, secondary] })
    expect(buildingEdit.floors).toEqual(updatedPrimary.floors)
    expect(buildingEdit.brief?.purpose).toEqual(buildingEdit.purpose)
  })

  it('converts explicit per-edge setbacks with the boundary units', () => {
    const project = projectFixture()
    const boundary = project.site?.boundary
    if (!boundary) throw new Error('Factory should create a dimension-derived boundary.')
    const updated = mergeProjectModelUpdate({
      ...project,
      site: { ...project.site!, accessPoints: [{ id: 'gate-entry', fromVertexId: boundary.vertices[0].id, toVertexId: boundary.vertices[1].id, fraction: 0.35, type: 'vehicle' }], boundary: { ...boundary, source: 'user-drawn', status: 'defined', edgeLabels: [
        { fromVertexId: boundary.vertices[0].id, toVertexId: boundary.vertices[1].id, type: 'front', setback: 8 },
      ] } },
    }, { plot: { ...project.plot, units: 'm' } })
    expect(updated.site?.boundary?.edgeLabels?.[0].setback).toBeCloseTo(8 * 0.3048)
    expect(updated.site?.accessPoints?.[0]).toMatchObject({ id: 'gate-entry', fraction: 0.35, type: 'vehicle' })
  })

  it('converts saved route widths and waypoints when plot units change', () => {
    const project = projectFixture()
    const route = { id: 'walk', kind: 'path' as const, fromAccessPointId: 'edge-access', toBuildingId: 'block', toEntranceId: 'door', width: 4, units: 'ft' as const, waypoints: [{ x: 10, y: 20 }] }
    const withRoute = { ...project, site: { ...project.site!, routes: [route] } }
    const updated = mergeProjectModelUpdate(withRoute, { plot: { ...project.plot, units: 'm' } })
    expect(updated.site?.routes?.[0]).toMatchObject({ units: 'm', width: 4 * 0.3048, waypoints: [{ x: 10 * 0.3048, y: 20 * 0.3048 }] })
  })

  it('preserves an edge-referenced access point when a dimension-derived plot changes units', () => {
    const project = projectFixture()
    const boundary = project.site?.boundary!
    const withAccess = {
      ...project,
      site: { ...project.site!, accessPoints: [{ id: 'front-walk', fromVertexId: boundary.vertices[0].id, toVertexId: boundary.vertices[1].id, fraction: 0.7, type: 'pedestrian' as const }] },
    }
    const updated = mergeProjectModelUpdate(withAccess, { plot: { ...project.plot, units: 'm' } })
    expect(updated.site?.accessPoints).toEqual(withAccess.site.accessPoints)
    expect(updated.site?.boundary?.units).toBe('m')
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
