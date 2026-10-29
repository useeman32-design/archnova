import { describe, expect, it } from 'vitest'
import type { Room } from '@/types'
import { deriveWalls, findAvailableOpeningPosition, getFloorArchitecturalModel, validateOpenings, wallSolidSections } from '@/lib/architecturalModel'

function makeRoom(id: string, rect: Room['rect'], patch: Partial<Room> = {}): Room {
  return {
    id, name: id, category: 'living', width: rect.w, length: rect.h, units: 'ft', rect,
    level: 1, furniture: [], elements: [], ...patch,
  }
}

describe('shared architectural floor model', () => {
  it('deduplicates coincident room edges into one shared interior wall', () => {
    const rooms = [makeRoom('left', { x: 0, y: 0, w: 10, h: 10 }), makeRoom('right', { x: 10, y: 0, w: 8, h: 10 })]
    const walls = deriveWalls(rooms)
    expect(walls).toHaveLength(7)
    expect(walls.filter((wall) => wall.kind === 'interior')).toHaveLength(1)
    expect(walls.find((wall) => wall.kind === 'interior')?.roomIds).toEqual(['left', 'right'])
  })

  it('applies configured exterior and shared-interior thicknesses consistently', () => {
    const rooms = [makeRoom('left', { x: 0, y: 0, w: 10, h: 10 }), makeRoom('right', { x: 10, y: 0, w: 8, h: 10 })]
    const walls = deriveWalls(rooms, { exterior: 0.9, interior: 0.45 })
    expect(walls.filter((wall) => wall.kind === 'exterior').every((wall) => wall.thickness === 0.9)).toBe(true)
    expect(walls.find((wall) => wall.kind === 'interior')?.thickness).toBe(0.45)
  })

  it('migrates legacy room openings onto a host wall with real dimensions', () => {
    const room = makeRoom('bedroom', { x: 0, y: 0, w: 12, h: 10 }, {
      elements: [{ id: 'door-1', type: 'door', width: 3, height: 7, position: { x: 0, y: 0 } }],
    })
    const model = getFloorArchitecturalModel([room])
    expect(model.openings).toHaveLength(1)
    expect(model.openings[0]).toMatchObject({ id: 'door-1', type: 'door', style: 'single-hinged', width: 3, height: 7, roomId: 'bedroom' })
    expect(model.openings[0].wallId).toBeTruthy()
    expect(validateOpenings(model.walls, model.openings)).toEqual([])
  })

  it('places a new opening only in a free interval on a room wall', () => {
    const room = makeRoom('room', { x: 0, y: 0, w: 12, h: 10 }, {
      elements: [{ id: 'existing', type: 'door', width: 3, height: 7, position: { x: 0, y: 0 } }],
    })
    const position = findAvailableOpeningPosition([room], 'room', 'door', 3)
    expect(position).not.toBeNull()
    const next = { id: 'next', roomId: 'room', wallId: position!.wallId, type: 'door' as const, style: 'single-hinged' as const, offset: position!.offset, width: 3, height: 7, sillHeight: 0 }
    const model = getFloorArchitecturalModel([room])
    expect(validateOpenings(model.walls, [...model.openings, next])).toEqual([])
  })

  it('reports openings beyond the wall and overlapping hosted openings as hard errors', () => {
    const wall = { id: 'w1', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, thickness: 0.75, height: 10, kind: 'exterior' as const, level: 1, roomIds: ['r1'] }
    const openings = [
      { id: 'a', wallId: 'w1', type: 'door' as const, style: 'single-hinged' as const, offset: 8, width: 3, height: 7, sillHeight: 0 },
      { id: 'b', wallId: 'w1', type: 'window' as const, style: 'sliding' as const, offset: 8.5, width: 2, height: 4, sillHeight: 3 },
    ]
    const issues = validateOpenings([wall], openings)
    expect(issues.map((issue) => issue.code)).toContain('opening-outside-wall')
    expect(issues.map((issue) => issue.code)).toContain('opening-overlap')
    expect(issues.every((issue) => issue.severity === 'error')).toBe(true)
  })

  it('derives the wall graph from a custom room outline', () => {
    const room = makeRoom('L', { x: 1, y: 2, w: 12, h: 10 }, {
      shape: 'L', outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }],
    })
    expect(deriveWalls([room])).toHaveLength(6)
  })

  it('cuts floor-to-head openings out of wall solids while retaining sills and lintels', () => {
    const wall = { id: 'w1', start: { x: 0, y: 0 }, end: { x: 12, y: 0 }, thickness: 0.75, height: 10, kind: 'exterior' as const, level: 1, roomIds: ['r1'] }
    const door = { id: 'd1', wallId: 'w1', type: 'door' as const, style: 'single-hinged' as const, offset: 2, width: 3, height: 7, sillHeight: 0 }
    const window = { id: 'w2', wallId: 'w1', type: 'window' as const, style: 'sliding' as const, offset: 7, width: 3, height: 4, sillHeight: 3 }
    const sections = wallSolidSections(wall, [door, window])
    expect(sections).toContainEqual({ offsetStart: 2, offsetEnd: 5, elevationStart: 7, elevationEnd: 10 })
    expect(sections).toContainEqual({ offsetStart: 7, offsetEnd: 10, elevationStart: 0, elevationEnd: 3 })
    expect(sections).toContainEqual({ offsetStart: 7, offsetEnd: 10, elevationStart: 7, elevationEnd: 10 })
    expect(sections).not.toContainEqual(expect.objectContaining({ offsetStart: 2, offsetEnd: 5, elevationStart: 0 }))
  })
})
