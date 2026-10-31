import { describe, expect, it } from 'vitest'
import { createProjectFromForm } from '@/lib/projectFactory'
import { defaultNewProjectForm } from '@/lib/defaultForm'
import { applyAssistantPlan } from '@/lib/applyAssistantPlan'
import type { AssistantPlan } from '@/services/groqAssistant'
import type { Room } from '@/types'

function blankProject() {
  const project = createProjectFromForm(defaultNewProjectForm())
  project.floors = project.floors.map((floor) => floor.level === 1 ? { ...floor, rooms: [] } : floor)
  return project
}

describe('AI design-plan application', () => {
  it('creates a room plan, adds openings and furniture, and returns project metadata', () => {
    const project = blankProject()
    const plan: AssistantPlan = {
      reply: 'I drafted a compact two-room starting plan.',
      project: { name: 'AI bungalow concept', buildingType: 'bungalow', bedrooms: 1, bathrooms: 1 },
      actions: [
        { type: 'create_house', rooms: [
          { name: 'Living Room', category: 'living', width: 18, length: 15, x: 2, y: 2 },
          { name: 'Kitchen', category: 'kitchen', width: 12, length: 15, x: 20, y: 2 },
          { name: 'Bedroom', category: 'bedroom', width: 14, length: 13, x: 2, y: 17 },
          { name: 'Bathroom', category: 'bathroom', width: 8, length: 8, x: 16, y: 17 },
        ] },
        { type: 'add_opening', room: 'Living Room', kind: 'door' },
        { type: 'add_opening', room: 'Kitchen', kind: 'window' },
        { type: 'add_furniture', room: 'Living Room', item: 'sofa' },
      ],
    }
    const result = applyAssistantPlan({ plan, project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(result.ok).toBe(true)
    expect(result.rooms).toHaveLength(4)
    expect(result.rooms.find((room) => room.name === 'Living Room')?.elements).toHaveLength(1)
    expect(result.rooms.find((room) => room.name === 'Kitchen')?.elements).toHaveLength(1)
    expect(result.placed[result.rooms[0].id]).toHaveLength(1)
    expect(result.placed[result.rooms[0].id][0].assetId).toBe('ph_model_sofa_02')
    expect(result.projectPatch.name).toBe('AI bungalow concept')
    expect(result.appliedCount).toBe(8)
  })

  it('adds a distinct multi-floor building with a deterministic site footprint', () => {
    const project = blankProject()
    const plan: AssistantPlan = {
      reply: 'A separate surgery block.',
      actions: [{ type: 'add_building', name: 'Surgery Block', purpose: { category: 'institutional', use: 'hospital surgery' }, role: 'secondary', width: 24, length: 18, floorCount: 3 }],
    }
    const result = applyAssistantPlan({ plan, project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(result.ok).toBe(true)
    const buildings = result.projectPatch.buildings ?? []
    const block = buildings.find((building) => building.name === 'Surgery Block')
    expect(block).toMatchObject({ purpose: { category: 'institutional', use: 'hospital surgery' }, role: 'secondary' })
    expect(block?.floors).toHaveLength(3)
    expect(block?.footprint).toMatchObject({ shape: 'polygon', source: 'ai-recommended', units: 'ft' })
    expect(block?.footprint?.vertices).toHaveLength(4)
    expect(result.projectPatch.buildings?.filter((building) => building.role === 'primary')).toHaveLength(1)
  })

  it('rejects a generated plan with overlapping rooms without partially applying it', () => {
    const project = blankProject()
    const plan: AssistantPlan = {
      reply: 'A two-room layout.',
      actions: [{ type: 'create_house', rooms: [
        { name: 'Living Room', category: 'living', width: 20, length: 16, x: 2, y: 2 },
        { name: 'Kitchen', category: 'kitchen', width: 12, length: 10, x: 12, y: 8 },
      ] }],
    }
    const result = applyAssistantPlan({ plan, project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => error.includes('overlaps'))).toBe(true)
    expect(result.rooms).toEqual([])
  })

  it('resolves existing rooms by name and performs iterative edits', () => {
    const project = blankProject()
    const plan: AssistantPlan = {
      reply: 'I resized and renamed the study.',
      actions: [
        { type: 'add_room', room: { name: 'Study', category: 'study', width: 10, length: 9 } },
        { type: 'resize_room', room: 'Study', width: 12, length: 10 },
        { type: 'rename_room', room: 'Study', name: 'Home Office' },
        { type: 'set_room_finish', room: 'Home Office', finish: 'wood' },
      ],
    }
    const result = applyAssistantPlan({ plan, project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(result.ok).toBe(true)
    expect(result.rooms[0]).toMatchObject({ name: 'Home Office', width: 12, length: 10, finish: 'wood' })
  })

  it('offers skip, overflow-red, and shrink-to-fit choices for site-capacity conflicts', () => {
    const project = blankProject()
    const plan: AssistantPlan = { reply: 'Add an access road.', actions: [{ type: 'add_site_item', kind: 'road', x: 25, y: 25, width: 16, length: 60 }] }
    const input = { plan, project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } }
    const strict = applyAssistantPlan(input)
    expect(strict.ok).toBe(false)
    expect(strict.siteFitConflicts).toContain('road')

    const skipped = applyAssistantPlan({ ...input, plan: { ...plan, siteFitMode: 'skip' } })
    expect(skipped.ok).toBe(true)
    expect(skipped.ornaments).toEqual([])
    expect(skipped.warnings.join(' ')).toMatch(/skipped/i)

    const overflow = applyAssistantPlan({ ...input, plan: { ...plan, siteFitMode: 'add-anyway' } })
    expect(overflow.ok).toBe(true)
    expect(overflow.ornaments[0].x).toBeGreaterThan(project.plot.width)
    expect(overflow.warnings.join(' ')).toMatch(/outside the boundary in red/i)

    const shrunk = applyAssistantPlan({ ...input, plan: { ...plan, siteFitMode: 'shrink-to-fit' } })
    expect(shrunk.ok).toBe(true)
    expect(shrunk.ornaments[0].length).toBeLessThan(60)
    expect(shrunk.warnings.join(' ')).toMatch(/reduced and repositioned/i)
  })

  it('uses remaining plot space first, then supports red overflow or shrink for a separate building', () => {
    const project = blankProject()
    const plan: AssistantPlan = { reply: 'Add a separate service building.', actions: [{ type: 'add_building', name: 'Service Block', purpose: { category: 'institutional', use: 'hospital service' }, role: 'service', width: 80, length: 80, floorCount: 1 }] }
    const strict = applyAssistantPlan({ plan, project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(strict.ok).toBe(false)
    expect(strict.siteFitConflicts).toContain('Service Block')

    const overflow = applyAssistantPlan({ plan: { ...plan, siteFitMode: 'add-anyway' }, project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(overflow.ok).toBe(true)
    const outside = overflow.projectPatch.buildings?.find((building) => building.name === 'Service Block')
    expect(outside?.footprint?.vertices.some((vertex) => vertex.x > project.plot.width)).toBe(true)

    const shrunk = applyAssistantPlan({ plan: { ...plan, siteFitMode: 'shrink-to-fit' }, project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(shrunk.ok).toBe(true)
    const fitted = shrunk.projectPatch.buildings?.find((building) => building.name === 'Service Block')
    expect(fitted?.footprint?.vertices.every((vertex) => vertex.x >= 0 && vertex.y >= 0 && vertex.x <= project.plot.width && vertex.y <= project.plot.length)).toBe(true)
  })

  it('does not apply a plan when a room target is ambiguous or missing', () => {
    const project = blankProject()
    const plan: AssistantPlan = { reply: 'Edit a room.', actions: [{ type: 'move_room', room: 'Missing Room', x: 3, y: 3 }] }
    const result = applyAssistantPlan({ plan, project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain("couldn't identify")
  })

  it('can reshape a room and remove a named door as one atomic edit', () => {
    const project = blankProject()
    const living: Room = {
      id: 'living-1', name: 'Living Room', category: 'living', width: 16, length: 14, units: 'ft',
      rect: { x: 2, y: 2, w: 16, h: 14 }, level: 1, furniture: [],
      elements: [{ id: 'door-front', type: 'door', label: 'Front Door', width: 3, height: 7, position: { x: 0, y: 0 } }],
    }
    const plan: AssistantPlan = {
      reply: 'I reshaped the living room and removed its front door.',
      actions: [
        { type: 'set_room_shape', room: 'Living Room', shape: 'L' },
        { type: 'remove_opening', room: 'Living Room', opening: 'Front Door' },
      ],
    }
    const result = applyAssistantPlan({ plan, project, rooms: [living], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(result.ok).toBe(true)
    expect(result.rooms[0].shape).toBe('L')
    expect(result.rooms[0].elements).toEqual([])
  })

  it('applies site objects, wall thickness, a custom room outline, and project preferences together', () => {
    const project = blankProject()
    const living: Room = {
      id: 'living-custom', name: 'Living Room', category: 'living', width: 16, length: 14, units: 'ft',
      rect: { x: 2, y: 2, w: 16, h: 14 }, level: 1, furniture: [], elements: [],
    }
    const plan: AssistantPlan = {
      reply: 'The room and site updates are ready.',
      project: { preferences: { exteriorFinish: 'paint', outdoor: ['garden'], notes: 'Keep the entry shaded.' } },
      plot: { shape: 'rectangle' },
      actions: [
        { type: 'set_room_shape', room: 'Living Room', shape: 'custom', outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }] },
        { type: 'set_wall_thickness', kind: 'exterior', value: 1 },
        { type: 'add_site_item', kind: 'tree', assetId: 'ph_model_quiver_tree_02', x: 4, y: 5 },
        { type: 'add_site_item', kind: 'road', x: 30, y: 40, width: 10, length: 30, rotationDegrees: 90 },
      ],
    }
    const result = applyAssistantPlan({ plan, project, rooms: [living], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(result.ok).toBe(true)
    expect(result.rooms[0].shape).toBe('custom')
    expect(result.ornaments[0]).toMatchObject({ kind: 'tree', assetId: 'ph_model_quiver_tree_02', x: 4, y: 5 })
    expect(result.ornaments[1]).toMatchObject({ kind: 'road', x: 30, y: 40, width: 10, length: 30, rotation: Math.PI / 2 })
    expect(result.wallThicknesses.exterior).toBe(1)
    expect(result.projectPatch.preferences?.exteriorFinish).toBe('paint')
    expect(result.projectPatch.preferences?.outdoor).toEqual(['garden'])
  })

  it('edits a unique placed item by ID and converts units without changing the plan scale', () => {
    const project = blankProject()
    const living: Room = {
      id: 'living-furnished', name: 'Living Room', category: 'living', width: 12, length: 10, units: 'ft',
      rect: { x: 2, y: 2, w: 12, h: 10 }, level: 1, furniture: [], elements: [],
    }
    const sofa = { id: 'sofa-1', item: 'sofa', x: 0, z: 0, width: 6, depth: 2, height: 3, rotation: 0, scale: 1, color: '#778899' }
    const edit = applyAssistantPlan({
      plan: { reply: 'Adjusted the sofa.', actions: [{ type: 'edit_furniture', room: 'Living Room', item: 'sofa-1', x: 0.1, rotationDegrees: 30 }] },
      project, rooms: [living], placed: { [living.id]: [sofa] }, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 },
    })
    expect(edit.ok).toBe(true)
    expect(edit.placed[living.id][0]).toMatchObject({ x: 0.1, color: '#778899' })
    expect(edit.placed[living.id][0].rotation).toBeCloseTo(Math.PI / 6)

    const converted = applyAssistantPlan({
      plan: { reply: 'Converted the project to metres.', actions: [], plot: { units: 'm' } },
      project, rooms: [living], placed: { [living.id]: [sofa] }, ornaments: [{ id: 'tree-1', kind: 'palm', x: 10, y: 12, rotation: 0, scale: 1, color: '#4f8a3f' }],
      wallThicknesses: { exterior: 0.75, interior: 0.375 },
    })
    expect(converted.ok).toBe(true)
    expect(converted.projectPatch.plot?.units).toBe('m')
    expect(converted.projectPatch.plot?.width).toBeCloseTo(project.plot.width * 0.3048, 4)
    expect(converted.rooms[0].width).toBeCloseTo(12 * 0.3048, 4)
    expect(converted.placed[living.id][0].width).toBeCloseTo(6 * 0.3048, 4)
    expect(converted.ornaments[0].x).toBeCloseTo(10 * 0.3048, 4)
  })

})
