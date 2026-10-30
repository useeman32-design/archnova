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
    const result = applyAssistantPlan({ plan, project, rooms: [], placed: {}, wallThicknesses: { exterior: 0.75, interior: 0.375 } })
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
    const result = applyAssistantPlan({ plan, project, rooms: [], placed: {}, wallThicknesses: { exterior: 0.75, interior: 0.375 } })
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
    const result = applyAssistantPlan({ plan, project, rooms: [], placed: {}, wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(result.ok).toBe(true)
    expect(result.rooms[0]).toMatchObject({ name: 'Home Office', width: 12, length: 10, finish: 'wood' })
  })

  it('does not apply a plan when a room target is ambiguous or missing', () => {
    const project = blankProject()
    const plan: AssistantPlan = { reply: 'Edit a room.', actions: [{ type: 'move_room', room: 'Missing Room', x: 3, y: 3 }] }
    const result = applyAssistantPlan({ plan, project, rooms: [], placed: {}, wallThicknesses: { exterior: 0.75, interior: 0.375 } })
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
    const result = applyAssistantPlan({ plan, project, rooms: [living], placed: {}, wallThicknesses: { exterior: 0.75, interior: 0.375 } })
    expect(result.ok).toBe(true)
    expect(result.rooms[0].shape).toBe('L')
    expect(result.rooms[0].elements).toEqual([])
  })
})
