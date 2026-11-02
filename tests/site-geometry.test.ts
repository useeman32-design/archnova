import { describe, expect, it } from 'vitest'
import type { Building, LandscapeItem, SiteBoundary, SiteRoute, SiteVertex } from '@/types'
import { classifyBoundaryShape, describeSiteEdgeLabel, findSiteEdgeLabel, pointInPolygon, polygonArea, resolveSiteRoutePoints, siteEdgeLength, validateSiteBoundary, validateSiteBuildingPlacement, validateSiteParkingBays, validateSiteRoutes } from '@/lib/siteGeometry'

const polygon = (...points: [number, number][]): SiteVertex[] => points.map(([x, y], index) => ({ id: `v${index + 1}`, x, y }))
const siteBuilding = (id: string, x: number, y: number, width: number, length: number, units: 'ft' | 'm' = 'ft'): Building => ({
  id, name: id, purpose: { category: 'commercial', use: 'test' }, role: 'secondary', floors: [], assumptions: [],
  footprint: {
    id: `footprint:${id}`, shape: 'rectangle', vertices: polygon([x, y], [x + width, y], [x + width, y + length], [x, y + length]),
    units, status: 'defined', source: 'user-drawn', assumptions: [],
  },
})
const rectangularBoundary = (width: number, length: number, units: 'ft' | 'm' = 'ft', setback = 0): SiteBoundary => ({
  id: 'site-boundary', shape: 'rectangle', vertices: polygon([0, 0], [width, 0], [width, length], [0, length]), units,
  status: 'defined', source: 'user-drawn', assumptions: [],
  edgeLabels: setback > 0 ? [{ fromVertexId: 'v1', toVertexId: 'v2', type: 'front', setback }] : [],
})

describe('site boundary geometry', () => {
  it('calculates polygon area for a concave L-shaped site', () => {
    const outline = polygon([0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10])
    expect(polygonArea(outline)).toBe(64)
    expect(pointInPolygon({ x: 2, y: 8 }, outline)).toBe(true)
    expect(pointInPolygon({ x: 8, y: 8 }, outline)).toBe(false)
  })

  it('classifies only axis-aligned four-corner outlines as square or rectangle', () => {
    expect(classifyBoundaryShape(polygon([0, 0], [20, 0], [20, 20], [0, 20]))).toBe('square')
    expect(classifyBoundaryShape(polygon([0, 0], [30, 0], [30, 20], [0, 20]))).toBe('rectangle')
    expect(classifyBoundaryShape(polygon([0, 0], [30, 0], [30, 20], [12, 20], [12, 8], [0, 8]))).toBe('irregular')
  })

  it('rejects self-crossing, duplicated, zero-area and out-of-envelope boundaries', () => {
    const bowtie = polygon([0, 0], [10, 10], [0, 10], [10, 0])
    const bowtieIssues = validateSiteBoundary(bowtie, { width: 10, length: 10 })
    expect(bowtieIssues.some((issue) => issue.code === 'self-intersection')).toBe(true)
    expect(bowtieIssues.some((issue) => issue.code === 'zero-area')).toBe(true)

    const outside = polygon([0, 0], [12, 0], [12, 10], [0, 10])
    expect(validateSiteBoundary(outside, { width: 10, length: 10 }).some((issue) => issue.code === 'outside-envelope')).toBe(true)

    const duplicated = polygon([0, 0], [10, 0], [10, 0], [0, 10])
    expect(validateSiteBoundary(duplicated).some((issue) => issue.code === 'duplicate-vertex')).toBe(true)
  })

  it('requires at least three points and treats boundary points as inside', () => {
    expect(validateSiteBoundary(polygon([0, 0], [1, 0])).map((issue) => issue.code)).toContain('too-few-vertices')
    const rect = polygon([0, 0], [10, 0], [10, 8], [0, 8])
    expect(pointInPolygon({ x: 10, y: 3 }, rect)).toBe(true)
    expect(validateSiteBoundary(rect, { width: 10, length: 8 })).toEqual([])
  })

  it('reports deterministic building overlap, boundary overflow, setbacks, and unit-normalized clear placement', () => {
    const boundary = rectangularBoundary(40, 30, 'ft', 5)
    const validA = siteBuilding('A', 8, 6, 8, 8)
    const validB = siteBuilding('B', 20, 6, 8, 8)
    expect(validateSiteBuildingPlacement([validA, validB], boundary, 'ft')).toEqual([])

    const overlapping = siteBuilding('Overlap', 12, 8, 8, 8)
    const setbackViolation = siteBuilding('Near front', 4, 1, 6, 6)
    const outside = siteBuilding('Outside', 37, 8, 6, 6)
    const issues = validateSiteBuildingPlacement([validA, overlapping, setbackViolation, outside], boundary, 'ft')
    expect(issues.map((issue) => issue.code)).toContain('overlapping-site-buildings')
    expect(issues.map((issue) => issue.code)).toContain('site-building-violates-setback')
    expect(issues.map((issue) => issue.code)).toContain('site-building-outside-boundary')

    const meterBuilding = siteBuilding('Metric', 3, 3, 3, 3, 'm')
    expect(validateSiteBuildingPlacement([meterBuilding], rectangularBoundary(100, 100, 'ft'), 'ft')).toEqual([])
  })

  it('checks conceptual parking bays against the plot, buildings, and other bays', () => {
    const boundary = rectangularBoundary(40, 30)
    const bay = (id: string, x: number, y: number): LandscapeItem => ({ id, kind: 'parking-bay', x, y, rotation: 0, scale: 1, color: '#59616a', width: 9, length: 18 })
    const clearBay = bay('clear', 10, 15)
    expect(validateSiteParkingBays([clearBay], [], boundary, { width: 40, length: 30 }, 'ft')).toEqual([])
    const building = siteBuilding('Block', 8, 10, 6, 8)
    const issues = validateSiteParkingBays([clearBay, bay('overlap', 11, 16), bay('outside', 39, 28)], [building], boundary, { width: 40, length: 30 }, 'ft')
    expect(issues.map((issue) => issue.code)).toContain('parking-bay-overlaps-building')
    expect(issues.map((issue) => issue.code)).toContain('overlapping-parking-bays')
    expect(issues.map((issue) => issue.code)).toContain('parking-bay-outside-boundary')
  })

  it('resolves user-drawn routes between explicit boundary access and building entrance anchors', () => {
    const boundary = rectangularBoundary(40, 30)
    const access = { id: 'gate', fromVertexId: 'v1', toVertexId: 'v2', fraction: 0.25, type: 'vehicle' as const }
    const building = siteBuilding('Block', 20, 15, 8, 8)
    building.entrances = [{ id: 'main-door', fromVertexId: 'v1', toVertexId: 'v2', fraction: 0.5, type: 'main' }]
    const route: SiteRoute = { id: 'drive', kind: 'road', fromAccessPointId: access.id, toBuildingId: building.id, toEntranceId: 'main-door', width: 12, units: 'ft', waypoints: [{ x: 16, y: 8 }] }
    const site = { boundary, accessPoints: [access], routes: [route], assumptions: [] }
    expect(resolveSiteRoutePoints(route, site, [building], 'ft')).toEqual([{ x: 10, y: 0 }, { x: 16, y: 8 }, { x: 24, y: 15 }])
    expect(validateSiteRoutes([route], site, [building], { width: 40, length: 30 }, 'ft')).toEqual([])
    const obstruction = siteBuilding('Generator', 14, 5, 4, 4)
    expect(validateSiteRoutes([route], site, [building, obstruction], { width: 40, length: 30 }, 'ft').map((issue) => issue.code)).toContain('site-route-crosses-building')
    expect(validateSiteRoutes([route], { ...site, accessPoints: [] }, [building], { width: 40, length: 30 }, 'ft').map((issue) => issue.code)).toContain('site-route-disconnected')
    const outside = { ...route, waypoints: [{ x: 45, y: 35 }] }
    expect(validateSiteRoutes([outside], site, [building], { width: 40, length: 30 }, 'ft').map((issue) => issue.code)).toContain('site-route-outside-boundary')
  })

  it('derives edge lengths from vertices and resolves only explicit directional or custom labels', () => {
    const labels = [
      { fromVertexId: 'v1', toVertexId: 'v2', type: 'road-facing' as const },
      { fromVertexId: 'v2', toVertexId: 'v3', type: 'custom' as const, customName: 'Access lane' },
    ]
    const rect = polygon([0, 0], [3, 4], [3, 10], [0, 10])
    expect(siteEdgeLength(rect[0], rect[1])).toBe(5)
    expect(describeSiteEdgeLabel(findSiteEdgeLabel(labels, 'v1', 'v2'))).toBe('Road-facing')
    expect(describeSiteEdgeLabel(findSiteEdgeLabel(labels, 'v2', 'v3'))).toBe('Access lane')
    expect(findSiteEdgeLabel(labels, 'v3', 'v4')).toBeUndefined()
    expect(describeSiteEdgeLabel(undefined)).toBeUndefined()
  })
})
