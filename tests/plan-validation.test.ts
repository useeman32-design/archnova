import { describe, expect, it } from 'vitest'
import type { PlacedItem, Room } from '@/types'
import { findFurniturePosition, getFurnitureDimensions, validateFurniture } from '@/lib/furniture'
import { validatePlan } from '@/lib/planValidation'

function room(id: string, rect: Room['rect'], patch: Partial<Room> = {}): Room {
  return {
    id, name: id, category: 'living', width: rect.w, length: rect.h, units: 'ft', rect,
    level: 1, furniture: [], elements: [], ...patch,
  }
}

function item(id: string, x: number, z: number, width = 3, depth = 3): PlacedItem {
  return { id, item: 'table', x, z, rotation: 0, scale: 1, width, depth, height: 2.5, color: '#888888' }
}

describe('furniture sizing and plan validation', () => {
  it('provides recognizable furniture footprints in both project units', () => {
    expect(getFurnitureDimensions('king-bed', 'ft')).toMatchObject({ width: 6.3, depth: 6.7 })
    expect(getFurnitureDimensions('king-bed', 'm').width).toBeCloseTo(6.3 / 3.28084, 4)
    expect(getFurnitureDimensions('vehicle-footprint', 'ft').depth).toBe(16)
  })

  it('places a furniture footprint near the target while avoiding occupied floor area', () => {
    const r = room('living', { x: 0, y: 0, w: 20, h: 16 })
    const first = item('first', 0, 0, 6, 4)
    const placement = findFurniturePosition(r, [first], { width: 4, depth: 3, height: 2 }, { x: 10, y: 8 })
    expect(placement).not.toBeNull()
    const placed = item('second', placement!.x, placement!.y, 4, 3)
    expect(validateFurniture(r, [first, placed])).toEqual([])
  })

  it('reports objects outside room outlines and overlapping placements', () => {
    const r = room('small', { x: 0, y: 0, w: 8, h: 8 })
    const issues = validateFurniture(r, [item('outside', 0.45, 0, 5, 3), item('a', 0, 0, 4, 4), item('b', 0.05, 0.05, 3, 3)])
    expect(issues.some((issue) => issue.code === 'outside-room' && issue.itemIds.includes('outside'))).toBe(true)
    expect(issues.some((issue) => issue.code === 'item-overlap' && issue.itemIds.includes('a') && issue.itemIds.includes('b'))).toBe(true)
  })

  it('flags rooms extending past the plot and overlapping rooms on the same level', () => {
    const issues = validatePlan(
      [room('living', { x: 0, y: 0, w: 10, h: 10 }), room('bedroom', { x: 8, y: 2, w: 8, h: 7 }), room('outside', { x: 15, y: 0, w: 4, h: 4 })],
      { width: 18, length: 12, units: 'ft' }, [], [],
    )
    expect(issues.some((issue) => issue.code === 'overlapping-rooms')).toBe(true)
    expect(issues.some((issue) => issue.code === 'outside-plot' && issue.roomId === 'outside')).toBe(true)
  })

  it('does not treat touching room boundaries as an overlap', () => {
    const issues = validatePlan(
      [room('left', { x: 0, y: 0, w: 10, h: 10 }), room('right', { x: 10, y: 0, w: 8, h: 10 })],
      { width: 18, length: 10, units: 'ft' }, [], [],
    )
    expect(issues.some((issue) => issue.code === 'overlapping-rooms')).toBe(false)
  })
})
