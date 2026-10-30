import type { ArchitecturalWall, Element, PlacedItem, Project, Room, Units, Vec2 } from '@/types'
import { conversionFactor, convertPlacedItem, convertRoomUnits, convertWallThicknesses } from '@/lib/unitConversion'
import type { AssistantSiteItem } from '@/services/groqAssistant'
import { canonicalFurnitureKey, findFurniturePosition, getFurnitureDimensions, validateFurniture } from '@/lib/furniture'
import { findAvailableOpeningPosition, getFloorArchitecturalModel, validateOpenings } from '@/lib/architecturalModel'
import { validatePlan, type PlanIssue } from '@/lib/planValidation'
import type { AssistantPlan, AssistantRoomSpec } from '@/services/groqAssistant'

export interface ApplyAssistantPlanInput {
  plan: AssistantPlan
  project: Project
  rooms: Room[]
  placed: Record<string, PlacedItem[]>
  ornaments: AssistantSiteItem[]
  wallThicknesses: { exterior: number; interior: number }
  units?: Units
}

export interface ApplyAssistantPlanResult {
  ok: boolean
  rooms: Room[]
  placed: Record<string, PlacedItem[]>
  ornaments: AssistantSiteItem[]
  wallThicknesses: { exterior: number; interior: number }
  projectPatch: Partial<Project>
  appliedCount: number
  errors: string[]
  warnings: string[]
}

export function applyAssistantPlan(input: ApplyAssistantPlanInput): ApplyAssistantPlanResult {
  const { plan, project } = input
  const sourceUnits = project.plot.units
  const editorUnits = input.units ?? sourceUnits
  const units = plan.plot?.units ?? sourceUnits
  const plotFactor = conversionFactor(sourceUnits, units)
  const editorFactor = conversionFactor(editorUnits, units)
  let rooms = input.rooms.map((room) => convertRoomUnits(structuredClone(room), units))
  let placed = Object.fromEntries(Object.entries(input.placed).map(([roomId, items]) => {
    const room = input.rooms.find((candidate) => candidate.id === roomId)
    return [roomId, items.map((item) => convertPlacedItem(item, room?.units ?? sourceUnits, units))]
  }))
  let ornaments = structuredClone(input.ornaments).map((item) => ({ ...item, x: round4(item.x * editorFactor), y: round4(item.y * editorFactor), ...(item.width !== undefined ? { width: round4(item.width * editorFactor) } : {}), ...(item.length !== undefined ? { length: round4(item.length * editorFactor) } : {}) }))
  let wallThicknesses = convertWallThicknesses(input.wallThicknesses, editorUnits, units)
  const convertedOriginalRooms = structuredClone(rooms)
  const convertedOriginalPlaced = structuredClone(placed)
  const convertedOriginalOrnaments = structuredClone(ornaments)
  if (plan.wallThicknesses?.exterior !== undefined) wallThicknesses.exterior = plan.wallThicknesses.exterior
  if (plan.wallThicknesses?.interior !== undefined) wallThicknesses.interior = plan.wallThicknesses.interior
  let plotWidth = round4(project.plot.width * plotFactor)
  let plotLength = round4(project.plot.length * plotFactor)
  let plotShape = plan.plot?.shape ?? project.plot.shape
  let appliedCount = 0
  const errors: string[] = []
  const operationWarnings: string[] = []
  const { preferences: preferencePatch, ...projectFields } = plan.project ?? {}
  const shouldPatchPreferences = Boolean(preferencePatch || editorUnits !== units || plan.wallThicknesses)
  const projectPatch: Partial<Project> = {
    ...projectFields,
    ...(shouldPatchPreferences ? { preferences: {
      ...project.preferences,
      ...(editorUnits !== units ? {
        exteriorWallThickness: wallThicknesses.exterior,
        interiorWallThickness: wallThicknesses.interior,
      } : {}),
      ...(preferencePatch ?? {}),
      ...(plan.wallThicknesses?.exterior !== undefined ? { exteriorWallThickness: wallThicknesses.exterior } : {}),
      ...(plan.wallThicknesses?.interior !== undefined ? { interiorWallThickness: wallThicknesses.interior } : {}),
    } } : {}),
  }
  if ((plan.plot && (plan.plot.width !== undefined || plan.plot.length !== undefined || plan.plot.units || plan.plot.shape)) || (plan.project && Object.keys(plan.project).length)) appliedCount += 1
  if (plan.wallThicknesses) appliedCount += Object.keys(plan.wallThicknesses).length

  if (plan.plot?.width !== undefined) plotWidth = plan.plot.width
  if (plan.plot?.length !== undefined) plotLength = plan.plot.length
  if (!(plotWidth > 0 && plotLength > 0) || plotWidth > 1000 || plotLength > 1000) errors.push('Plot dimensions are limited to 1,000 project units in the assistant editor.')
  const thicknessMin = units === 'ft' ? 0.1 : 0.03
  const thicknessMax = units === 'ft' ? 2 : 0.6
  if ([wallThicknesses.exterior, wallThicknesses.interior].some((value) => value < thicknessMin || value > thicknessMax)) errors.push(`Wall thickness must be between ${thicknessMin} and ${thicknessMax} ${units}.`)

  const updatePlot = (plot?: { width?: number; length?: number; units?: Units; shape?: typeof plotShape }) => {
    if (!plot) return
    if (plot.units && plot.units !== units) {
      errors.push(`The assistant returned conflicting unit systems (${plot.units} and ${units}).`)
      return
    }
    if (plot.width !== undefined) plotWidth = plot.width
    if (plot.length !== undefined) plotLength = plot.length
    if (plot.shape) plotShape = plot.shape
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

    if (action.type === 'set_wall_thickness') {
      const min = units === 'ft' ? 0.1 : 0.03, max = units === 'ft' ? 2 : 0.6
      if (action.value < min || action.value > max) { errors.push(`${action.kind} wall thickness must be between ${min} and ${max} ${units}.`); break }
      wallThicknesses = { ...wallThicknesses, [action.kind]: action.value }
      projectPatch.preferences = { ...(projectPatch.preferences ?? project.preferences), [action.kind === 'exterior' ? 'exteriorWallThickness' : 'interiorWallThickness']: action.value }
      appliedCount += 1
      continue
    }
    if (action.type === 'add_site_item') {
      if (action.x > plotWidth || action.y > plotLength) { errors.push('The site object must be placed within the plot.'); break }
      const dimensions = defaultSiteDimensions(action.kind, units)
      ornaments.push({ id: `ai-site-${crypto.randomUUID()}`, kind: action.kind, x: round4(action.x), y: round4(action.y), rotation: (action.rotationDegrees ?? 0) * Math.PI / 180, scale: action.scale ?? 1, color: action.color ?? siteColor(action.kind), width: action.width ?? dimensions.width, length: action.length ?? dimensions.length })
      appliedCount += 1
      continue
    }
    if (action.type === 'edit_site_item' || action.type === 'remove_site_item') {
      const site = resolveSite(ornaments, action.site)
      if (!site) { errors.push(`I couldn't identify a unique site object matching “${action.site}”. Use its exact ID or a unique object kind.`); break }
      if (action.type === 'remove_site_item') ornaments = ornaments.filter((candidate) => candidate.id !== site.id)
      else {
        const x = action.x ?? site.x, y = action.y ?? site.y
        if (x < 0 || y < 0 || x > plotWidth || y > plotLength) { errors.push('The site object must remain within the plot.'); break }
        ornaments = ornaments.map((candidate) => candidate.id === site.id ? { ...candidate, x: round4(x), y: round4(y), ...(action.rotationDegrees !== undefined ? { rotation: action.rotationDegrees * Math.PI / 180 } : {}), ...(action.scale !== undefined ? { scale: action.scale } : {}), ...(action.width !== undefined ? { width: action.width } : {}), ...(action.length !== undefined ? { length: action.length } : {}), ...(action.color ? { color: action.color } : {}) } : candidate)
      }
      appliedCount += 1
      continue
    }

    if (!('room' in action)) { errors.push('This operation is not supported by the plan applier.'); break }
    const room = resolveRoom(rooms, action.room)
    if (action.type === 'add_opening' || action.type === 'edit_opening' || action.type === 'remove_opening' || action.type === 'add_furniture' || action.type === 'edit_furniture' || action.type === 'remove_furniture' || action.type === 'set_room_finish' || action.type === 'set_room_shape') {
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
      rooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, shape: action.shape, outline: action.shape === 'custom' ? action.outline : outlineForShape(action.shape) } : candidate)
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
      if (action.style && target.type === 'door' && normalizeDoorStyle(action.style) !== action.style) { errors.push(`“${action.style}” is not a supported door type.`); break }
      if (action.style && target.type === 'window' && normalizeWindowStyle(action.style) !== action.style) { errors.push(`“${action.style}” is not a supported window type.`); break }
      const patch: Partial<Element> = {
        ...(action.label ? { label: action.label } : {}),
        ...(action.width !== undefined ? { width: action.width } : {}),
        ...(action.height !== undefined ? { height: action.height } : {}),
        ...(action.sillHeight !== undefined ? { sillHeight: action.sillHeight } : {}),
        ...(action.offset !== undefined ? { offset: action.offset } : {}),
        ...(action.direction ? { openingDirection: action.direction } : {}),
        ...(action.hingeSide ? { hingeSide: action.hingeSide } : {}),
        ...(action.color ? { color: action.color } : {}),
      }
      if (action.wall) {
        const wall = resolveHostWall(getFloorArchitecturalModel(rooms, undefined, undefined, wallThicknesses).walls, room, action.wall)
        if (!wall) { errors.push(`Could not identify host wall “${action.wall}” in ${room.name}.`); break }
        patch.wallId = wall.id
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
      const currentWalls = getFloorArchitecturalModel(rooms, undefined, undefined, wallThicknesses).walls
      const requestedWall = action.wall ? resolveHostWall(currentWalls, room, action.wall) : undefined
      if (action.wall && !requestedWall) { errors.push(`Could not identify host wall “${action.wall}” in ${room.name}.`); break }
      const placement = requestedWall
        ? { wallId: requestedWall.id, offset: action.offset ?? Math.max(0, (Math.hypot(requestedWall.end.x - requestedWall.start.x, requestedWall.end.y - requestedWall.start.y) - width) / 2) }
        : findAvailableOpeningPosition(rooms, room.id, action.kind, width)
      if (!placement) { errors.push(`No free wall segment in ${room.name} fits a ${width} ${units} ${action.kind}.`); break }
      const element: Element = {
        id: `ai-${crypto.randomUUID()}`,
        type: action.kind,
        label: action.label ?? (action.kind === 'door' ? 'Door' : 'Window'),
        width, height, wallId: placement.wallId, offset: placement.offset,
        position: { x: 0, y: 0 },
        doorStyle: action.kind === 'door' ? normalizeDoorStyle(action.style) : undefined,
        windowStyle: action.kind === 'window' ? normalizeWindowStyle(action.style) : undefined,
        openingDirection: action.direction ?? 'inward', hingeSide: action.hingeSide ?? 'left',
        sillHeight: action.kind === 'door' ? 0 : Math.max(0, action.sillHeight ?? (units === 'ft' ? 3 : 0.9)),
        color: action.color ?? (action.kind === 'door' ? '#8a6a48' : '#9fd4ee'),
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
    } else if (action.type === 'edit_furniture' && room) {
      const current = placed[room.id] ?? room.items ?? []
      const target = resolvePlacedItem(current, action.item)
      if (!target) { errors.push(`I couldn't identify a unique furniture item matching “${action.item}” in ${room.name}. Use its exact item ID if there are duplicates.`); break }
      const candidateItem: PlacedItem = {
        ...target,
        ...(action.x !== undefined ? { x: action.x } : {}),
        ...(action.z !== undefined ? { z: action.z } : {}),
        ...(action.width !== undefined ? { width: action.width } : {}),
        ...(action.depth !== undefined ? { depth: action.depth } : {}),
        ...(action.height !== undefined ? { height: action.height } : {}),
        ...(action.rotationDegrees !== undefined ? { rotation: action.rotationDegrees * Math.PI / 180 } : {}),
        ...(action.scale !== undefined ? { scale: action.scale } : {}),
        ...(action.color ? { color: action.color } : {}),
      }
      const next = current.map((item) => item.id === target.id ? candidateItem : item)
      const model = getFloorArchitecturalModel(rooms, undefined, undefined, wallThicknesses)
      const issues = validateFurniture(room, next, model.openings, model.walls)
      const issue = issues.find((candidate) => candidate.severity === 'error' && candidate.itemIds.includes(target.id))
      if (issue) { errors.push(issue.message); break }
      operationWarnings.push(...issues.filter((candidate) => candidate.severity === 'warning' && candidate.itemIds.includes(target.id)).map((candidate) => candidate.message))
      placed[room.id] = next
      rooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, items: next } : candidate)
      appliedCount += 1
    } else if (action.type === 'remove_furniture' && room) {
      const current = placed[room.id] ?? room.items ?? []
      const target = resolvePlacedItem(current, action.item)
      if (!target) { errors.push(`I couldn't identify a unique furniture item matching “${action.item}” in ${room.name}. Use its exact item ID if there are duplicates.`); break }
      const remaining = current.filter((item) => item.id !== target.id)
      placed[room.id] = remaining
      rooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, items: remaining } : candidate)
      appliedCount += 1
    } else if (action.type === 'set_room_finish' && room) {
      rooms = rooms.map((candidate) => candidate.id === room.id ? { ...candidate, finish: action.finish, finishColor: action.color ?? candidate.finishColor } : candidate)
      appliedCount += 1
    }
  }

  if (errors.length) return { ok: false, rooms: input.rooms, placed: input.placed, ornaments: input.ornaments, wallThicknesses: input.wallThicknesses, projectPatch: {}, appliedCount: 0, errors, warnings: [] }

  if (plotWidth !== project.plot.width || plotLength !== project.plot.length || units !== project.plot.units || plotShape !== project.plot.shape) {
    projectPatch.plot = { ...project.plot, width: plotWidth, length: plotLength, units, shape: plotShape }
  }
  const nextPlot = { ...project.plot, width: plotWidth, length: plotLength, units, shape: plotShape }
  const baselinePlot = { ...project.plot, width: round4(project.plot.width * plotFactor), length: round4(project.plot.length * plotFactor), units }
  const replacesPlan = plan.actions.some((action) => action.type === 'create_house' && action.replaceExisting !== false)
  const baselineRooms = replacesPlan ? [] : convertedOriginalRooms
  const baselinePlaced = replacesPlan ? {} : convertedOriginalPlaced
  const beforeModel = getFloorArchitecturalModel(baselineRooms, undefined, undefined, wallThicknesses)
  const afterModel = getFloorArchitecturalModel(rooms, undefined, undefined, wallThicknesses)
  const beforeIssues = validatePlan(baselineRooms, baselinePlot, beforeModel.walls, beforeModel.openings, baselinePlaced)
  const afterIssues = validatePlan(rooms, nextPlot, afterModel.walls, afterModel.openings, placed)
  const baselineErrors = new Set(beforeIssues.filter((issue) => issue.severity === 'error').map(issueKey))
  const newErrors = afterIssues.filter((issue) => issue.severity === 'error' && !baselineErrors.has(issueKey(issue)))
  if (newErrors.length) {
    return { ok: false, rooms: input.rooms, placed: input.placed, ornaments: input.ornaments, wallThicknesses: input.wallThicknesses, projectPatch: {}, appliedCount: 0, errors: newErrors.map((issue) => issue.message), warnings: [] }
  }
  const baselineWarnings = new Set(beforeIssues.filter((issue) => issue.severity === 'warning').map(issueKey))
  const warnings = [...new Set([...afterIssues.filter((issue) => issue.severity === 'warning' && !baselineWarnings.has(issueKey(issue))).map((issue) => issue.message), ...operationWarnings])]
  const createdOrRemovedRoom = plan.actions.some((action) => action.type === 'create_house' || action.type === 'add_room' || action.type === 'remove_room')
  if (createdOrRemovedRoom && !plan.project?.bedrooms && !(plan.project && 'bedrooms' in plan.project)) projectPatch.bedrooms = rooms.filter((room) => room.category === 'bedroom').length
  if (createdOrRemovedRoom && !plan.project?.bathrooms && !(plan.project && 'bathrooms' in plan.project)) projectPatch.bathrooms = rooms.filter((room) => room.category === 'bathroom').length
  const initialSites = new Map(convertedOriginalOrnaments.map((site) => [site.id, site]))
  const outOfBoundsSite = ornaments.find((site) => !siteWithinPlot(site, plotWidth, plotLength) && (() => { const before = initialSites.get(site.id); return !before || before.x !== site.x || before.y !== site.y || before.width !== site.width || before.length !== site.length || before.rotation !== site.rotation || before.scale !== site.scale })())
  if (outOfBoundsSite) return { ok: false, rooms: input.rooms, placed: input.placed, ornaments: input.ornaments, wallThicknesses: input.wallThicknesses, projectPatch: {}, appliedCount: 0, errors: [`Site object ${outOfBoundsSite.kind ?? outOfBoundsSite.id} would sit outside the plot.`], warnings: [] }
  return { ok: true, rooms, placed, ornaments, wallThicknesses, projectPatch, appliedCount, errors: [], warnings }
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
function resolvePlacedItem(items: PlacedItem[], query: string): PlacedItem | null {
  const key = normalize(query)
  const exactId = items.filter((item) => normalize(item.id) === key)
  if (exactId.length === 1) return exactId[0]
  const matches = items.filter((item) => normalize(item.item) === key || normalize(canonicalFurnitureKey(item.item)) === normalize(canonicalFurnitureKey(query)))
  return matches.length === 1 ? matches[0] : null
}
function resolveSite(items: AssistantSiteItem[], query: string): AssistantSiteItem | null {
  const key = normalize(query)
  const exact = items.filter((item) => normalize(item.id) === key)
  if (exact.length === 1) return exact[0]
  const matches = items.filter((item) => normalize(item.kind ?? '') === key)
  return matches.length === 1 ? matches[0] : null
}
function resolveHostWall(walls: ArchitecturalWall[], room: Room, query: string): ArchitecturalWall | null {
  const key = normalize(query)
  const candidates = walls.filter((wall) => wall.level === room.level && wall.roomIds.includes(room.id))
  const exact = candidates.filter((wall) => normalize(wall.id) === key)
  if (exact.length === 1) return exact[0]
  const side = (wall: ArchitecturalWall) => {
    const horizontal = Math.abs(wall.end.x - wall.start.x) >= Math.abs(wall.end.y - wall.start.y)
    const middle = horizontal ? (wall.start.y + wall.end.y) / 2 : (wall.start.x + wall.end.x) / 2
    if (horizontal) return middle <= room.rect.y + room.rect.h / 2 ? 'north' : 'south'
    return middle <= room.rect.x + room.rect.w / 2 ? 'west' : 'east'
  }
  const matches = candidates.filter((wall) => normalize(side(wall)) === key || normalize(`${side(wall)} wall`) === key)
  return matches.length === 1 ? matches[0] : null
}
function defaultSiteDimensions(kind: string, units: Units): { width: number; length: number } {
  const f = units === 'ft' ? 1 : 0.3048
  const sizes: Record<string, [number, number]> = { car: [7, 14], fence: [0.35, 10], gate: [12, 0.5], road: [16, 60], path: [4, 24], 'street-light': [0.5, 0.5], palm: [3, 3], conifer: [3, 3], shrub: [2, 2], flower: [2, 2], hedge: [2, 8], person: [1, 1] }
  const [width, length] = sizes[kind] ?? [2, 2]
  return { width: round4(width * f), length: round4(length * f) }
}
function siteWithinPlot(site: AssistantSiteItem, width: number, length: number): boolean {
  const scaledWidth = (site.width ?? 0) * site.scale
  const scaledLength = (site.length ?? 0) * site.scale
  const halfW = Math.abs(Math.cos(site.rotation)) * scaledWidth / 2 + Math.abs(Math.sin(site.rotation)) * scaledLength / 2
  const halfL = Math.abs(Math.sin(site.rotation)) * scaledWidth / 2 + Math.abs(Math.cos(site.rotation)) * scaledLength / 2
  return site.x - halfW >= 0 && site.y - halfL >= 0 && site.x + halfW <= width && site.y + halfL <= length
}
function siteColor(kind: string): string { return kind === 'car' ? '#53677e' : kind === 'person' ? '#455f87' : kind === 'road' ? '#555b62' : kind === 'path' ? '#c9c4b9' : kind === 'fence' || kind === 'gate' ? '#6c6254' : '#4f8a3f' }
function issueKey(issue: PlanIssue) { return `${issue.code}|${issue.roomId ?? ''}|${issue.message}` }
function round1(value: number) { return Math.round(value * 10) / 10 }
function round4(value: number) { return Math.round(value * 10000) / 10000 }
function normalizeDoorStyle(style?: string): Element['doorStyle'] { return ['single-hinged','double-hinged','sliding','pocket','folding'].includes(style ?? '') ? style as Element['doorStyle'] : 'single-hinged' }
function normalizeWindowStyle(style?: string): Element['windowStyle'] { return ['casement','sliding','bay','fixed'].includes(style ?? '') ? style as Element['windowStyle'] : 'sliding' }
function furnitureColor(item: string) { return item.includes('bed') ? '#e8e2d6' : item.includes('sofa') || item.includes('chair') ? '#7d8ba1' : '#a9805a' }
