import type { PlacedItem, Room, Units } from '@/types'
import type { Ornament } from '@/pages/workspace/WorkspaceLayout'

export function conversionFactor(from: Units, to: Units): number {
  if (from === to) return 1
  return from === 'ft' ? 0.3048 : 1 / 0.3048
}

export function convertRoomUnits(room: Room, to: Units): Room {
  if (room.units === to) return room
  const factor = conversionFactor(room.units, to)
  return {
    ...room,
    units: to,
    width: round(room.width * factor),
    length: round(room.length * factor),
    rect: { x: round(room.rect.x * factor), y: round(room.rect.y * factor), w: round(room.rect.w * factor), h: round(room.rect.h * factor) },
    elements: (room.elements ?? []).map((element) => ({
      ...element,
      ...(element.width !== undefined ? { width: round(element.width * factor) } : {}),
      ...(element.height !== undefined ? { height: round(element.height * factor) } : {}),
      ...(element.offset !== undefined ? { offset: round(element.offset * factor) } : {}),
      ...(element.sillHeight !== undefined ? { sillHeight: round(element.sillHeight * factor) } : {}),
    })),
    items: room.items?.map((item) => convertPlacedItem(item, room.units, to)),
  }
}

export function convertPlacedItem(item: PlacedItem, from: Units, to: Units): PlacedItem {
  if (from === to) return item
  const factor = conversionFactor(from, to)
  return {
    ...item,
    ...(item.width !== undefined ? { width: round(item.width * factor) } : {}),
    ...(item.depth !== undefined ? { depth: round(item.depth * factor) } : {}),
    ...(item.height !== undefined ? { height: round(item.height * factor) } : {}),
  }
}

export function convertOrnaments(items: Ornament[], from: Units, to: Units): Ornament[] {
  if (from === to) return items
  const factor = conversionFactor(from, to)
  return items.map((item) => ({ ...item, x: round(item.x * factor), y: round(item.y * factor), ...(item.width !== undefined ? { width: round(item.width * factor) } : {}), ...(item.length !== undefined ? { length: round(item.length * factor) } : {}) }))
}

export function convertWallThicknesses(value: { exterior: number; interior: number }, from: Units, to: Units) {
  if (from === to) return value
  const factor = conversionFactor(from, to)
  return { exterior: round(value.exterior * factor), interior: round(value.interior * factor) }
}

function round(value: number): number { return Math.round(value * 10000) / 10000 }
