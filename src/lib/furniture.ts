import type { Room, Units, Vec2, WallOpening, ArchitecturalWall, PlacedItem } from '@/types'

export interface FurnitureDimensions {
  width: number
  depth: number
  height: number
}

// Approximate planning footprints in feet, chosen as practical design defaults.
const FOOTPRINTS_FT: Record<string, FurnitureDimensions> = {
  bed: { width: 5, depth: 6.7, height: 2.1 },
  'king-bed': { width: 6.3, depth: 6.7, height: 2.1 },
  sofa: { width: 7, depth: 3, height: 3 },
  armchair: { width: 3, depth: 3, height: 3 },
  'coffee-table': { width: 3.5, depth: 2, height: 1.5 },
  table: { width: 4, depth: 2.5, height: 2.5 },
  dining: { width: 5, depth: 3.2, height: 2.5 },
  chair: { width: 1.6, depth: 1.6, height: 3 },
  wardrobe: { width: 5, depth: 2, height: 7 },
  'bedside-table': { width: 1.7, depth: 1.5, height: 2 },
  desk: { width: 4, depth: 2, height: 2.5 },
  bookshelf: { width: 3, depth: 1, height: 6 },
  kitchen: { width: 6, depth: 2, height: 3 },
  cabinets: { width: 6, depth: 2, height: 3 },
  island: { width: 6, depth: 3, height: 3 },
  sink: { width: 2.5, depth: 2, height: 3 },
  cooker: { width: 2.5, depth: 2, height: 3 },
  fridge: { width: 2.5, depth: 2.5, height: 6 },
  toilet: { width: 1.6, depth: 2.5, height: 2.5 },
  shower: { width: 3, depth: 3, height: 7 },
  bath: { width: 5.5, depth: 2.7, height: 2 },
  washbasin: { width: 2.2, depth: 1.7, height: 3 },
  'tv-unit': { width: 5, depth: 1.5, height: 2 },
  tv: { width: 5, depth: 1.5, height: 2 },
  'vehicle-footprint': { width: 6.2, depth: 16, height: 5 },
  car: { width: 6.2, depth: 16, height: 5 },
  washer: { width: 2.2, depth: 2.2, height: 3 },
  dryer: { width: 2.2, depth: 2.2, height: 3 },
  'storage-rack': { width: 4, depth: 1.5, height: 6 },
  'sideboard': { width: 5, depth: 1.5, height: 3 },
}

export function canonicalFurnitureKey(item: string): string {
  const key = item.toLowerCase().replace(/[_\s]+/g, '-')
  if (key.includes('king') && key.includes('bed')) return 'king-bed'
  if (key.includes('bed')) return 'bed'
  if (key.includes('sofa')) return 'sofa'
  if (key.includes('armchair')) return 'armchair'
  if (key.includes('coffee')) return 'coffee-table'
  if (key.includes('dining')) return 'dining'
  if (key.includes('chair')) return 'chair'
  if (key.includes('wardrobe')) return 'wardrobe'
  if (key.includes('bedside')) return 'bedside-table'
  if (key.includes('desk')) return 'desk'
  if (key.includes('book')) return 'bookshelf'
  if (key.includes('island')) return 'island'
  if (key.includes('cabinet') || key.includes('counter')) return 'cabinets'
  if (key.includes('sink')) return 'sink'
  if (key.includes('cooker') || key.includes('stove') || key.includes('hob')) return 'cooker'
  if (key.includes('fridge') || key.includes('refrigerator')) return 'fridge'
  if (key.includes('toilet') || key.includes('wc')) return 'toilet'
  if (key.includes('shower')) return 'shower'
  if (key.includes('bath')) return 'bath'
  if (key.includes('basin')) return 'washbasin'
  if (key.includes('tv')) return 'tv-unit'
  if (key.includes('car') || key.includes('vehicle')) return 'vehicle-footprint'
  if (key.includes('washer')) return 'washer'
  if (key.includes('dryer')) return 'dryer'
  if (key.includes('rack') || key.includes('shelf')) return 'storage-rack'
  if (key.includes('sideboard')) return 'sideboard'
  if (key.includes('table')) return 'table'
  return key
}

export function getFurnitureDimensions(item: string, units: Units): FurnitureDimensions {
  const key = canonicalFurnitureKey(item)
  const feet = FOOTPRINTS_FT[key] ?? { width: 2.5, depth: 2.5, height: 3 }
  const conversion = units === 'm' ? 1 / 3.28084 : 1
  return { width: feet.width * conversion, depth: feet.depth * conversion, height: feet.height * conversion }
}

export interface FurnitureIssue {
  severity: 'error' | 'warning'
  code: 'outside-room' | 'item-overlap' | 'door-clearance'
  itemIds: string[]
  message: string
}

export function findFurniturePosition(room: Room, existing: PlacedItem[], dimensions: FurnitureDimensions, target?: Vec2): Vec2 | null {
  const candidates = [-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36].flatMap((z) => [-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36].map((x) => ({ x, z })))
  const preferred = target ? { x: (target.x - room.rect.x) / room.rect.w - 0.5, z: (target.y - room.rect.y) / room.rect.h - 0.5 } : { x: 0, z: 0 }
  candidates.sort((a, b) => Math.hypot(a.x - preferred.x, a.z - preferred.z) - Math.hypot(b.x - preferred.x, b.z - preferred.z))
  for (const { x, z } of candidates) {
      const candidate: PlacedItem = {
        id: 'candidate', item: 'candidate', x, z, rotation: 0, scale: 1,
        width: dimensions.width, depth: dimensions.depth, height: dimensions.height, color: '#888888',
      }
      const corners = furnitureCorners(room, candidate)
      if (!furnitureInsideRoom(room, corners)) continue
      if (existing.some((item) => polygonsOverlap(corners, furnitureCorners(room, item)))) continue
    return { x, y: z }
  }
  return null
}

export function validateFurniture(
  room: Room,
  items: PlacedItem[],
  openings: WallOpening[] = [],
  walls: ArchitecturalWall[] = [],
): FurnitureIssue[] {
  const issues: FurnitureIssue[] = []
  const polygons = items.map((item) => ({ item, corners: furnitureCorners(room, item) }))
  for (const { item, corners } of polygons) {
    if (!furnitureInsideRoom(room, corners)) {
      issues.push({ severity: 'error', code: 'outside-room', itemIds: [item.id], message: `${item.item} extends outside the room boundary.` })
    }
  }
  for (let i = 0; i < polygons.length; i += 1) {
    for (let j = i + 1; j < polygons.length; j += 1) {
      if (polygonsOverlap(polygons[i].corners, polygons[j].corners)) {
        issues.push({ severity: 'warning', code: 'item-overlap', itemIds: [polygons[i].item.id, polygons[j].item.id], message: `${polygons[i].item.item} overlaps ${polygons[j].item.item}. Check the intended clearance.` })
      }
    }
  }
  for (const opening of openings.filter((candidate) => candidate.type === 'door' && candidate.roomId === room.id)) {
    const wall = walls.find((candidate) => candidate.id === opening.wallId)
    if (!wall) continue
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) || 1
    const ux = (wall.end.x - wall.start.x) / length
    const uy = (wall.end.y - wall.start.y) / length
    const center = { x: wall.start.x + ux * (opening.offset + opening.width / 2), y: wall.start.y + uy * (opening.offset + opening.width / 2) }
    const clearance = room.units === 'ft' ? 3 : 0.9
    for (const { item, corners } of polygons) {
      const projections = corners.map((point) => ({ along: (point.x - wall.start.x) * ux + (point.y - wall.start.y) * uy, normal: Math.abs((point.x - wall.start.x) * -uy + (point.y - wall.start.y) * ux) }))
      const minAlong = Math.min(...projections.map((p) => p.along))
      const maxAlong = Math.max(...projections.map((p) => p.along))
      const minNormal = Math.min(...projections.map((p) => p.normal))
      const openingStart = opening.offset - clearance / 2
      const openingEnd = opening.offset + opening.width + clearance / 2
      if (maxAlong >= openingStart && minAlong <= openingEnd && minNormal < clearance) {
        issues.push({ severity: 'warning', code: 'door-clearance', itemIds: [item.id, opening.id], message: `${item.item} may obstruct the door swing or approach clearance.` })
      }
    }
    void center
  }
  return issues
}

function furnitureCorners(room: Room, item: PlacedItem): Vec2[] {
  const defaults = getFurnitureDimensions(item.item, room.units)
  const width = (item.width ?? defaults.width) * item.scale
  const depth = (item.depth ?? defaults.depth) * item.scale
  const center = { x: room.rect.x + room.rect.w * (0.5 + item.x), y: room.rect.y + room.rect.h * (0.5 + item.z) }
  const halfW = width / 2
  const halfD = depth / 2
  const cos = Math.cos(item.rotation)
  const sin = Math.sin(item.rotation)
  return [[-halfW, -halfD], [halfW, -halfD], [halfW, halfD], [-halfW, halfD]].map(([x, y]) => ({
    x: center.x + x * cos - y * sin,
    y: center.y + x * sin + y * cos,
  }))
}

function furnitureInsideRoom(room: Room, corners: Vec2[]): boolean {
  const outline = room.outline && room.outline.length >= 3
    ? room.outline.map((point) => ({ x: room.rect.x + point.x * room.rect.w, y: room.rect.y + point.y * room.rect.h }))
    : [{ x: room.rect.x, y: room.rect.y }, { x: room.rect.x + room.rect.w, y: room.rect.y }, { x: room.rect.x + room.rect.w, y: room.rect.y + room.rect.h }, { x: room.rect.x, y: room.rect.y + room.rect.h }]
  if (!corners.every((point) => pointInRoom(room, point))) return false
  for (let i = 0; i < corners.length; i += 1) {
    for (let j = 0; j < outline.length; j += 1) {
      if (properSegmentsCross(corners[i], corners[(i + 1) % corners.length], outline[j], outline[(j + 1) % outline.length])) return false
    }
  }
  return true
}

function pointInRoom(room: Room, point: Vec2): boolean {
  const outline = room.outline && room.outline.length >= 3
    ? room.outline.map((p) => ({ x: room.rect.x + p.x * room.rect.w, y: room.rect.y + p.y * room.rect.h }))
    : [{ x: room.rect.x, y: room.rect.y }, { x: room.rect.x + room.rect.w, y: room.rect.y }, { x: room.rect.x + room.rect.w, y: room.rect.y + room.rect.h }, { x: room.rect.x, y: room.rect.y + room.rect.h }]
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i], b = outline[j]
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)
    if (Math.abs(cross) < 1e-8 && point.x >= Math.min(a.x, b.x) - 1e-8 && point.x <= Math.max(a.x, b.x) + 1e-8 && point.y >= Math.min(a.y, b.y) - 1e-8 && point.y <= Math.max(a.y, b.y) + 1e-8) return true
    if (((a.y > point.y) !== (b.y > point.y)) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function polygonsOverlap(a: Vec2[], b: Vec2[]): boolean {
  if (a.some((point) => pointStrictlyInPolygon(point, b)) || b.some((point) => pointStrictlyInPolygon(point, a))) return true
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      if (properSegmentsCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true
    }
  }
  return false
}
function pointStrictlyInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    if (((a.y > point.y) !== (b.y > point.y)) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
function properSegmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const orient = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const abC = orient(a, b, c), abD = orient(a, b, d), cdA = orient(c, d, a), cdB = orient(c, d, b)
  return abC * abD < -1e-10 && cdA * cdB < -1e-10
}
