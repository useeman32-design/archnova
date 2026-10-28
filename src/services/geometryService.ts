import type { Floor, NewProjectForm } from '@/types'
import { generateFloors } from '@/lib/floorPlan'

/**
 * Geometry / floor-plan generation contract.
 *
 * Today `simulateGeometryService` returns the frontend-only layout from
 * `@/lib/floorPlan`. The real implementation will run the actual
 * constraint-solving engine and return verified geometry.
 */
export interface GeometryService {
  generateFloorPlan(form: NewProjectForm): Promise<Floor[]>
  isGeometryEngineReady(): boolean
}

export function createSimulatedGeometryService(): GeometryService {
  return {
    isGeometryEngineReady() {
      return false
    },
    async generateFloorPlan(form) {
      return generateFloors(form)
    },
  }
}

export const geometryService: GeometryService = createSimulatedGeometryService()
