import type { SiteEdgeLabel, SiteVertex, Vec2 } from '@/types'

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
