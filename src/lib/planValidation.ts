import type { Room, Units, Vec2, WallOpening, ArchitecturalWall, PlacedItem } from '@/types'
import { roomArea } from '@/lib/floorPlan'
import { validateOpenings } from '@/lib/architecturalModel'
import { validateFurniture } from '@/lib/furniture'

export interface PlanIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  roomId?: string
  objectIds?: string[]
}

export function validatePlan(
  rooms: Room[],
  plot: { width: number; length: number; units: Units },
  walls: ArchitecturalWall[],
  openings: WallOpening[],
  placed: Record<string, PlacedItem[]> = {},
): PlanIssue[] {
  const issues: PlanIssue[] = []
  const roomPolygons = rooms.map((room) => ({ room, points: polygonForRoom(room) }))

  for (const { room, points } of roomPolygons) {
    if (roomArea(room) <= 0) issues.push({ severity: 'error', code: 'zero-area-room', roomId: room.id, message: `${room.name} has no usable area.` })
    if (selfIntersects(points)) issues.push({ severity: 'error', code: 'self-intersecting-room', roomId: room.id, message: `${room.name} outline crosses itself.` })
    if (points.some((point) => point.x < -1e-6 || point.y < -1e-6 || point.x > plot.width + 1e-6 || point.y > plot.length + 1e-6)) {
      issues.push({ severity: 'error', code: 'outside-plot', roomId: room.id, message: `${room.name} extends beyond the plot boundary.` })
    }
  }

  for (let i = 0; i < roomPolygons.length; i += 1) {
    for (let j = i + 1; j < roomPolygons.length; j += 1) {
      const a = roomPolygons[i], b = roomPolygons[j]
      if (a.room.level !== b.room.level || !boundsOverlap(a.points, b.points) || !polygonsOverlap(a.points, b.points)) continue
      issues.push({ severity: 'error', code: 'overlapping-rooms', roomId: b.room.id, objectIds: [a.room.id, b.room.id], message: `${a.room.name} overlaps ${b.room.name} on the same level.` })
    }
  }

  for (const issue of validateOpenings(walls, openings)) {
    issues.push({ severity: issue.severity, code: issue.code, objectIds: issue.openingId ? [issue.openingId] : undefined, message: issue.message })
  }

  for (const room of rooms) {
    const roomItems = placed[room.id] ?? room.items ?? []
    for (const issue of validateFurniture(room, roomItems, openings, walls)) {
      issues.push({ severity: issue.severity, code: issue.code, roomId: room.id, objectIds: issue.itemIds, message: `${room.name}: ${issue.message}` })
    }
  }

  return dedupeIssues(issues)
}

export function polygonForRoom(room: Room): Vec2[] {
  return room.outline && room.outline.length >= 3
    ? room.outline.map((point) => ({ x: room.rect.x + point.x * room.rect.w, y: room.rect.y + point.y * room.rect.h }))
    : [
      { x: room.rect.x, y: room.rect.y },
      { x: room.rect.x + room.rect.w, y: room.rect.y },
      { x: room.rect.x + room.rect.w, y: room.rect.y + room.rect.h },
      { x: room.rect.x, y: room.rect.y + room.rect.h },
    ]
}

function dedupeIssues(issues: PlanIssue[]): PlanIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.roomId ?? ''}:${(issue.objectIds ?? []).join(',')}:${issue.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
function boundsOverlap(a: Vec2[], b: Vec2[]): boolean {
  const ax = Math.min(...a.map((point) => point.x)), bx = Math.max(...a.map((point) => point.x))
  const ay = Math.min(...a.map((point) => point.y)), by = Math.max(...a.map((point) => point.y))
  const cx = Math.min(...b.map((point) => point.x)), dx = Math.max(...b.map((point) => point.x))
  const cy = Math.min(...b.map((point) => point.y)), dy = Math.max(...b.map((point) => point.y))
  return ax < dx - 1e-7 && cx < bx - 1e-7 && ay < dy - 1e-7 && cy < by - 1e-7
}
function polygonsOverlap(a: Vec2[], b: Vec2[]): boolean {
  if (a.some((point) => pointInside(point, b, false)) || b.some((point) => pointInside(point, a, false))) return true
  const centroid = (points: Vec2[]) => ({ x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length })
  if (pointInside(centroid(a), b, false) || pointInside(centroid(b), a, false)) return true
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      if (segmentsCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true
    }
  }
  return false
}
function selfIntersects(points: Vec2[]): boolean {
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length]
    for (let j = i + 1; j < points.length; j += 1) {
      if (j === i || j === (i + 1) % points.length || (j + 1) % points.length === i) continue
      if (segmentsCross(a, b, points[j], points[(j + 1) % points.length])) return true
    }
  }
  return false
}
function pointInside(point: Vec2, polygon: Vec2[], includeBoundary: boolean): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)
    if (includeBoundary && Math.abs(cross) < 1e-8 && point.x >= Math.min(a.x,b.x) - 1e-8 && point.x <= Math.max(a.x,b.x) + 1e-8 && point.y >= Math.min(a.y,b.y) - 1e-8 && point.y <= Math.max(a.y,b.y) + 1e-8) return true
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const orient = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const abC = orient(a,b,c), abD = orient(a,b,d), cdA = orient(c,d,a), cdB = orient(c,d,b)
  return abC * abD < -1e-10 && cdA * cdB < -1e-10
}
