import type { Building, Project, ProjectPurpose, SiteBoundary, SiteModel, SiteVertex } from '@/types'

/**
 * Compatibility boundary for the generalized project model.
 *
 * Existing editors still read/write Project.floors. The primary Building
 * mirrors that field so the shared domain model can grow to multiple buildings
 * without breaking older workspace code. Project-service mutations must use
 * mergeProjectModelUpdate so the two representations cannot drift.
 */
export function normalizeProjectModel(project: Project): Project {
  const purpose = project.purpose ?? purposeFromLegacyType(project.buildingType)
  const site = project.site ?? createSiteModel(project)
  const existingBuildings = Array.isArray(project.buildings) ? project.buildings : []
  const buildings = existingBuildings.length > 0
    ? normalizeBuildings(existingBuildings, purpose, project.floors)
    : [createPrimaryBuilding(project, purpose)]
  const primary = buildings.find((building) => building.role === 'primary') ?? buildings[0]

  return {
    ...project,
    purpose,
    brief: project.brief ? { ...project.brief, purpose } : {
      purpose,
      requiredSpaces: [],
      constraints: [],
      preferences: [],
      assumptions: [...site.assumptions],
    },
    site,
    buildings,
    // Keep the primary-building projection for the current 2D/3D views.
    floors: primary.floors,
  }
}

/** Merge a local project-service update and synchronize the compatibility view. */
export function mergeProjectModelUpdate(project: Project, patch: Partial<Project>): Project {
  const previous = normalizeProjectModel(project)
  const merged = { ...previous, ...patch }
  const patchHasBuildings = Object.prototype.hasOwnProperty.call(patch, 'buildings')
  const patchHasFloors = Object.prototype.hasOwnProperty.call(patch, 'floors')
  const patchHasPurpose = Object.prototype.hasOwnProperty.call(patch, 'purpose')
  const patchHasBuildingType = Object.prototype.hasOwnProperty.call(patch, 'buildingType')

  if (patch.plot && !Object.prototype.hasOwnProperty.call(patch, 'site')) {
    const previousSite = previous.site
    const boundary = previousSite?.boundary
    if (boundary?.source === 'dimension-derived') {
      const derived = createSiteModel(merged)
      merged.site = {
        ...derived,
        northDirectionDegrees: previousSite?.northDirectionDegrees ?? null,
        orientationSource: previousSite?.orientationSource ?? 'unknown',
      }
    } else if (boundary) {
      const scale = lengthUnitScale(previous.plot.units, merged.plot.units)
      const vertices = boundary.vertices.map((vertex) => ({ ...vertex, x: vertex.x * scale, y: vertex.y * scale }))
      const isKnownPolygon = vertices.length >= 3
      merged.site = {
        ...(previousSite ?? { assumptions: [] }),
        boundary: {
          ...boundary,
          shape: merged.plot.shape,
          vertices,
          units: merged.plot.units,
          ...(boundary.area !== undefined ? { area: boundary.area * scale * scale } : {}),
          ...(isKnownPolygon ? {} : { status: 'unknown' as const }),
        },
      }
    }
  }

  if (patchHasBuildings) {
    const buildings = Array.isArray(patch.buildings) ? patch.buildings : []
    const primary = buildings.find((building) => building.role === 'primary') ?? buildings[0]
    if (primary) {
      merged.purpose = primary.purpose
      merged.floors = primary.floors
    }
  } else if (patchHasFloors) {
    const buildings = [...(previous.buildings ?? [])]
    const primaryIndex = Math.max(0, buildings.findIndex((building) => building.role === 'primary'))
    const primary = buildings[primaryIndex]
    if (primary) {
      buildings[primaryIndex] = {
        ...primary,
        floors: patch.floors ?? [],
        purpose: patchHasPurpose ? (patch.purpose ?? primary.purpose) : primary.purpose,
      }
    }
    merged.buildings = buildings
  } else if (patchHasPurpose) {
    merged.buildings = (previous.buildings ?? []).map((building) => building.role === 'primary'
      ? { ...building, purpose: patch.purpose ?? building.purpose }
      : building)
  } else if (patchHasBuildingType && previous.purpose?.category === 'residential' && merged.buildingType !== 'other') {
    const purpose = purposeFromLegacyType(merged.buildingType)
    merged.purpose = purpose
    merged.buildings = (previous.buildings ?? []).map((building) => building.role === 'primary'
      ? { ...building, purpose }
      : building)
  }

  return normalizeProjectModel(merged)
}

function normalizeBuildings(buildings: Building[], projectPurpose: ProjectPurpose, compatibilityFloors: Project['floors']): Building[] {
  const chosenPrimary = buildings.find((building) => building.role === 'primary') ?? buildings[0]
  return buildings.map((building) => {
    const isPrimary = building.id === chosenPrimary.id
    return {
      ...building,
      role: isPrimary ? 'primary' : (building.role === 'primary' ? 'secondary' : building.role),
      purpose: building.purpose ?? (isPrimary ? projectPurpose : { category: 'other', use: 'unspecified' }),
      floors: isPrimary ? (Array.isArray(building.floors) ? building.floors : compatibilityFloors) : (building.floors ?? []),
      assumptions: building.assumptions ?? [],
    }
  })
}

function createPrimaryBuilding(project: Project, purpose: ProjectPurpose): Building {
  return {
    id: `building:${project.id}:primary`,
    name: project.name,
    purpose,
    role: 'primary',
    floors: project.floors ?? [],
    assumptions: [],
  }
}

function createSiteModel(project: Project): SiteModel {
  const assumptions: string[] = []
  const rectangular = project.plot.shape === 'square' || project.plot.shape === 'rectangle'
  let boundary: SiteBoundary | undefined

  if (rectangular) {
    const width = Math.max(0, project.plot.width)
    const length = Math.max(0, project.plot.length)
    const vertices: SiteVertex[] = [
      { id: `site:${project.id}:v1`, x: 0, y: 0 },
      { id: `site:${project.id}:v2`, x: width, y: 0 },
      { id: `site:${project.id}:v3`, x: width, y: length },
      { id: `site:${project.id}:v4`, x: 0, y: length },
    ]
    assumptions.push('Boundary polygon is derived from the entered rectangular dimensions; frontage and north direction are unspecified.')
    boundary = {
      id: `site:${project.id}:boundary`,
      shape: project.plot.shape,
      vertices,
      units: project.plot.units,
      status: 'assumed',
      source: 'dimension-derived',
      area: width * length,
      assumptions: [...assumptions],
    }
  } else {
    // Dimensions plus a shape label do not define an irregular/corner polygon.
    assumptions.push(`The ${project.plot.shape} boundary has no vertex survey or user-drawn points yet; no polygon has been fabricated.`)
    boundary = {
      id: `site:${project.id}:boundary`,
      shape: project.plot.shape,
      vertices: [],
      units: project.plot.units,
      status: 'unknown',
      source: 'unknown',
      assumptions: [...assumptions],
    }
  }

  return {
    boundary,
    northDirectionDegrees: null,
    orientationSource: 'unknown',
    assumptions,
  }
}

function lengthUnitScale(from: Project['plot']['units'], to: Project['plot']['units']): number {
  if (from === to) return 1
  return from === 'ft' ? 0.3048 : 1 / 0.3048
}

function purposeFromLegacyType(buildingType: Project['buildingType']): ProjectPurpose {
  if (buildingType === 'other') return { category: 'other', use: 'custom' }
  return { category: 'residential', use: buildingType }
}
