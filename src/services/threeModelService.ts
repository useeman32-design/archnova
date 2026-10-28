import type { Project } from '@/types'

/**
 * 3D model contract.
 *
 * The current UI renders a parametric Three.js scene driven by the project
 * data (`@/components/3d-viewer`). This service is the seam where a real,
 * optimised model pipeline (GLTF assets, LOD, streaming) plugs in later.
 */
export interface ThreeModelService {
  isReady(): boolean
  /** Resolves to true when a real model asset was loaded for the project. */
  loadModel(project: Project): Promise<boolean>
  /** Human-readable label describing what the viewer is currently showing. */
  describe(): string
}

export function createPlaceholderThreeModelService(): ThreeModelService {
  return {
    isReady() {
      return false
    },
    async loadModel() {
      return false
    },
    describe() {
      return 'Parametric preview scene — not a verified building model.'
    },
  }
}

export const threeModelService: ThreeModelService = createPlaceholderThreeModelService()
