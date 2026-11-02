import type { Building, LandscapeItem, SiteBoundary, SiteEdgeLabel, SiteModel, SiteRoute, SiteVertex, Units, Vec2 } from '@/types'
import { conversionFactor } from '@/lib/unitConversion'

const EPSILON = 1e-8

export interface SiteGeometryIssue {
  code: 'too-few-vertices' | 'invalid-coordinate' | 'duplicate-vertex' | 'zero-area' | 'self-intersection' | 'outside-envelope'
  severity: 'error' | 'warning'
  message: string
  vertexIndex?: number
  edgeIndices?: [number, number]
}

export function polygonSignedArea(points: readonly Vec2[]): number {
  if (points.length < 3) return 0
  let twiceArea = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    twiceArea += current.x * next.y - next.x * current.y
  }
  return twiceArea / 2
}

export function polygonArea(points: readonly Vec2[]): number {
  return Math.abs(polygonSignedArea(points))
}

/** Edge lengths are always calculated from the current vertices in the boundary's own units. */
export function siteEdgeLength(start: Vec2, end: Vec2): number {
  return Math.hypot(end.x - start.x, end.y - start.y)
}

export function findSiteEdgeLabel(
  edgeLabels: readonly SiteEdgeLabel[] | undefined,
  fromVertexId: string,
  toVertexId: string,
): SiteEdgeLabel | undefined {
  return edgeLabels?.find((edge) => edge.fromVertexId === fromVertexId && edge.toVertexId === toVertexId)
}

export function describeSiteEdgeLabel(edge: SiteEdgeLabel | undefined): string | undefined {
  if (!edge || edge.type === 'unknown') return undefined
  if (edge.type === 'custom') return edge.customName?.trim() || undefined
  return edge.type === 'road-facing' ? 'Road-facing' : edge.type[0].toUpperCase() + edge.type.slice(1)
}

export function polygonBounds(points: readonly Vec2[]) {
  if (!points.length) return null
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

/** Ray-casting containment test; a point on an edge counts as inside. */
export function pointInPolygon(point: Vec2, polygon: readonly Vec2[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (pointOnSegment(point, a, b)) return true
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function validateSiteBoundary(
  vertices: readonly SiteVertex[],
  envelope?: { width: number; length: number },
): SiteGeometryIssue[] {
  const issues: SiteGeometryIssue[] = []
  if (vertices.length < 3) {
    issues.push({ code: 'too-few-vertices', severity: 'error', message: 'A site boundary needs at least three vertices.' })
    return issues
  }

  vertices.forEach((vertex, index) => {
    if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
      issues.push({ code: 'invalid-coordinate', severity: 'error', vertexIndex: index, message: `Vertex ${index + 1} has a non-finite coordinate.` })
    }
    const next = vertices[(index + 1) % vertices.length]
    if (distanceSquared(vertex, next) <= EPSILON * EPSILON) {
      issues.push({ code: 'duplicate-vertex', severity: 'error', vertexIndex: index, message: `Vertex ${index + 1} duplicates the next point; move or remove it.` })
    }
    if (envelope && (vertex.x < -EPSILON || vertex.y < -EPSILON || vertex.x > envelope.width + EPSILON || vertex.y > envelope.length + EPSILON)) {
      issues.push({ code: 'outside-envelope', severity: 'error', vertexIndex: index, message: `Vertex ${index + 1} is outside the plot dimensions envelope.` })
    }
  })

  if (Math.abs(polygonSignedArea(vertices)) <= EPSILON) {
    issues.push({ code: 'zero-area', severity: 'error', message: 'The boundary has no usable area; reposition the vertices.' })
  }

  const count = vertices.length
  for (let first = 0; first < count; first += 1) {
    const firstNext = (first + 1) % count
    for (let second = first + 1; second < count; second += 1) {
      const secondNext = (second + 1) % count
      if (first === second || firstNext === second || secondNext === first) continue
      if (segmentsIntersect(vertices[first], vertices[firstNext], vertices[second], vertices[secondNext])) {
        issues.push({
          code: 'self-intersection',
          severity: 'error',
          edgeIndices: [first, second],
          message: `Boundary edges ${first + 1} and ${second + 1} cross each other.`,
        })
      }
    }
  }

  const unique = new Set(vertices.map((vertex) => `${vertex.x.toFixed(8)},${vertex.y.toFixed(8)}`))
  if (unique.size < 3 && !issues.some((issue) => issue.code === 'duplicate-vertex')) {
    issues.push({ code: 'duplicate-vertex', severity: 'error', message: 'At least three distinct vertices are required.' })
  }
  return deduplicateIssues(issues)
}

/** Deterministic conceptual checks for saved building footprints against the site and one another. */
export function validateSiteBuildingPlacement(buildings: readonly Building[], boundary: SiteBoundary | undefined, units: Units): Array<{ code: string; severity: 'error'; message: string; objectIds: string[] }> {
  const issues: Array<{ code: string; severity: 'error'; message: string; objectIds: string[] }> = []
  const polygons = buildings.flatMap((building) => {
    const footprint = building.footprint
    if (!footprint || footprint.status === 'unknown' || footprint.vertices.length < 3) return []
    const scale = conversionFactor(footprint.units, units)
    return [{ building, points: footprint.vertices.map((vertex) => ({ x: vertex.x * scale, y: vertex.y * scale })) }]
  })
  const boundaryKnown = boundary && boundary.status !== 'unknown' && boundary.vertices.length >= 3
  const boundaryScale = boundary ? conversionFactor(boundary.units, units) : 1
  const sitePolygon = boundaryKnown ? boundary!.vertices.map((vertex) => ({ x: vertex.x * boundaryScale, y: vertex.y * boundaryScale })) : []

  if (boundaryKnown) {
    for (const entry of polygons) {
      if (!polygonWithin(entry.points, sitePolygon)) {
        issues.push({ code: 'site-building-outside-boundary', severity: 'error', objectIds: [entry.building.id], message: `${entry.building.name} footprint extends beyond the recorded plot boundary geometry.` })
      }
      for (const edge of boundary!.edgeLabels ?? []) {
        if (!Number.isFinite(edge.setback) || (edge.setback ?? 0) <= 0) continue
        const rawStart = boundary!.vertices.find((vertex) => vertex.id === edge.fromVertexId)
        const rawEnd = boundary!.vertices.find((vertex) => vertex.id === edge.toVertexId)
        if (!rawStart || !rawEnd) continue
        const start = { x: rawStart.x * boundaryScale, y: rawStart.y * boundaryScale }
        const end = { x: rawEnd.x * boundaryScale, y: rawEnd.y * boundaryScale }
        const required = (edge.setback ?? 0) * boundaryScale
        if (polygonsHaveClearanceViolation(entry.points, start, end, required)) {
          issues.push({ code: 'site-building-violates-setback', severity: 'error', objectIds: [entry.building.id], message: `${entry.building.name} footprint is within the configured ${edge.setback} ${boundary!.units} minimum clearance from a plot edge.` })
        }
      }
    }
  }

  for (let first = 0; first < polygons.length; first += 1) {
    for (let second = first + 1; second < polygons.length; second += 1) {
      const a = polygons[first], b = polygons[second]
      const aBounds = polygonBounds(a.points), bBounds = polygonBounds(b.points)
      if (!aBounds || !bBounds || !boundsOverlap(aBounds, bBounds) || !polygonsOverlap(a.points, b.points)) continue
      issues.push({ code: 'overlapping-site-buildings', severity: 'error', objectIds: [a.building.id, b.building.id], message: `${a.building.name} overlaps ${b.building.name} in the recorded site footprints.` })
    }
  }
  return issues
}

/** Resolve a saved route from its explicit access-point and entrance anchors. */
export function resolveSiteRoutePoints(route: SiteRoute, site: SiteModel | undefined, buildings: readonly Building[], units: Units): Vec2[] | null {
  const boundary = site?.boundary
  const access = site?.accessPoints?.find((point) => point.id === route.fromAccessPointId)
  const accessStart = boundary?.vertices.find((vertex) => vertex.id === access?.fromVertexId)
  const accessEnd = boundary?.vertices.find((vertex) => vertex.id === access?.toVertexId)
  const targetBuilding = buildings.find((building) => building.id === route.toBuildingId)
  const footprint = targetBuilding?.footprint
  const entrance = targetBuilding?.entrances?.find((point) => point.id === route.toEntranceId)
  const entranceStart = footprint?.vertices.find((vertex) => vertex.id === entrance?.fromVertexId)
  const entranceEnd = footprint?.vertices.find((vertex) => vertex.id === entrance?.toVertexId)
  if (!boundary || boundary.status === 'unknown' || !access || !accessStart || !accessEnd || !footprint || footprint.status === 'unknown' || !entrance || !entranceStart || !entranceEnd) return null
  const startFactor = conversionFactor(boundary.units, units)
  const targetFactor = conversionFactor(footprint.units, units)
  const routeFactor = conversionFactor(route.units, units)
  const interpolate = (start: Vec2, end: Vec2, fraction: number, factor: number): Vec2 => {
    const t = Math.max(0, Math.min(1, fraction))
    return { x: (start.x + (end.x - start.x) * t) * factor, y: (start.y + (end.y - start.y) * t) * factor }
  }
  const start = interpolate(accessStart, accessEnd, access.fraction, startFactor)
  const end = interpolate(entranceStart, entranceEnd, entrance.fraction, targetFactor)
  const waypoints = route.waypoints.map((point) => ({ x: point.x * routeFactor, y: point.y * routeFactor }))
  const result = [start, ...waypoints, end]
  return result.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) ? result : null
}

export function validateSiteRoutes(
  routes: readonly SiteRoute[], site: SiteModel | undefined, buildings: readonly Building[], plot: { width: number; length: number }, units: Units,
): Array<{ code: string; severity: 'error'; message: string; objectIds: string[] }> {
  const issues: Array<{ code: string; severity: 'error'; message: string; objectIds: string[] }> = []
  const siteBoundary = site?.boundary
  const boundaryFactor = siteBoundary ? conversionFactor(siteBoundary.units, units) : 1
  const boundaryPolygon = siteBoundary && siteBoundary.status !== 'unknown'
    ? siteBoundary.vertices.map((vertex) => ({ x: vertex.x * boundaryFactor, y: vertex.y * boundaryFactor }))
    : []
  for (const route of routes) {
    const points = resolveSiteRoutePoints(route, site, buildings, units)
    if (!points) {
      issues.push({ code: 'site-route-disconnected', severity: 'error', objectIds: [route.id], message: `The ${route.kind} route is disconnected: its access point or building entrance no longer exists.` })
      continue
    }
    if (!Number.isFinite(route.width) || route.width <= 0) {
      issues.push({ code: 'site-route-invalid-width', severity: 'error', objectIds: [route.id], message: `The ${route.kind} route needs a positive, finite width.` })
    }
    let outsideEnvelope = false
    let outsideBoundary = false
    const samples = [...points]
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index], end = points[index + 1]
      for (let step = 1; step < 16; step += 1) {
        const fraction = step / 16
        samples.push({ x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction })
      }
    }
    for (const point of samples) {
      if (point.x < -EPSILON || point.y < -EPSILON || point.x > plot.width + EPSILON || point.y > plot.length + EPSILON) outsideEnvelope = true
      if (boundaryPolygon.length >= 3 && !pointInPolygon(point, boundaryPolygon)) outsideBoundary = true
    }
    if (outsideEnvelope || outsideBoundary) {
      issues.push({ code: 'site-route-outside-boundary', severity: 'error', objectIds: [route.id], message: `The ${route.kind} route extends outside the recorded plot boundary or dimensions envelope.` })
    }
    for (const building of buildings) {
      if (building.id === route.toBuildingId || !building.footprint || building.footprint.status === 'unknown' || building.footprint.vertices.length < 3) continue
      const factor = conversionFactor(building.footprint.units, units)
      const footprint = building.footprint.vertices.map((point) => ({ x: point.x * factor, y: point.y * factor }))
      const crossesBuilding = samples.some((point) => pointInPolygon(point, footprint))
      if (crossesBuilding) issues.push({ code: 'site-route-crosses-building', severity: 'error', objectIds: [route.id, building.id], message: `The ${route.kind} route passes through ${building.name}.` })
    }
  }
  return issues
}

export function validateSiteParkingBays(
  items: readonly LandscapeItem[], buildings: readonly Building[], boundary: SiteBoundary | undefined,
  plot: { width: number; length: number }, units: Units,
): Array<{ code: string; severity: 'error'; message: string; objectIds: string[] }> {
  const issues: Array<{ code: string; severity: 'error'; message: string; objectIds: string[] }> = []
  const bays = items.filter((item) => item.kind === 'parking-bay').map((item) => {
    const width = (item.width ?? (units === 'ft' ? 9 : 2.7)) * item.scale
    const length = (item.length ?? (units === 'ft' ? 18 : 5.5)) * item.scale
    const cos = Math.cos(item.rotation), sin = Math.sin(item.rotation)
    const points = [{ x: -width / 2, y: -length / 2 }, { x: width / 2, y: -length / 2 }, { x: width / 2, y: length / 2 }, { x: -width / 2, y: length / 2 }]
      .map((point) => ({ x: item.x + point.x * cos - point.y * sin, y: item.y + point.x * sin + point.y * cos }))
    return { item, points }
  })
  const boundaryFactor = boundary ? conversionFactor(boundary.units, units) : 1
  const boundaryPolygon = boundary && boundary.status !== 'unknown' ? boundary.vertices.map((point) => ({ x: point.x * boundaryFactor, y: point.y * boundaryFactor })) : []
  const buildingPolygons = buildings.flatMap((building) => {
    const footprint = building.footprint
    if (!footprint || footprint.status === 'unknown' || footprint.vertices.length < 3) return []
    const factor = conversionFactor(footprint.units, units)
    return [{ building, points: footprint.vertices.map((point) => ({ x: point.x * factor, y: point.y * factor })) }]
  })
  for (const bay of bays) {
    const withinEnvelope = bay.points.every((point) => point.x >= -EPSILON && point.y >= -EPSILON && point.x <= plot.width + EPSILON && point.y <= plot.length + EPSILON)
    const withinBoundary = boundaryPolygon.length < 3 || polygonWithin(bay.points, boundaryPolygon)
    if (!withinEnvelope || !withinBoundary) issues.push({ code: 'parking-bay-outside-boundary', severity: 'error', objectIds: [bay.item.id], message: 'A conceptual parking bay extends outside the recorded boundary or dimensions envelope.' })
    const bayBounds = polygonBounds(bay.points)
    for (const entry of buildingPolygons) {
      const buildingBounds = polygonBounds(entry.points)
      if (bayBounds && buildingBounds && boundsOverlap(bayBounds, buildingBounds) && polygonsOverlap(bay.points, entry.points)) {
        issues.push({ code: 'parking-bay-overlaps-building', severity: 'error', objectIds: [bay.item.id, entry.building.id], message: `A conceptual parking bay overlaps ${entry.building.name}.` })
      }
    }
  }
  for (let first = 0; first < bays.length; first += 1) {
    for (let second = first + 1; second < bays.length; second += 1) {
      const a = bays[first], b = bays[second]
      const aBounds = polygonBounds(a.points), bBounds = polygonBounds(b.points)
      if (aBounds && bBounds && boundsOverlap(aBounds, bBounds) && polygonsOverlap(a.points, b.points)) {
        issues.push({ code: 'overlapping-parking-bays', severity: 'error', objectIds: [a.item.id, b.item.id], message: 'Two conceptual parking bays overlap.' })
      }
    }
  }
  return issues
}

/** Classify axis-aligned four-corner outlines without guessing the road-facing side. */
export function classifyBoundaryShape(vertices: readonly Vec2[]): 'square' | 'rectangle' | 'irregular' {
  if (vertices.length !== 4) return 'irregular'
  const xs = new Set(vertices.map((point) => roundKey(point.x)))
  const ys = new Set(vertices.map((point) => roundKey(point.y)))
  const bounds = polygonBounds(vertices)
  if (!bounds || xs.size !== 2 || ys.size !== 2) return 'irregular'
  const boxArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
  if (boxArea <= EPSILON || Math.abs(polygonArea(vertices) - boxArea) > Math.max(1, boxArea) * 1e-7) return 'irregular'
  return Math.abs((bounds.maxX - bounds.minX) - (bounds.maxY - bounds.minY)) <= 1e-6 ? 'square' : 'rectangle'
}

function polygonWithin(points: readonly Vec2[], container: readonly Vec2[]): boolean {
  if (points.length < 3 || container.length < 3) return false
  const samples: Vec2[] = [...points]
  for (let i = 0; i < points.length; i += 1) {
    const start = points[i], end = points[(i + 1) % points.length]
    for (let step = 1; step < 16; step += 1) {
      const t = step / 16
      samples.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t })
    }
    for (let j = 0; j < container.length; j += 1) {
      if (properSegmentsIntersect(start, end, container[j], container[(j + 1) % container.length])) return false
    }
  }
  samples.push({ x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length })
  return samples.every((point) => pointInPolygon(point, container))
}

function polygonsOverlap(a: readonly Vec2[], b: readonly Vec2[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      if (segmentsIntersect(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true
    }
  }
  return a.some((point) => pointInPolygon(point, b)) || b.some((point) => pointInPolygon(point, a))
}

function polygonsHaveClearanceViolation(polygon: readonly Vec2[], edgeStart: Vec2, edgeEnd: Vec2, minimum: number): boolean {
  for (let i = 0; i < polygon.length; i += 1) {
    const start = polygon[i], end = polygon[(i + 1) % polygon.length]
    if (segmentsIntersect(start, end, edgeStart, edgeEnd)) return true
    const distance = Math.min(pointSegmentDistance(start, edgeStart, edgeEnd), pointSegmentDistance(edgeStart, start, end), pointSegmentDistance(edgeEnd, start, end))
    if (distance < minimum - EPSILON) return true
  }
  return false
}

function boundsOverlap(a: NonNullable<ReturnType<typeof polygonBounds>>, b: NonNullable<ReturnType<typeof polygonBounds>>): boolean {
  return a.minX < b.maxX - EPSILON && b.minX < a.maxX - EPSILON && a.minY < b.maxY - EPSILON && b.minY < a.maxY - EPSILON
}

function pointSegmentDistance(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end.x - start.x, dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPSILON * EPSILON) return Math.hypot(point.x - start.x, point.y - start.y)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))
}

function properSegmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const orient = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  return orient(a, b, c) * orient(a, b, d) < -EPSILON && orient(c, d, a) * orient(c, d, b) < -EPSILON
}

function pointOnSegment(point: Vec2, a: Vec2, b: Vec2): boolean {
  const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)
  if (Math.abs(cross) > EPSILON) return false
  return point.x >= Math.min(a.x, b.x) - EPSILON && point.x <= Math.max(a.x, b.x) + EPSILON
    && point.y >= Math.min(a.y, b.y) - EPSILON && point.y <= Math.max(a.y, b.y) + EPSILON
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const orient = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const abC = orient(a, b, c), abD = orient(a, b, d)
  const cdA = orient(c, d, a), cdB = orient(c, d, b)
  if (abC * abD < -EPSILON && cdA * cdB < -EPSILON) return true
  return (Math.abs(abC) <= EPSILON && pointOnSegment(c, a, b))
    || (Math.abs(abD) <= EPSILON && pointOnSegment(d, a, b))
    || (Math.abs(cdA) <= EPSILON && pointOnSegment(a, c, d))
    || (Math.abs(cdB) <= EPSILON && pointOnSegment(b, c, d))
}

function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x, dy = a.y - b.y
  return dx * dx + dy * dy
}
function roundKey(value: number): string { return String(Math.round(value * 1e6) / 1e6) }
function deduplicateIssues(issues: SiteGeometryIssue[]): SiteGeometryIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.edgeIndices?.join(',') ?? ''}:${issue.vertexIndex ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
