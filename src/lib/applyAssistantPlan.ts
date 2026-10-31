import type { ArchitecturalWall, Building, Element, PlacedItem, Project, Room, SiteBoundary, Units, Vec2 } from '@/types'
import { conversionFactor, convertPlacedItem, convertRoomUnits, convertWallThicknesses } from '@/lib/unitConversion'
import type { AssistantSiteItem } from '@/services/groqAssistant'
import { canonicalFurnitureKey, findFurniturePosition, validateFurniture } from '@/lib/furniture'
import { REAL_MODELS } from '@/data/realAssets'
import { findAvailableOpeningPosition, getFloorArchitecturalModel, validateOpenings } from '@/lib/architecturalModel'
import { validatePlan, type PlanIssue } from '@/lib/planValidation'
import type { AssistantPlan, AssistantRoomSpec } from '@/services/groqAssistant'
import { normalizeProjectModel } from '@/lib/projectModel'
import { pointInPolygon, polygonBounds } from '@/lib/siteGeometry'

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
  siteFitConflicts?: string[]
}

export function applyAssistantPlan(input: ApplyAssistantPlanInput): ApplyAssistantPlanResult {
  const { plan, project } = input
  const sourceUnits = project.plot.units
  const siteFitMode = plan.siteFitMode ?? 'strict'
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
  let buildings = (normalizeProjectModel(project).buildings ?? []).map((building) => convertBuildingUnits(structuredClone(building), plotFactor, units))
  let buildingsChanged = false
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
  const siteFitConflicts: string[] = []
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
    if (action.type === 'add_building') {
      const rotation = (action.rotationDegrees ?? 0) * Math.PI / 180
      let width = action.width, length = action.length
      const occupied = buildings.map((building) => building.footprint ? polygonBounds(building.footprint.vertices) : null).filter((bounds): bounds is { minX: number; minY: number; maxX: number; maxY: number } => Boolean(bounds))
      const primaryHasFootprint = buildings.some((building) => building.role === 'primary' && (building.footprint?.vertices.length ?? 0) >= 3)
      if (!primaryHasFootprint && rooms.length) occupied.push({
        minX: Math.min(...rooms.map((room) => room.rect.x)), minY: Math.min(...rooms.map((room) => room.rect.y)),
        maxX: Math.max(...rooms.map((room) => room.rect.x + room.rect.w)), maxY: Math.max(...rooms.map((room) => room.rect.y + room.rect.h)),
      })
      const requestedCenter = action.x !== undefined && action.y !== undefined ? { x: action.x, y: action.y } : null
      const fitsAt = (center: Vec2 | null) => {
        if (!center) return false
        const corners = rotatedBuildingCorners(center, width, length, rotation)
        const bounds = polygonBounds(corners)
        return Boolean(bounds && buildingFootprintInsideSite(corners, plotWidth, plotLength, project.site?.boundary, plotFactor) && !occupied.some((other) => boundsOverlap(bounds, other, 1)))
      }
      let center = requestedCenter
      if (!center) center = findBuildingPosition(width, length, rotation, plotWidth, plotLength, occupied, project.site?.boundary, plotFactor)
      let placementFits = fitsAt(center)
      let overflowPlacement = false
      if (!placementFits && siteFitMode === 'shrink-to-fit') {
        const factor = Math.min(1, plotWidth / width, plotLength / length)
        width = round4(width * factor)
        length = round4(length * factor)
        center = requestedCenter && fitsAt(requestedCenter) ? requestedCenter : findBuildingPosition(width, length, rotation, plotWidth, plotLength, occupied, project.site?.boundary, plotFactor)
        placementFits = fitsAt(center)
        if (placementFits) operationWarnings.push(`${action.name} was uniformly reduced to ${width} × ${length} ${units} to fit available plot capacity.`)
      }
      if (!placementFits && siteFitMode === 'skip') {
        operationWarnings.push(`${action.name} was skipped because no clear plot space remained.`)
        siteFitConflicts.push(action.name)
        continue
      }
      if (!placementFits && siteFitMode === 'add-anyway') {
        center = findBuildingPosition(width, length, rotation, plotWidth, plotLength, occupied, project.site?.boundary, plotFactor)
        placementFits = fitsAt(center)
        if (!placementFits) {
          center = { x: plotWidth + width / 2 + 2, y: Math.max(length / 2, Math.min(plotLength - length / 2, plotLength / 2)) }
          overflowPlacement = true
          operationWarnings.push(`${action.name} could not fit in remaining plot space and was placed outside the boundary in red.`)
        } else operationWarnings.push(`${action.name} was moved to remaining plot space.`)
      }
      if (!center || (!overflowPlacement && !placementFits)) {
        siteFitConflicts.push(action.name)
        errors.push(`No clear plot area could fit ${action.name} (${width} × ${length} ${units}); choose skip, add anyway, or shrink to fit.`)
        break
      }
      const footprint = makeBuildingFootprint(action.name, center, width, length, rotation, units)
      const newBuilding: Building = {
        id: `ai-building-${crypto.randomUUID()}`,
        name: action.name,
        purpose: action.purpose,
        role: action.role,
        floors: Array.from({ length: action.floorCount }, (_, index) => ({
          id: `ai-floor-${crypto.randomUUID()}`,
          name: index === 0 ? 'Ground Floor' : `Level ${index + 1}`,
          level: index + 1,
          rooms: [],
        })),
        footprint,
        assumptions: ['AI-recommended rectangular site footprint; dimensions and placement are conceptual and require user review.'],
      }
      buildings.push(newBuilding)
      buildingsChanged = true
      appliedCount += 1
      continue
    }

    if (action.type === 'add_site_item') {
      const dimensions = defaultSiteDimensions(action.kind, units)
      const asset = action.assetId ? REAL_MODELS.find((candidate) => candidate.id === action.assetId) : undefined
      const unitFactor = units === 'ft' ? 3.28084 : 1
      const modelSize = asset?.dimensionsM ? { width: asset.dimensionsM[0] * unitFactor, length: asset.dimensionsM[1] * unitFactor } : dimensions
      ornaments.push({ id: `ai-site-${crypto.randomUUID()}`, ...(asset ? { assetId: asset.id } : {}), kind: action.kind, x: round4(action.x), y: round4(action.y), rotation: (action.rotationDegrees ?? 0) * Math.PI / 180, scale: action.scale ?? 1, color: action.color ?? siteColor(action.kind), width: action.width ?? modelSize.width, length: action.length ?? modelSize.length })
      appliedCount += 1
      continue
    }
    if (action.type === 'edit_site_item' || action.type === 'remove_site_item') {
      const site = resolveSite(ornaments, action.site)
      if (!site) { errors.push(`I couldn't identify a unique site object matching “${action.site}”. Use its exact ID or a unique object kind.`); break }
      if (action.type === 'remove_site_item') ornaments = ornaments.filter((candidate) => candidate.id !== site.id)
      else {
        const x = action.x ?? site.x, y = action.y ?? site.y
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
      const asset = action.assetId ? REAL_MODELS.find((candidate) => candidate.id === action.assetId && candidate.category === 'interior') : REAL_MODELS.find((candidate) => candidate.category === 'interior' && canonicalFurnitureKey(candidate.itemKey ?? '') === itemKey)
      if (!asset?.dimensionsM) { errors.push(`No imported GLTF model is registered for ${action.item}; the assistant will not substitute procedural furniture.`); break }
      const unitFactor = room.units === 'ft' ? 3.28084 : 1
      const defaults = { width: asset.dimensionsM[0] * unitFactor, depth: asset.dimensionsM[1] * unitFactor, height: asset.dimensionsM[2] * unitFactor }
      const dimensions = { width: action.width ?? defaults.width, depth: action.depth ?? defaults.depth, height: action.height ?? defaults.height }
      const current = placed[room.id] ?? room.items ?? []
      const position = findFurniturePosition(room, current, dimensions)
      if (!position) { errors.push(`No clear floor area in ${room.name} can fit ${action.item}.`); break }
      const next: PlacedItem = {
        id: `ai-${crypto.randomUUID()}`, assetId: asset.id, item: itemKey, x: position.x, z: position.y, rotation: 0, scale: 1,
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

  if (errors.length) return { ok: false, rooms: input.rooms, placed: input.placed, ornaments: input.ornaments, wallThicknesses: input.wallThicknesses, projectPatch: {}, appliedCount: 0, errors, warnings: [], ...(siteFitConflicts.length ? { siteFitConflicts } : {}) }

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
  let warnings = [...new Set([...afterIssues.filter((issue) => issue.severity === 'warning' && !baselineWarnings.has(issueKey(issue))).map((issue) => issue.message), ...operationWarnings])]
  const createdOrRemovedRoom = plan.actions.some((action) => action.type === 'create_house' || action.type === 'add_room' || action.type === 'remove_room')
  if (createdOrRemovedRoom && !plan.project?.bedrooms && !(plan.project && 'bedrooms' in plan.project)) projectPatch.bedrooms = rooms.filter((room) => room.category === 'bedroom').length
  if (createdOrRemovedRoom && !plan.project?.bathrooms && !(plan.project && 'bathrooms' in plan.project)) projectPatch.bathrooms = rooms.filter((room) => room.category === 'bathroom').length
  if (buildingsChanged || plotFactor !== 1) {
    buildings = buildings.map((building) => building.role === 'primary'
      ? { ...building, floors: syncPrimaryBuildingFloor(building.floors, rooms) }
      : building)
    projectPatch.buildings = buildings
  }
  const initialSites = new Map(convertedOriginalOrnaments.map((site) => [site.id, site]))
  const changedOutOfBounds = ornaments.filter((site) => {
    const before = initialSites.get(site.id)
    const changed = !before || before.x !== site.x || before.y !== site.y || before.width !== site.width || before.length !== site.length || before.rotation !== site.rotation || before.scale !== site.scale
    return changed && !siteFitsBoundary(site, plotWidth, plotLength, project.site?.boundary, plotFactor)
  })
  if (changedOutOfBounds.length && siteFitMode === 'strict') {
    const names = changedOutOfBounds.map((site) => site.kind ?? site.id)
    return { ok: false, rooms: input.rooms, placed: input.placed, ornaments: input.ornaments, wallThicknesses: input.wallThicknesses, projectPatch: {}, appliedCount: 0, errors: changedOutOfBounds.map((site) => `Site object ${site.kind ?? site.id} would extend outside the plot boundary.`), warnings: [], siteFitConflicts: names }
  }
  if (changedOutOfBounds.length && siteFitMode === 'skip') {
    for (const site of changedOutOfBounds) {
      const original = initialSites.get(site.id)
      ornaments = original ? ornaments.map((item) => item.id === site.id ? original : item) : ornaments.filter((item) => item.id !== site.id)
    }
    appliedCount = Math.max(0, appliedCount - changedOutOfBounds.length)
    warnings.push(...changedOutOfBounds.map((site) => `${site.kind ?? site.id} was skipped because it did not fit inside the site boundary.`))
  } else if (changedOutOfBounds.length && siteFitMode === 'shrink-to-fit') {
    ornaments = ornaments.map((site) => changedOutOfBounds.some((outside) => outside.id === site.id) ? fitSiteItemToPlot(site, plotWidth, plotLength, project.site?.boundary, plotFactor) : site)
    const stillOutside = ornaments.filter((site) => changedOutOfBounds.some((outside) => outside.id === site.id) && !siteFitsBoundary(site, plotWidth, plotLength, project.site?.boundary, plotFactor))
    if (stillOutside.length) {
      const names = stillOutside.map((site) => site.kind ?? site.id)
      return { ok: false, rooms: input.rooms, placed: input.placed, ornaments: input.ornaments, wallThicknesses: input.wallThicknesses, projectPatch: {}, appliedCount: 0, errors: stillOutside.map((site) => `${site.kind ?? site.id} could not be shrunk into the defined boundary.`), warnings: [], siteFitConflicts: names }
    }
    warnings.push(...changedOutOfBounds.map((site) => `${site.kind ?? site.id} was reduced and repositioned to fit inside the plot.`))
  } else if (changedOutOfBounds.length && siteFitMode === 'add-anyway') {
    for (const site of changedOutOfBounds) {
      const center = findSiteItemPosition(site, plotWidth, plotLength, project.site?.boundary, plotFactor, buildings, ornaments.filter((item) => item.id !== site.id), rooms)
      if (center) {
        ornaments = ornaments.map((item) => item.id === site.id ? { ...item, x: center.x, y: center.y } : item)
        warnings.push(`${site.kind ?? site.id} was moved into remaining plot space.`)
      } else {
        const halfW = siteHalfWidth(site), halfL = siteHalfLength(site)
        ornaments = ornaments.map((item) => item.id === site.id ? { ...item, x: round4(plotWidth + halfW + 2), y: round4(Math.max(halfL, plotLength / 2)) } : item)
        warnings.push(`${site.kind ?? site.id} did not fit in remaining plot space and is shown outside the boundary in red.`)
      }
    }
  }
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
function convertBuildingUnits(building: Building, factor: number, units: Units): Building {
  if (factor === 1) return building
  return {
    ...building,
    floors: building.floors.map((floor) => ({ ...floor, rooms: floor.rooms.map((room) => convertRoomUnits(room, units)) })),
    ...(building.footprint ? { footprint: {
      ...building.footprint,
      units,
      vertices: building.footprint.vertices.map((vertex) => ({ ...vertex, x: round4(vertex.x * factor), y: round4(vertex.y * factor) })),
      ...(building.footprint.area !== undefined ? { area: round4(building.footprint.area * factor * factor) } : {}),
    } } : {}),
  }
}

function syncPrimaryBuildingFloor(floors: Building['floors'], rooms: Room[]): Building['floors'] {
  const next = structuredClone(floors)
  const ground = next.findIndex((floor) => floor.level === 1)
  if (ground >= 0) next[ground] = { ...next[ground], rooms: structuredClone(rooms) }
  else next.unshift({ id: `ai-floor-${crypto.randomUUID()}`, name: 'Ground Floor', level: 1, rooms: structuredClone(rooms) })
  return next
}

function makeBuildingFootprint(name: string, center: Vec2, width: number, length: number, rotation: number, units: Units): SiteBoundary {
  const vertices = rotatedBuildingCorners(center, width, length, rotation)
  return {
    id: `ai-footprint-${crypto.randomUUID()}`,
    shape: 'polygon',
    vertices: vertices.map((point, index) => ({ ...point, id: `ai-footprint:${name}:${index + 1}:${crypto.randomUUID()}` })),
    units,
    status: 'defined',
    source: 'ai-recommended',
    area: round4(width * length),
    assumptions: ['AI-recommended rectangular building footprint in plot coordinates; concept only.'],
  }
}

function rotatedBuildingCorners(center: Vec2, width: number, length: number, rotation: number): Vec2[] {
  const cos = Math.cos(rotation), sin = Math.sin(rotation)
  return [
    { x: -width / 2, y: -length / 2 }, { x: width / 2, y: -length / 2 },
    { x: width / 2, y: length / 2 }, { x: -width / 2, y: length / 2 },
  ].map((point) => ({ x: round4(center.x + point.x * cos - point.y * sin), y: round4(center.y + point.x * sin + point.y * cos) }))
}

function findBuildingPosition(width: number, length: number, rotation: number, plotWidth: number, plotLength: number, occupied: { minX: number; minY: number; maxX: number; maxY: number }[], boundary?: SiteBoundary, boundaryScale = 1): Vec2 | null {
  if (width > plotWidth || length > plotLength) return null
  const columns = 32, rows = 32
  const candidates: Vec2[] = []
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      candidates.push({ x: (plotWidth * column) / columns, y: (plotLength * row) / rows })
    }
  }
  const center = { x: plotWidth / 2, y: plotLength / 2 }
  candidates.sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y))
  for (const candidate of candidates) {
    const corners = rotatedBuildingCorners(candidate, width, length, rotation)
    const bounds = polygonBounds(corners)
    if (!bounds || !buildingFootprintInsideSite(corners, plotWidth, plotLength, boundary, boundaryScale)) continue
    if (occupied.some((other) => boundsOverlap(bounds, other, 1))) continue
    return candidate
  }
  return null
}

function buildingFootprintInsideSite(corners: Vec2[], plotWidth: number, plotLength: number, boundary?: SiteBoundary, boundaryScale = 1): boolean {
  if (corners.some((point) => point.x < 0 || point.y < 0 || point.x > plotWidth || point.y > plotLength)) return false
  if (!boundary || boundary.status === 'unknown' || boundary.vertices.length < 3) return true
  const polygon = boundary.vertices.map((point) => ({ x: point.x * boundaryScale, y: point.y * boundaryScale }))
  const samples = [...corners]
  for (let i = 0; i < corners.length; i += 1) {
    const a = corners[i], b = corners[(i + 1) % corners.length]
    for (const t of [0.25, 0.5, 0.75]) samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  samples.push({ x: corners.reduce((sum, point) => sum + point.x, 0) / corners.length, y: corners.reduce((sum, point) => sum + point.y, 0) / corners.length })
  return samples.every((point) => pointInPolygon(point, polygon))
}

function boundsOverlap(a: { minX: number; minY: number; maxX: number; maxY: number }, b: { minX: number; minY: number; maxX: number; maxY: number }, gap: number): boolean {
  return a.minX < b.maxX + gap && a.maxX + gap > b.minX && a.minY < b.maxY + gap && a.maxY + gap > b.minY
}

function siteWithinPlot(site: AssistantSiteItem, width: number, length: number): boolean {
  const halfW = siteHalfWidth(site)
  const halfL = siteHalfLength(site)
  return site.x - halfW >= 0 && site.y - halfL >= 0 && site.x + halfW <= width && site.y + halfL <= length
}

function siteHalfWidth(site: AssistantSiteItem): number {
  const scaledWidth = (site.width ?? 0) * site.scale
  const scaledLength = (site.length ?? 0) * site.scale
  return Math.abs(Math.cos(site.rotation)) * scaledWidth / 2 + Math.abs(Math.sin(site.rotation)) * scaledLength / 2
}

function siteHalfLength(site: AssistantSiteItem): number {
  const scaledWidth = (site.width ?? 0) * site.scale
  const scaledLength = (site.length ?? 0) * site.scale
  return Math.abs(Math.sin(site.rotation)) * scaledWidth / 2 + Math.abs(Math.cos(site.rotation)) * scaledLength / 2
}

function siteCorners(site: AssistantSiteItem): Vec2[] {
  const width = (site.width ?? 0) * site.scale, length = (site.length ?? 0) * site.scale
  return [{ x: -width / 2, y: -length / 2 }, { x: width / 2, y: -length / 2 }, { x: width / 2, y: length / 2 }, { x: -width / 2, y: length / 2 }].map((point) => ({
    x: site.x + point.x * Math.cos(site.rotation) - point.y * Math.sin(site.rotation),
    y: site.y + point.x * Math.sin(site.rotation) + point.y * Math.cos(site.rotation),
  }))
}

function siteFitsBoundary(site: AssistantSiteItem, width: number, length: number, boundary?: SiteBoundary, boundaryScale = 1): boolean {
  if (!siteWithinPlot(site, width, length)) return false
  if (!boundary || boundary.status === 'unknown' || boundary.vertices.length < 3) return true
  const polygon = boundary.vertices.map((point) => ({ x: point.x * boundaryScale, y: point.y * boundaryScale }))
  const corners = siteCorners(site)
  if (!corners.every((point) => pointInPolygon(point, polygon))) return false
  return corners.every((point, index) => {
    const next = corners[(index + 1) % corners.length]
    return [0.25, 0.5, 0.75].every((t) => pointInPolygon({ x: point.x + (next.x - point.x) * t, y: point.y + (next.y - point.y) * t }, polygon))
  })
}

function fitSiteItemToPlot(site: AssistantSiteItem, plotWidth: number, plotLength: number, boundary?: SiteBoundary, boundaryScale = 1): AssistantSiteItem {
  const baseWidth = site.width ?? 3, baseLength = site.length ?? 3
  const envelopeScale = Math.min(1, plotWidth / Math.max(2 * siteHalfWidth(site), 1e-6), plotLength / Math.max(2 * siteHalfLength(site), 1e-6))
  let candidate: AssistantSiteItem = { ...site, width: round4(baseWidth * envelopeScale), length: round4(baseLength * envelopeScale) }
  const polygon = boundary && boundary.status !== 'unknown' && boundary.vertices.length >= 3
    ? boundary.vertices.map((point) => ({ x: point.x * boundaryScale, y: point.y * boundaryScale }))
    : []
  const center = polygon.length ? { x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length, y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length } : { x: plotWidth / 2, y: plotLength / 2 }
  for (let index = 0; index < 14; index += 1) {
    candidate = { ...candidate, x: center.x, y: center.y }
    if (siteFitsBoundary(candidate, plotWidth, plotLength, boundary, boundaryScale)) return candidate
    candidate = { ...candidate, width: round4((candidate.width ?? baseWidth) * 0.8), length: round4((candidate.length ?? baseLength) * 0.8) }
  }
  return { ...candidate, x: round4(Math.min(plotWidth, Math.max(0, center.x))), y: round4(Math.min(plotLength, Math.max(0, center.y))) }
}

function findSiteItemPosition(
  item: AssistantSiteItem,
  plotWidth: number,
  plotLength: number,
  boundary: SiteBoundary | undefined,
  boundaryScale: number,
  buildings: Building[],
  existingItems: AssistantSiteItem[],
  rooms: Room[],
): Vec2 | null {
  const centers = Array.from({ length: 33 * 33 }, (_, index) => ({ x: plotWidth * ((index % 33) / 32), y: plotLength * (Math.floor(index / 33) / 32) }))
  centers.sort((a, b) => Math.hypot(a.x - item.x, a.y - item.y) - Math.hypot(b.x - item.x, b.y - item.y))
  const obstacles = buildings.map((building) => building.footprint ? polygonBounds(building.footprint.vertices) : null).filter((bounds): bounds is NonNullable<typeof bounds> => Boolean(bounds))
  if (!buildings.some((building) => building.role === 'primary' && (building.footprint?.vertices.length ?? 0) >= 3) && rooms.length) obstacles.push({ minX: Math.min(...rooms.map((room) => room.rect.x)), minY: Math.min(...rooms.map((room) => room.rect.y)), maxX: Math.max(...rooms.map((room) => room.rect.x + room.rect.w)), maxY: Math.max(...rooms.map((room) => room.rect.y + room.rect.h)) })
  const siteObstacles = existingItems.map((site) => polygonBounds(siteCorners(site))).filter((bounds): bounds is NonNullable<typeof bounds> => Boolean(bounds))
  for (const center of centers) {
    const candidate = { ...item, x: center.x, y: center.y }
    const bounds = polygonBounds(siteCorners(candidate))
    if (!bounds || !siteFitsBoundary(candidate, plotWidth, plotLength, boundary, boundaryScale)) continue
    if (obstacles.some((other) => boundsOverlap(bounds, other, 0.5)) || siteObstacles.some((other) => boundsOverlap(bounds, other, 0.25))) continue
    return center
  }
  return null
}
function siteColor(kind: string): string { return kind === 'car' ? '#53677e' : kind === 'person' ? '#455f87' : kind === 'road' ? '#555b62' : kind === 'path' ? '#c9c4b9' : kind === 'fence' || kind === 'gate' ? '#6c6254' : '#4f8a3f' }
function issueKey(issue: PlanIssue) { return `${issue.code}|${issue.roomId ?? ''}|${issue.message}` }
function round1(value: number) { return Math.round(value * 10) / 10 }
function round4(value: number) { return Math.round(value * 10000) / 10000 }
function normalizeDoorStyle(style?: string): Element['doorStyle'] { return ['single-hinged','double-hinged','sliding','pocket','folding'].includes(style ?? '') ? style as Element['doorStyle'] : 'single-hinged' }
function normalizeWindowStyle(style?: string): Element['windowStyle'] { return ['casement','sliding','bay','fixed'].includes(style ?? '') ? style as Element['windowStyle'] : 'sliding' }
function furnitureColor(item: string) { return item.includes('bed') ? '#e8e2d6' : item.includes('sofa') || item.includes('chair') ? '#7d8ba1' : '#a9805a' }
