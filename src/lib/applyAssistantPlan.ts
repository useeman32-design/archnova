import type { Element, PlacedItem, Project, Room, Units, Vec2 } from '@/types'
import { canonicalFurnitureKey, findFurniturePosition, getFurnitureDimensions } from '@/lib/furniture'
import { findAvailableOpeningPosition, getFloorArchitecturalModel, validateOpenings } from '@/lib/architecturalModel'
import { validatePlan, type PlanIssue } from '@/lib/planValidation'
import type { AssistantPlan, AssistantRoomSpec } from '@/services/groqAssistant'

export interface ApplyAssistantPlanInput {
  plan: AssistantPlan
  project: Project
  rooms: Room[]
  placed: Record<string, PlacedItem[]>
  wallThicknesses: { exterior: number; interior: number }
}

export interface ApplyAssistantPlanResult {
  ok: boolean
  rooms: Room[]
  placed: Record<string, PlacedItem[]>
  projectPatch: Partial<Project>
  appliedCount: number
  errors: string[]
  warnings: string[]
}

export function applyAssistantPlan(input: ApplyAssistantPlanInput): ApplyAssistantPlanResult {
  const { plan, project, wallThicknesses } = input
  let rooms = structuredClone(input.rooms)
  let placed = structuredClone(input.placed)
  let plotWidth = project.plot.width
  let plotLength = project.plot.length
  const units = project.plot.units
  let appliedCount = 0
  const errors: string[] = []
  const projectPatch: Partial<Project> = { ...(plan.project ?? {}) }
  if (plan.plot && (plan.plot.width || plan.plot.length || plan.plot.units) || plan.project && Object.keys(plan.project).length) appliedCount += 1

  if (plan.plot?.units && plan.plot.units !== units) {
    errors.push(`The assistant returned ${plan.plot.units}, but this project uses ${units}. Change units in the editor first; AI edits keep the current unit system.`)
  }
  if (plan.plot?.width) plotWidth = plan.plot.width
  if (plan.plot?.length) plotLength = plan.plot.length
  if (plotWidth > 1000 || plotLength > 1000) errors.push('Plot dimensions are limited to 1,000 project units in the assistant editor.')

  const updatePlot = (plot?: { width?: number; length?: number; units?: Units }) => {
    if (!plot) return
    if (plot.units && plot.units !== units) {
      errors.push(`The assistant returned ${plot.units}, but this project uses ${units}. Change units in the editor first.`)
      return
    }
    if (plot.width !== undefined) plotWidth = plot.width
    if (plot.length !== undefined) plotLength = plot.length
    if (!(plotWidth > 0 && plotLength > 0) || plotWidth > 1000 || plotLength > 1000) errors.push('The requested plot size is outside the supported range.')
  }

  for (const action of plan.actions) {
    if (action.type === 'create_house') {
      updatePlot(action.plot)
      if (errors.length) break
      if (action.replaceExisting !== false) {
        rooms = []
        placed = {}
      }
      for (const spec of action.rooms) {
        const room = makeRoom(spec, rooms, plotWidth, plotLength, units)
        if (!room) {
          errors.push(`Could not fit ${spec.name} (${spec.width} × ${spec.length} ${units}) inside the plot without a room collision.`)
          break
        }
        rooms.push(room)
        placed[room.id] = []
        appliedCount += 1
      }
      if (errors.length) break
      continue
    }

    if (action.type === 'add_room') {
      const room = makeRoom(action.room, rooms, plotWidth, plotLength, units)
      if (!room) { errors.push(`Could not find a clear plot position for ${action.room.name}.`); break }
      rooms.push(room)
      placed[room.id] = []
      appliedCount += 1
      continue
    }

    const room = resolveRoom(rooms, action.room)
    if (action.type === 'add_opening' || action.type === 'edit_opening' || action.type === 'remove_opening' || action.type === 'add_furniture' || action.type === 'remove_furniture' || action.type === 'set_room_finish' || action.type === 'set_room_shape') {
      if (!room) { errors.push(`I couldn't identify a room matching “${action.room}”. Use its exact name or ID.`); break }
    } else if (!room) {
      errors.push(`I couldn't identify a room matching “${action.room}”. Use its exact name or ID.`)
      break
    }

    if (action.type === 'resize_room' && room) {
      const width = action.width ?? room.rect.w
      const length = action.length ?? room.rect.h
      if (width > plotWidth || length > plotLength) { errors.push(`${room.name} would be larger than the plot.`); break }
      rooms = rooms.map((candidate) => candidate.id === room.id ? {
        ...candidate, width, length, rect: { x: action.x ?? candidate.rect.x, y: action.y ?? candidate.rect.y, w: width, h: length },
      } : candidate)
      appliedCount += 1
    } else if (action.type === 'move_room' && room) {
      rooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, rect: { ...candidate.rect, x: action.x, y: action.y } } : candidate)
      appliedCount += 1
    } else if (action.type === 'rename_room' && room) {
      rooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, name: action.name } : candidate)
      appliedCount += 1
    } else if (action.type === 'remove_room' && room) {
      rooms = rooms.filter((candidate) => candidate.id !== room.id)
      delete placed[room.id]
      appliedCount += 1
    } else if (action.type === 'set_room_shape' && room) {
      rooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, shape: action.shape, outline: outlineForShape(action.shape) } : candidate)
      appliedCount += 1
    } else if (action.type === 'remove_opening' && room) {
      const candidates = room.elements.filter((element) => (element.type === 'door' || element.type === 'window') && (!action.kind || element.type === action.kind))
      const target = action.opening
        ? candidates.find((element) => normalize(element.id) === normalize(action.opening!) || normalize(element.label ?? '') === normalize(action.opening!))
        : candidates[0]
      if (!target) { errors.push(`No matching door or window was found in ${room.name}.`); break }
      rooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, elements: candidate.elements.filter((element) => element.id !== target.id) } : candidate)
      appliedCount += 1
    } else if (action.type === 'edit_opening' && room) {
      const matches = room.elements.filter((element) => (element.type === 'door' || element.type === 'window') && (normalize(element.id) === normalize(action.opening) || normalize(element.label ?? '') === normalize(action.opening)))
      if (matches.length !== 1) { errors.push(matches.length ? `“${action.opening}” matches more than one opening in ${room.name}; use its exact label.` : `No opening named “${action.opening}” was found in ${room.name}.`); break }
      const target = matches[0]
      const patch: Partial<Element> = {
        ...(action.width !== undefined ? { width: action.width } : {}),
        ...(action.height !== undefined ? { height: action.height } : {}),
        ...(action.sillHeight !== undefined ? { sillHeight: action.sillHeight } : {}),
      }
      if (target.type === 'door' && action.style) patch.doorStyle = normalizeDoorStyle(action.style)
      if (target.type === 'window' && action.style) patch.windowStyle = normalizeWindowStyle(action.style)
      const candidateRooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, elements: candidate.elements.map((element) => element.id === target.id ? { ...element, ...patch } : element) } : candidate)
      const candidateModel = getFloorArchitecturalModel(candidateRooms, undefined, undefined, wallThicknesses)
      const issue = validateOpenings(candidateModel.walls, candidateModel.openings).find((item) => item.severity === 'error' && item.openingId === target.id)
      if (issue) { errors.push(issue.message); break }
      rooms = candidateRooms
      appliedCount += 1
    } else if (action.type === 'add_opening' && room) {
      const width = action.width ?? (units === 'ft' ? (action.kind === 'door' ? 3 : 4) : (action.kind === 'door' ? 0.9 : 1.2))
      const height = action.height ?? (units === 'ft' ? (action.kind === 'door' ? 7 : 4) : (action.kind === 'door' ? 2.1 : 1.2))
      const placement = findAvailableOpeningPosition(rooms, room.id, action.kind, width)
      if (!placement) { errors.push(`No free wall segment in ${room.name} fits a ${width} ${units} ${action.kind}.`); break }
      const element: Element = {
        id: `ai-${crypto.randomUUID()}`,
        type: action.kind,
        label: action.label ?? (action.kind === 'door' ? 'Door' : 'Window'),
        width, height, wallId: placement.wallId, offset: placement.offset,
        position: { x: 0, y: 0 },
        doorStyle: action.kind === 'door' ? normalizeDoorStyle(action.style) : undefined,
        windowStyle: action.kind === 'window' ? normalizeWindowStyle(action.style) : undefined,
        openingDirection: 'inward', hingeSide: 'left',
        sillHeight: action.kind === 'door' ? 0 : Math.max(0, action.sillHeight ?? (units === 'ft' ? 3 : 0.9)),
        color: action.kind === 'door' ? '#8a6a48' : '#9fd4ee',
      }
      rooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, elements: [...candidate.elements, element] } : candidate)
      const candidateModel = getFloorArchitecturalModel(rooms, undefined, undefined, wallThicknesses)
      const issue = validateOpenings(candidateModel.walls, candidateModel.openings).find((item) => item.severity === 'error' && item.openingId === element.id)
      if (issue) { errors.push(issue.message); break }
      appliedCount += 1
    } else if (action.type === 'add_furniture' && room) {
      const itemKey = canonicalFurnitureKey(action.item)
      const defaults = getFurnitureDimensions(itemKey, units)
      const dimensions = { width: action.width ?? defaults.width, depth: action.depth ?? defaults.depth, height: action.height ?? defaults.height }
      const current = placed[room.id] ?? room.items ?? []
      const position = findFurniturePosition(room, current, dimensions)
      if (!position) { errors.push(`No clear floor area in ${room.name} can fit ${action.item}.`); break }
      const next: PlacedItem = {
        id: `ai-${crypto.randomUUID()}`, item: itemKey, x: position.x, z: position.y, rotation: 0, scale: 1,
        ...dimensions, color: furnitureColor(itemKey),
      }
      placed[room.id] = [...current, next]
      rooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, items: placed[room.id] } : candidate)
      appliedCount += 1
    } else if (action.type === 'remove_furniture' && room) {
      const wanted = canonicalFurnitureKey(action.item)
      const current = placed[room.id] ?? room.items ?? []
      const remaining = current.filter((item) => canonicalFurnitureKey(item.item) !== wanted)
      if (remaining.length === current.length) { errors.push(`No ${action.item} was found in ${room.name}.`); break }
      placed[room.id] = remaining
      rooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, items: remaining } : candidate)
      appliedCount += current.length - remaining.length
    } else if (action.type === 'set_room_finish' && room) {
      rooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, finish: action.finish, finishColor: action.color ?? candidate.finishColor } : candidate)
      appliedCount += 1
    }
  }

  if (errors.length) return { ok: false, rooms: input.rooms, placed: input.placed, projectPatch: {}, appliedCount: 0, errors, warnings: [] }

  if (plotWidth !== project.plot.width || plotLength !== project.plot.length) {
    projectPatch.plot = { ...project.plot, width: plotWidth, length: plotLength }
  }
  const nextPlot = { ...project.plot, width: plotWidth, length: plotLength }
  const replacesPlan = plan.actions.some((action) => action.type === 'create_house' && action.replaceExisting !== false)
  const baselineRooms = replacesPlan ? [] : input.rooms
  const baselinePlaced = replacesPlan ? {} : input.placed
  const beforeModel = getFloorArchitecturalModel(baselineRooms, undefined, undefined, wallThicknesses)
  const afterModel = getFloorArchitecturalModel(rooms, undefined, undefined, wallThicknesses)
  const beforeIssues = validatePlan(baselineRooms, project.plot, beforeModel.walls, beforeModel.openings, baselinePlaced)
  const afterIssues = validatePlan(rooms, nextPlot, afterModel.walls, afterModel.openings, placed)
  const baselineErrors = new Set(beforeIssues.filter((issue) => issue.severity === 'error').map(issueKey))
  const newErrors = afterIssues.filter((issue) => issue.severity === 'error' && !baselineErrors.has(issueKey(issue)))
  if (newErrors.length) {
    return { ok: false, rooms: input.rooms, placed: input.placed, projectPatch: {}, appliedCount: 0, errors: newErrors.map((issue) => issue.message), warnings: [] }
  }
  const baselineWarnings = new Set(beforeIssues.filter((issue) => issue.severity === 'warning').map(issueKey))
  const warnings = afterIssues.filter((issue) => issue.severity === 'warning' && !baselineWarnings.has(issueKey(issue))).map((issue) => issue.message)
  return { ok: true, rooms, placed, projectPatch, appliedCount, errors: [], warnings }
}

function makeRoom(spec: AssistantRoomSpec, existing: Room[], plotWidth: number, plotLength: number, units: Units): Room | null {
  const width = round1(spec.width), length = round1(spec.length)
  if (!(width > 0 && length > 0) || width > plotWidth || length > plotLength) return null
  let x = spec.x, y = spec.y
  if (x === undefined || y === undefined) {
    const position = findRoomPosition(width, length, existing, plotWidth, plotLength)
    if (!position) return null
    x = position.x; y = position.y
  }
  if (x < 0 || y < 0 || x + width > plotWidth + 1e-6 || y + length > plotLength + 1e-6) return null
  const id = `ai-room-${crypto.randomUUID()}`
  return {
    id, name: spec.name, category: spec.category, width, length, units,
    rect: { x: round1(x), y: round1(y), w: width, h: length },
    shape: 'rectangle', outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    level: 1, furniture: [], elements: [], items: [],
  }
}

function outlineForShape(shape: 'rectangle' | 'L' | 'T' | 'U'): Vec2[] {
  const presets: Record<typeof shape, Vec2[]> = {
    rectangle: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    L: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.48 }, { x: 0.55, y: 0.48 }, { x: 0.55, y: 1 }, { x: 0, y: 1 }],
    T: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.38 }, { x: 0.68, y: 0.38 }, { x: 0.68, y: 1 }, { x: 0.32, y: 1 }, { x: 0.32, y: 0.38 }, { x: 0, y: 0.38 }],
    U: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.72, y: 1 }, { x: 0.72, y: 0.34 }, { x: 0.28, y: 0.34 }, { x: 0.28, y: 1 }, { x: 0, y: 1 }],
  }
  return presets[shape]
}

function findRoomPosition(width: number, length: number, rooms: Room[], plotWidth: number, plotLength: number): Vec2 | null {
  const columns = 24, rows = 24
  for (let row = 0; row <= rows; row += 1) {
    const y = round1((plotLength - length) * row / rows)
    for (let column = 0; column <= columns; column += 1) {
      const x = round1((plotWidth - width) * column / columns)
      const collision = rooms.some((room) => x < room.rect.x + room.rect.w - 0.01 && x + width > room.rect.x + 0.01 && y < room.rect.y + room.rect.h - 0.01 && y + length > room.rect.y + 0.01)
      if (!collision) return { x, y }
    }
  }
  return null
}

function resolveRoom(rooms: Room[], query: string): Room | null {
  const key = normalize(query)
  const exact = rooms.filter((room) => normalize(room.id) === key || normalize(room.name) === key)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return null
  const matches = rooms.filter((room) => normalize(room.name).includes(key) || key.includes(normalize(room.name)))
  return matches.length === 1 ? matches[0] : null
}
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function issueKey(issue: PlanIssue) { return `${issue.code}|${issue.roomId ?? ''}|${issue.message}` }
function round1(value: number) { return Math.round(value * 10) / 10 }
function normalizeDoorStyle(style?: string): Element['doorStyle'] { return ['single-hinged','double-hinged','sliding','pocket','folding'].includes(style ?? '') ? style as Element['doorStyle'] : 'single-hinged' }
function normalizeWindowStyle(style?: string): Element['windowStyle'] { return ['casement','sliding','bay','fixed'].includes(style ?? '') ? style as Element['windowStyle'] : 'sliding' }
function furnitureColor(item: string) { return item.includes('bed') ? '#e8e2d6' : item.includes('sofa') || item.includes('chair') ? '#7d8ba1' : '#a9805a' }
