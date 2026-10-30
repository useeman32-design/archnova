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
    expect(result.projectPatch.name).toBe('AI bungalow concept')
    expect(result.appliedCount).toBe(8)
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
        { type: 'add_site_item', kind: 'palm', x: 4, y: 5 },
        { type: 'add_site_item', kind: 'road', x: 30, y: 40, width: 10, length: 30, rotationDegrees: 90 },
      ],
    }
    const result = applyAssistantPlan({ plan, project, rooms: [living], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(result.ok).toBe(true)
    expect(result.rooms[0].shape).toBe('custom')
    expect(result.ornaments[0]).toMatchObject({ kind: 'palm', x: 4, y: 5 })
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
