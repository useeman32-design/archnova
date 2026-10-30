import { describe, expect, it } from 'vitest'
import type { Room } from '@/types'
import { conversionFactor, convertOrnaments, convertRoomUnits, convertWallThicknesses } from '@/lib/unitConversion'

const room: Room = {
  id: 'r1', name: 'Living', category: 'living', width: 10, length: 12, units: 'ft',
  rect: { x: 2, y: 3, w: 10, h: 12 }, level: 1, furniture: [],
  elements: [{ id: 'd1', type: 'door', width: 3, height: 7, offset: 2.5, sillHeight: 0, position: { x: 0, y: 0 } }],
  items: [{ id: 'i1', item: 'sofa', x: 0.1, z: -0.15, rotation: 0.2, scale: 1, width: 7, depth: 3, height: 3, color: '#888888' }],
}

describe('project unit conversion', () => {
  it('converts room geometry, hosted opening sizes, furniture dimensions and plot positions', () => {
    const metric = convertRoomUnits(room, 'm')
    expect(metric).toMatchObject({ units: 'm', width: 3.048, length: 3.6576, rect: { x: 0.6096, y: 0.9144, w: 3.048, h: 3.6576 } })
    expect(metric.elements[0]).toMatchObject({ width: 0.9144, height: 2.1336, offset: 0.762 })
    expect(metric.items?.[0]).toMatchObject({ x: 0.1, z: -0.15, width: 2.1336, depth: 0.9144, height: 0.9144 })
    const restored = convertRoomUnits(metric, 'ft')
    expect(restored.rect.x).toBeCloseTo(room.rect.x, 3)
    expect(restored.rect.w).toBeCloseTo(room.rect.w, 3)
    expect(restored.elements[0].width).toBeCloseTo(3, 3)
  })

  it('converts wall thickness and landscape coordinates without scaling object scale', () => {
    expect(conversionFactor('ft', 'm')).toBe(0.3048)
    expect(convertWallThicknesses({ exterior: 0.75, interior: 0.375 }, 'ft', 'm')).toEqual({ exterior: 0.2286, interior: 0.1143 })
    expect(convertOrnaments([{ id: 'tree', x: 10, y: 4, kind: 'tree', rotation: 0, scale: 1.2, color: '#445566' }], 'ft', 'm')[0]).toMatchObject({ x: 3.048, y: 1.2192, scale: 1.2 })
  })
})
