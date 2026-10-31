import { REAL_MATERIALS, REAL_MODELS } from './realAssets'

export type AssetCategory = 'objects' | 'textures' | 'interior' | 'trees'

export interface AssetItem {
  /** Stable ArchNova ID; model identity is preserved in saved placed objects. */
  id: string
  name: string
  category: AssetCategory
  icon: string
  tags: string[]
  /** Only populated for verified, downloaded source files. */
  assetKind?: 'model' | 'material' | 'parametric'
  sourceAssetId?: string
  modelUrl?: string
  dimensionsM?: [number, number, number]
  placement?: 'floor' | 'ceiling' | 'site'
  orientation?: { upAxis: 'Y'; forwardAxis: '+Z'; pivot: 'bottom-center'; defaultRotationDegrees: number }
  materialMaps?: Record<string, string>
  source?: string
  sourceUrl?: string
  license?: string
  licenseUrl?: string
  author?: string
  polycount?: number
  itemKey?: string
  /** Current parametric objects are editor operations, not imported models. */
  parametricTool?: 'door' | 'window' | 'room' | 'trees'
  swatch?: string
}

/** Resolve a catalog-controlled /public path under either Vite base path. */
export function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL
  return `${base}${path.replace(/^\/+/, '')}`
}

export const ASSET_CATEGORIES: { value: AssetCategory | 'all'; label: string; blurb: string }[] = [
  { value: 'all', label: 'All assets', blurb: 'Verified Poly Haven models and PBR materials, plus editable parametric systems.' },
  { value: 'objects', label: '3D Objects', blurb: 'Imported outdoor models and editable architectural openings/site systems.' },
  { value: 'textures', label: 'Textures & Materials', blurb: 'Downloaded CC0 PBR maps; asphalt and paving are applied to parametric site surfaces.' },
  { value: 'interior', label: 'Interior', blurb: 'Downloaded real furniture, cabinetry, appliance and lighting models.' },
  { value: 'trees', label: 'Trees & Landscape', blurb: 'Downloaded landscape models. No palm-tree model is claimed in this starter set.' },
]

const PARAMETRIC_ASSETS: AssetItem[] = [
  { id: 'obj_door', name: 'Entrance door opening', category: 'objects', icon: 'Frame', tags: ['parametric', 'opening'], assetKind: 'parametric', parametricTool: 'door' },
  { id: 'obj_window', name: 'Casement window opening', category: 'objects', icon: 'Grid3x3', tags: ['parametric', 'opening'], assetKind: 'parametric', parametricTool: 'window' },
  { id: 'obj_roof_panel', name: 'Dimension-driven roof system', category: 'objects', icon: 'Home', tags: ['parametric', 'roof'], assetKind: 'parametric' },
  { id: 'obj_gate', name: 'Compound gate system', category: 'objects', icon: 'Fence', tags: ['parametric', 'site'], assetKind: 'parametric' },
  { id: 'obj_fence', name: 'Fence system', category: 'objects', icon: 'Fence', tags: ['parametric', 'boundary'], assetKind: 'parametric' },
]

export const ASSETS: AssetItem[] = [...REAL_MODELS, ...REAL_MATERIALS, ...PARAMETRIC_ASSETS]
