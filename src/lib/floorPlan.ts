import type { Floor, NewProjectForm, Room, RoomCategory, Units } from '@/types'
import { uid } from './id'
import { ROOM_FURNITURE } from '@/data/catalog'

/**
 * Frontend-only floor-plan generator.
 *
 * Produces a deterministic, plausible room layout from the questionnaire
 * answers. It is deliberately *not* a real geometry engine — it only has to
 * look believable and give the properties panel something to show. The seam
 * is `@/services/geometryService` which will replace this later.
 */

const MARGIN = 4
const BANDS = { garden: 5, veranda: 5, main: 14, bed: 12, rear: 6 } as const
const BAND_ORDER: (keyof typeof BANDS)[] = ['garden', 'veranda', 'main', 'bed', 'rear']

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface BandLayout {
  x0: number
  usableW: number
  y: Record<keyof typeof BANDS, number>
  h: Record<keyof typeof BANDS, number>
  rearY: number
  rearH: number
}

function makeBands(plotW: number, plotL: number): BandLayout {
  const usableW = Math.max(18, plotW - 2 * MARGIN)
  const usableL = Math.max(18, plotL - 2 * MARGIN)
  const total = BAND_ORDER.reduce((sum, key) => sum + BANDS[key], 0)
  const scale = usableL / total
  const h = BAND_ORDER.reduce(
    (acc, key) => ({ ...acc, [key]: BANDS[key] * scale }),
    {} as Record<keyof typeof BANDS, number>,
  )

  const x0 = (plotW - usableW) / 2
  const y: Record<keyof typeof BANDS, number> = { garden: MARGIN, veranda: 0, main: 0, bed: 0, rear: 0 }
  let cursor = MARGIN
  for (const key of BAND_ORDER) {
    y[key] = cursor
    cursor += h[key]
  }
  return { x0, usableW, y, h, rearY: y.rear, rearH: h.rear }
}

function makeRoom(
  name: string,
  category: RoomCategory,
  rect: Rect,
  units: Units,
  furniture?: string[],
): Room {
  return {
    id: uid('room'),
    name,
    category,
    width: Math.round(rect.w * 10) / 10,
    length: Math.round(rect.h * 10) / 10,
    units,
    rect,
    level: 1,
    furniture: furniture ?? ROOM_FURNITURE[category] ?? [],
    elements: [
      { id: uid('el'), type: 'door', label: 'Door' },
      { id: uid('el'), type: 'window', label: 'Window' },
    ],
  }
}

function pushSpan(rooms: Room[], { name, category, x, y, w, h: height, units, furniture }: Span) {
  rooms.push(makeRoom(name, category, { x, y, w, h: height }, units, furniture))
}

interface Span {
  name: string
  category: RoomCategory
  x: number
  y: number
  w: number
  h: number
  units: Units
  furniture?: string[]
}

/** Split a span's width into chunks and place them left to right. */
function distribute(rooms: Room[], opts: {
  y: number
  height: number
  units: Units
  x0: number
  usableW: number
  names: { name: string; category: RoomCategory; fraction: number }[]
}): void {
  let x = opts.x0
  const widths = opts.names.map((n) => opts.usableW * n.fraction)
  const leftover = opts.usableW - widths.reduce((a, b) => a + b, 0)
  widths.push(leftover) // trailing circulation / garden strip

  opts.names.forEach((n, i) => {
    pushSpan(rooms, {
      name: n.name,
      category: n.category,
      x,
      y: opts.y,
      w: widths[i],
      h: opts.height,
      units: opts.units,
    })
    x += widths[i]
  })
  if (leftover > opts.usableW * 0.08) {
    pushSpan(rooms, {
      name: 'Circulation',
      category: 'circulation',
      x,
      y: opts.y,
      w: widths[widths.length - 1],
      h: opts.height,
      units: opts.units,
    })
  }
}

function generateGroundFloor(form: NewProjectForm, bands: BandLayout): Room[] {
  const { x0, usableW, y, h, rearY, rearH } = bands
  const units = form.units
  const rooms: Room[] = []
  const outdoor = form.outdoor

  pushSpan(rooms, { name: 'Front garden', category: 'garden', x: x0, y: y.garden, w: usableW, h: h.garden, units })
  pushSpan(rooms, { name: 'Veranda', category: 'porch', x: x0, y: y.veranda, w: usableW, h: h.veranda, units })

  distribute(rooms, {
    x0,
    usableW,
    y: y.main,
    height: h.main,
    units,
    names: [
      { name: 'Living room', category: 'living', fraction: 0.42 },
      { name: 'Dining room', category: 'dining', fraction: 0.28 },
      { name: 'Kitchen', category: 'kitchen', fraction: 0.3 },
    ],
  })

  let rx = x0
  if (outdoor.includes('garage')) {
    const gw = usableW * 0.3
    pushSpan(rooms, { name: 'Garage', category: 'garage', x: rx, y: rearY, w: gw, h: rearH, units })
    rx += gw
  }
  const bathW = Math.min(usableW * 0.4, Math.max(6, 6 * Math.max(1, form.bathrooms)))
  if (form.bathrooms > 0) {
    pushSpan(rooms, {
      name: form.bathrooms > 1 ? `Bathroom (${form.bathrooms})` : 'Bathroom',
      category: 'bathroom',
      x: rx,
      y: rearY,
      w: bathW,
      h: rearH,
      units,
    })
    rx += bathW
  }
  if (outdoor.includes('pool')) {
    const pw = usableW * 0.35
    pushSpan(rooms, { name: 'Pool', category: 'pool', x: rx, y: rearY, w: pw, h: rearH, units })
    rx += pw
  }
  const remaining = x0 + usableW - rx
  if (remaining > usableW * 0.1) {
    pushSpan(rooms, { name: 'Store', category: 'storage', x: rx, y: rearY, w: remaining, h: rearH, units })
  }

  return rooms
}

function generateUpperFloor(form: NewProjectForm, bands: BandLayout, level: number): Room[] {
  const { x0, usableW, y, h, rearY, rearH } = bands
  const rooms: Room[] = []
  const units = form.units

  pushSpan(rooms, { name: 'Balcony', category: 'balcony', x: x0, y: y.veranda, w: usableW, h: h.veranda, units })
  distribute(rooms, {
    x0,
    usableW,
    y: y.main,
    height: h.main,
    units,
    names: [
      { name: 'Family room', category: 'living', fraction: 0.5 },
      { name: 'Kitchen', category: 'kitchen', fraction: 0.5 },
    ],
  })

  const bedW = usableW / Math.max(1, form.bedrooms)
  for (let i = 0; i < form.bedrooms; i++) {
    pushSpan(rooms, {
      name: `Bedroom ${i + 1}`,
      category: 'bedroom',
      x: x0 + i * bedW,
      y: y.bed,
      w: bedW,
      h: h.bed,
      units,
    })
  }

  const bathW = Math.min(usableW * 0.45, Math.max(6, 6 * Math.max(1, form.bathrooms)))
  pushSpan(rooms, {
    name: form.bathrooms > 1 ? `Bathroom (${form.bathrooms})` : 'Bathroom',
    category: 'bathroom',
    x: x0,
    y: rearY,
    w: bathW,
    h: rearH,
    units,
  })
  pushSpan(rooms, {
    name: 'Laundry',
    category: 'laundry',
    x: x0 + bathW,
    y: rearY,
    w: Math.max(5, usableW - bathW),
    h: rearH,
    units,
  })

  return rooms.map((r) => ({ ...r, level }))
}

export function generateFloors(form: NewProjectForm): Floor[] {
  const bands = makeBands(form.plotWidth, form.plotLength)
  const isMultiStorey = form.buildingType === 'duplex' || form.buildingType === 'flats'

  if (!isMultiStorey) {
    const rooms = generateGroundFloor(form, bands).map((r) => ({ ...r, level: 1 }))
    // move bedrooms into the bed band for single-storey homes
    return [
      {
        id: uid('floor'),
        name: 'Ground floor',
        level: 1,
        rooms: relocateBedrooms(rooms, bands, form),
      },
    ]
  }

  const ground = generateGroundFloor(form, bands).map((r) => ({ ...r, level: 1 }))
  const upper = generateUpperFloor(form, bands, 2)
  return [
    { id: uid('floor'), name: 'Ground floor', level: 1, rooms: ground },
    { id: uid('floor'), name: 'Upper floor', level: 2, rooms: upper },
  ]
}

/**
 * Single-storey homes: living areas live in the main band, bedrooms in the bed
 * band, utilities in the rear band. `generateGroundFloor` puts bedrooms in the
 * rear, so we rebuild the bed band here for a cleaner bungalow plan.
 */
function relocateBedrooms(rooms: Room[], bands: BandLayout, form: NewProjectForm): Room[] {
  const withoutBeds = rooms.filter((r) => r.category !== 'bedroom')
  const bedW = bands.usableW / Math.max(1, form.bedrooms)
  const beds: Room[] = []
  for (let i = 0; i < form.bedrooms; i++) {
    beds.push(
      makeRoom(`Bedroom ${i + 1}`, 'bedroom', {
        x: bands.x0 + i * bedW,
        y: bands.y.bed,
        w: bedW,
        h: bands.h.bed,
      }, form.units),
    )
  }
  return [...withoutBeds, ...beds]
}

export function roomArea(room: Room): number {
  const outline = room.outline
  if (!outline || outline.length < 3) return Math.round(room.width * room.length)
  let twiceArea = 0
  for (let i = 0; i < outline.length; i += 1) {
    const current = outline[i]
    const next = outline[(i + 1) % outline.length]
    twiceArea += current.x * next.y - next.x * current.y
  }
  return Math.round(Math.abs(twiceArea) * 0.5 * room.width * room.length)
}
