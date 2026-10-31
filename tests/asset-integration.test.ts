import { beforeEach, describe, expect, it } from 'vitest'
import { ASSETS } from '@/data/assets'
import { REAL_MODELS, REAL_MATERIALS } from '@/data/realAssets'
import { variantFromAsset } from '@/data/toolLibrary'
import { createLocalProjectService } from '@/services/projectService'
import { defaultNewProjectForm } from '@/lib/defaultForm'
import { SITE_PBR_ID, pbrIdForFinish } from '@/components/3d-viewer/PbrSurfaceMaterial'
import { threeModelService } from '@/services/threeModelService'

beforeEach(() => localStorage.clear())

describe('real asset starter collection', () => {
  it('registers only downloaded Poly Haven models/materials as imported assets with stable source identity', () => {
    expect(REAL_MODELS).toHaveLength(14)
    expect(REAL_MATERIALS).toHaveLength(6)
    for (const asset of [...REAL_MODELS, ...REAL_MATERIALS]) {
      expect(asset.id).toMatch(/^ph_(model|material)_/)
      expect(asset.source).toBe('Poly Haven')
      expect(asset.license).toBe('CC0 1.0 Universal')
      expect(asset.sourceUrl).toContain('polyhaven.com/a/')
    }
    expect(ASSETS.some((asset) => asset.id === 'int_bed')).toBe(false)
    expect(ASSETS.some((asset) => asset.id === 'tree_palm')).toBe(false)
  })

  it('resolves exact GLTF IDs for placement and does not invent a missing furniture model', () => {
    const sofa = ASSETS.find((asset) => asset.id === 'ph_model_sofa_02')!
    expect(variantFromAsset(sofa)?.variant).toMatchObject({ assetId: 'ph_model_sofa_02', item: 'sofa' })
    expect(variantFromAsset({ id: 'fake-bed', name: 'Modern Bed', category: 'interior', icon: 'BedDouble', tags: [] })).toBeNull()
  })

  it('uses downloaded PBR maps for real finishes and parametric site surfaces', () => {
    expect(pbrIdForFinish('concrete')).toBe('ph_material_brushed_concrete')
    expect(pbrIdForFinish('wood')).toBe('ph_material_american_walnut_veneer')
    expect(pbrIdForFinish('stone')).toBe('ph_material_stone_pavers')
    expect(SITE_PBR_ID).toEqual({ asphalt: 'ph_material_asphalt_01', paving: 'ph_material_interlocking_concrete_pavers' })
  })

  it('retains model identity through local project save and reload', async () => {
    const service = createLocalProjectService()
    const project = await service.create(defaultNewProjectForm())
    const floors = structuredClone(project.floors)
    const room = floors[0].rooms[0]
    const placed = { id: 'placed-real-sofa', assetId: 'ph_model_sofa_02', item: 'sofa', x: 0, z: 0, rotation: 0, scale: 1, width: 5.9, depth: 2.3, height: 2.3, color: '#79584d' }
    room.items = [...(room.items ?? []), placed]
    const landscape = [{ id: 'site-real-tree', assetId: 'ph_model_quiver_tree_02', kind: 'tree', x: 8, y: 7, rotation: 0, scale: 1, color: '#4f8a3f', width: 2.86, length: 2.89 }]
    await service.update(project.id, { floors, landscape })
    const reloaded = await createLocalProjectService().get(project.id)
    expect(reloaded?.floors[0].rooms[0].items?.at(-1)?.assetId).toBe('ph_model_sofa_02')
    expect(reloaded?.landscape?.[0].assetId).toBe('ph_model_quiver_tree_02')
  })

  it('reports the local Three.js GLTF loader as operational', () => {
    expect(threeModelService.isReady()).toBe(true)
    expect(threeModelService.describe()).toContain('GLTFLoader')
  })
})
