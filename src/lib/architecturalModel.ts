import type { ArchitecturalWall, Room, Vec2, WallOpening } from '@/types'

const EPSILON = 1e-6

export interface FloorArchitecturalModel {
  walls: ArchitecturalWall[]
  openings: WallOpening[]
}

export interface WallThicknessSettings {
  exterior: number
  interior: number
}

export interface GeometryIssue {
  severity: 'error' | 'warning'
  code: 'opening-outside-wall' | 'opening-overlap' | 'opening-too-narrow' | 'missing-wall'
  message: string
  openingId?: string
  wallId?: string
}

/**
 * Compatibility seam for older projects: derive one shared wall graph from
 * room boundaries, then attach legacy room.elements openings to those walls.
 * Persisted floor.walls/floor.openings, when present, are authoritative.
 */
export function getFloorArchitecturalModel(
  rooms: Room[],
  explicitWalls?: ArchitecturalWall[],
  explicitOpenings?: WallOpening[],
  thicknesses?: Partial<WallThicknessSettings>,
): FloorArchitecturalModel {
  const walls = explicitWalls?.length ? explicitWalls : deriveWalls(rooms, thicknesses)
  const openings = explicitOpenings ?? deriveLegacyOpenings(rooms, walls)
  return { walls, openings }
}

export function deriveWalls(rooms: Room[], thicknesses: Partial<WallThicknessSettings> = {}): ArchitecturalWall[] {
  const byEdge = new Map<string, ArchitecturalWall>()
  for (const room of rooms) {
    const points = roomOutline(room)
    if (points.length < 3) continue
    for (let i = 0; i < points.length; i += 1) {
      const start = points[i]
      const end = points[(i + 1) % points.length]
      if (distance(start, end) < EPSILON) continue
      const [a, b] = canonicalEnds(start, end)
      const id = `wall:${pointKey(a)}:${pointKey(b)}:L${room.level}`
      const key = `${pointKey(a)}|${pointKey(b)}|${room.level}`
      const existing = byEdge.get(key)
      if (existing) {
        if (!existing.roomIds.includes(room.id)) existing.roomIds.push(room.id)
      } else {
        const exteriorThickness = room.units === 'ft' ? 0.75 : 0.23
        byEdge.set(key, {
          id,
          start: a,
          end: b,
          thickness: thicknesses.exterior ?? exteriorThickness,
          height: room.units === 'ft' ? 10 : 3,
          kind: 'exterior',
          level: room.level,
          roomIds: [room.id],
        })
      }
    }
  }
  return [...byEdge.values()].map((wall) => {
    const isInterior = wall.roomIds.length > 1
    const sampleRoom = rooms.find((room) => wall.roomIds.includes(room.id))
    return {
      ...wall,
      kind: isInterior ? 'interior' : 'exterior',
      thickness: isInterior
        ? (thicknesses.interior ?? (sampleRoom?.units === 'ft' ? 0.375 : 0.12))
        : (thicknesses.exterior ?? (sampleRoom?.units === 'ft' ? 0.75 : 0.23)),
    }
  })
}

export function findAvailableOpeningPosition(
  rooms: Room[],
  roomId: string,
  type: 'door' | 'window',
  width: number,
  target?: Vec2,
): { wallId: string; offset: number } | null {
  if (!Number.isFinite(width) || width <= 0) return null
  const room = rooms.find((candidate) => candidate.id === roomId)
  if (!room) return null
  const model = getFloorArchitecturalModel(rooms)
  const preferredPoint = target ?? {
    x: room.rect.x + room.rect.w / 2,
    y: type === 'door' ? room.rect.y + room.rect.h : room.rect.y,
  }
  const candidates = model.walls.filter((wall) => wall.roomIds.includes(roomId) && wall.level === room.level)
    .map((wall) => ({ wall, projection: projectToSegment(preferredPoint, wall.start, wall.end) }))
    .sort((a, b) => a.projection.distance - b.projection.distance)
  let best: { wallId: string; offset: number; score: number } | null = null
  for (const { wall, projection } of candidates) {
    const length = wallLength(wall)
    if (width > length + EPSILON) continue
    const occupied = model.openings.filter((opening) => opening.wallId === wall.id)
      .map((opening) => [Math.max(0, opening.offset), Math.min(length, opening.offset + opening.width)] as const)
      .filter(([start, end]) => end > start)
      .sort((a, b) => a[0] - b[0])
    const gaps: [number, number][] = []
    let cursor = 0
    for (const [start, end] of occupied) {
      if (start > cursor) gaps.push([cursor, start])
      cursor = Math.max(cursor, end)
    }
    if (cursor < length) gaps.push([cursor, length])
    for (const [gapStart, gapEnd] of gaps) {
      if (gapEnd - gapStart < width - EPSILON) continue
      const offset = Math.max(gapStart, Math.min(gapEnd - width, projection.distanceAlong - width / 2))
      const score = projection.distance + Math.abs(offset + width / 2 - projection.distanceAlong) * 0.15
      if (!best || score < best.score) best = { wallId: wall.id, offset, score }
    }
  }
  return best ? { wallId: best.wallId, offset: best.offset } : null
}

export function validateOpenings(walls: ArchitecturalWall[], openings: WallOpening[]): GeometryIssue[] {
  const issues: GeometryIssue[] = []
  const wallById = new Map(walls.map((wall) => [wall.id, wall]))
  const groups = new Map<string, WallOpening[]>()

  for (const opening of openings) {
    const wall = wallById.get(opening.wallId)
    if (!wall) {
      issues.push({ severity: 'error', code: 'missing-wall', openingId: opening.id, wallId: opening.wallId, message: `${opening.type} is attached to a missing wall.` })
      continue
    }
    const length = distance(wall.start, wall.end)
    if (opening.width <= 0 || opening.offset < -EPSILON || opening.offset + opening.width > length + EPSILON || opening.sillHeight < -EPSILON || opening.height <= 0 || opening.sillHeight + opening.height > wall.height + EPSILON) {
      issues.push({ severity: 'error', code: 'opening-outside-wall', openingId: opening.id, wallId: wall.id, message: `${opening.type} does not fit within its host wall.` })
    }
    if (opening.width < (opening.type === 'door' ? 0.6 : 0.3)) {
      issues.push({ severity: 'warning', code: 'opening-too-narrow', openingId: opening.id, wallId: wall.id, message: `${opening.type} is unusually narrow; verify the intended dimensions.` })
    }
    const group = groups.get(wall.id) ?? []
    group.push(opening)
    groups.set(wall.id, group)
  }

  for (const [wallId, items] of groups) {
    const sorted = [...items].sort((a, b) => a.offset - b.offset)
    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1]
      const current = sorted[i]
      if (previous.offset + previous.width > current.offset + EPSILON) {
        issues.push({ severity: 'error', code: 'opening-overlap', openingId: current.id, wallId, message: `${current.type} overlaps another opening on the same wall.` })
      }
    }
  }
  return issues
}

export interface WallSolidSection {
  offsetStart: number
  offsetEnd: number
  elevationStart: number
  elevationEnd: number
}

/** Solid wall rectangles remaining after actual door/window apertures are cut. */
export function wallSolidSections(wall: ArchitecturalWall, openings: WallOpening[]): WallSolidSection[] {
  const length = wallLength(wall)
  const valid = openings
    .filter((opening) => opening.offset >= 0 && opening.width > 0 && opening.offset + opening.width <= length && opening.offset < length)
    .sort((a, b) => a.offset - b.offset)
  const sections: WallSolidSection[] = []
  let cursor = 0
  for (const opening of valid) {
    const start = Math.max(cursor, opening.offset)
    const end = Math.min(length, opening.offset + opening.width)
    const sill = opening.type === 'door' ? 0 : Math.max(0, Math.min(wall.height, opening.sillHeight))
    const head = Math.max(sill, Math.min(wall.height, opening.sillHeight + opening.height))
    if (start > cursor) sections.push({ offsetStart: cursor, offsetEnd: start, elevationStart: 0, elevationEnd: wall.height })
    if (sill > 0) sections.push({ offsetStart: start, offsetEnd: end, elevationStart: 0, elevationEnd: sill })
    if (head < wall.height) sections.push({ offsetStart: start, offsetEnd: end, elevationStart: head, elevationEnd: wall.height })
    cursor = Math.max(cursor, end)
  }
  if (cursor < length) sections.push({ offsetStart: cursor, offsetEnd: length, elevationStart: 0, elevationEnd: wall.height })
  if (!valid.length) sections.push({ offsetStart: 0, offsetEnd: length, elevationStart: 0, elevationEnd: wall.height })
  return sections.filter((section) => section.offsetEnd > section.offsetStart && section.elevationEnd > section.elevationStart)
}

export function wallLength(wall: ArchitecturalWall): number {
  return distance(wall.start, wall.end)
}

export function pointAlongWall(wall: ArchitecturalWall, offset: number): Vec2 {
  const length = wallLength(wall) || 1
  const t = offset / length
  return { x: wall.start.x + (wall.end.x - wall.start.x) * t, y: wall.start.y + (wall.end.y - wall.start.y) * t }
}

function deriveLegacyOpenings(rooms: Room[], walls: ArchitecturalWall[]): WallOpening[] {
  const result: WallOpening[] = []
  for (const room of rooms) {
    for (const element of room.elements ?? []) {
      if (element.type !== 'door' && element.type !== 'window') continue
      const width = element.width ?? defaultOpeningDimensions(room.units, element.type).width
      const anchor = element.position?.x ?? 0
      const target = {
        x: room.rect.x + room.rect.w * (anchor + 0.5),
        y: element.type === 'door' ? room.rect.y + room.rect.h : room.rect.y,
      }
      const candidates = walls.filter((wall) => wall.roomIds.includes(room.id) && wall.level === room.level)
      const explicitHost = element.wallId ? walls.find((wall) => wall.id === element.wallId) : undefined
      const host = explicitHost ?? candidates.reduce<ArchitecturalWall | null>((best, wall) => {
        if (!best) return wall
        return projectToSegment(target, wall.start, wall.end).distance < projectToSegment(target, best.start, best.end).distance ? wall : best
      }, null)
      if (!host) continue
      const projection = projectToSegment(target, host.start, host.end)
      result.push({
        id: element.id,
        wallId: host.id,
        roomId: room.id,
        type: element.type,
        style: element.type === 'door' ? (element.doorStyle ?? 'single-hinged') : (element.windowStyle ?? 'sliding'),
        offset: element.offset ?? projection.distanceAlong - width / 2,
        width,
        height: element.height ?? defaultOpeningDimensions(room.units, element.type).height,
        sillHeight: element.sillHeight ?? (element.type === 'window' ? (room.units === 'ft' ? 3 : 0.9) : 0),
        direction: element.openingDirection ?? 'inward',
        hingeSide: element.hingeSide ?? 'left',
        color: element.color,
      })
    }
  }
  return result
}

function defaultOpeningDimensions(units: Room['units'], type: 'door' | 'window') {
  if (units === 'ft') return type === 'door' ? { width: 3, height: 7 } : { width: 4, height: 4 }
  return type === 'door' ? { width: 0.9, height: 2.1 } : { width: 1.2, height: 1.2 }
}

function roomOutline(room: Room): Vec2[] {
  if (room.outline && room.outline.length >= 3) {
    return room.outline.map((point) => ({ x: room.rect.x + point.x * room.rect.w, y: room.rect.y + point.y * room.rect.h }))
  }
  return [
    { x: room.rect.x, y: room.rect.y },
    { x: room.rect.x + room.rect.w, y: room.rect.y },
    { x: room.rect.x + room.rect.w, y: room.rect.y + room.rect.h },
    { x: room.rect.x, y: room.rect.y + room.rect.h },
  ]
}

function projectToSegment(point: Vec2, start: Vec2, end: Vec2): { distance: number; distanceAlong: number } {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2))
  const projected = { x: start.x + t * dx, y: start.y + t * dy }
  return { distance: distance(point, projected), distanceAlong: t * Math.sqrt(len2) }
}

function canonicalEnds(a: Vec2, b: Vec2): [Vec2, Vec2] {
  return pointKey(a) <= pointKey(b) ? [roundPoint(a), roundPoint(b)] : [roundPoint(b), roundPoint(a)]
}
function roundPoint(point: Vec2): Vec2 { return { x: Math.round(point.x * 1000) / 1000, y: Math.round(point.y * 1000) / 1000 } }
function pointKey(point: Vec2): string { return `${point.x.toFixed(3)},${point.y.toFixed(3)}` }
function distance(a: Vec2, b: Vec2): number { return Math.hypot(b.x - a.x, b.y - a.y) }
