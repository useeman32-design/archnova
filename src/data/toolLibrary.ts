import { REAL_MODELS } from './realAssets'

/**
 * ArchNova tool library — the categories and variants behind the editor's
 * left tool drawer (Photoshop/Corel-style). Variants carry default sizes so
 * placing them produces believable geometry immediately.
 */

export interface ToolVariant {
  id: string
  name: string
  icon: string
  /** Default footprint in plan units (rooms). */
  w?: number
  h?: number
  /** Label stored on opening elements (doors/windows/gates). */
  label?: string
  /** Interior item key matched by the 3D interior builder. */
  item?: string
  /** Tree or site-object kind. */
  kind?: string
  /** Stable ID of a verified imported model. */
  assetId?: string
  /** Optional local architectural product preview for site-tool variants. */
  previewImage?: string
}

export interface ToolCategory {
  id: string
  label: string
  variants: ToolVariant[]
}

export interface ToolGroup {
  tool: 'room' | 'door' | 'window' | 'interior' | 'trees'
  title: string
  blurb: string
  categories: ToolCategory[]
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    tool: 'room',
    title: 'Rooms & spaces',
    blurb: 'Click a variant, then click the plan — or drag it straight onto the plan.',
    categories: [
      {
        id: 'bed',
        label: 'Bedrooms',
        variants: [
          { id: 'rm_master', name: 'Master Bedroom', icon: 'BedDouble', w: 14, h: 12 },
          { id: 'rm_bed', name: 'Bedroom', icon: 'BedDouble', w: 12, h: 10 },
          { id: 'rm_kids', name: 'Kids Room', icon: 'BedDouble', w: 10, h: 10 },
          { id: 'rm_guest', name: 'Guest Room', icon: 'BedDouble', w: 12, h: 10 },
        ],
      },
      {
        id: 'living',
        label: 'Living & lounge',
        variants: [
          { id: 'rm_living', name: 'Living Room', icon: 'Sofa', w: 16, h: 14 },
          { id: 'rm_family', name: 'Family Lounge', icon: 'Sofa', w: 14, h: 12 },
          { id: 'rm_study', name: 'Study', icon: 'Laptop', w: 10, h: 10 },
        ],
      },
      {
        id: 'kitchen',
        label: 'Kitchen & dining',
        variants: [
          { id: 'rm_kitchen', name: 'Kitchen', icon: 'UtensilsCrossed', w: 12, h: 10 },
          { id: 'rm_dining', name: 'Dining Room', icon: 'Utensils', w: 10, h: 10 },
          { id: 'rm_pantry', name: 'Pantry', icon: 'Box', w: 6, h: 6 },
        ],
      },
      {
        id: 'bath',
        label: 'Bath & service',
        variants: [
          { id: 'rm_bath', name: 'Bathroom', icon: 'Bath', w: 8, h: 6 },
          { id: 'rm_ensuite', name: 'En-suite', icon: 'Bath', w: 8, h: 6 },
          { id: 'rm_laundry', name: 'Laundry', icon: 'Box', w: 8, h: 6 },
          { id: 'rm_store', name: 'Store', icon: 'Box', w: 8, h: 6 },
        ],
      },
      {
        id: 'out',
        label: 'Garage & outdoor',
        variants: [
          { id: 'rm_garage', name: 'Garage', icon: 'Car', w: 12, h: 18 },
          { id: 'rm_porch', name: 'Veranda', icon: 'Umbrella', w: 20, h: 6 },
          { id: 'rm_balcony', name: 'Balcony', icon: 'Umbrella', w: 12, h: 6 },
          { id: 'rm_pool', name: 'Pool', icon: 'Waves', w: 16, h: 10 },
        ],
      },
    ],
  },
  {
    tool: 'door',
    title: 'Doors & gates',
    blurb: 'Click a room on the plan to insert the opening.',
    categories: [
      {
        id: 'doors',
        label: 'Doors',
        variants: [
          { id: 'dr_entry', name: 'Entrance Door', icon: 'DoorOpen', label: 'Entrance door', w: 3.5, h: 7 },
          { id: 'dr_internal', name: 'Internal Door', icon: 'DoorClosed', label: 'Internal door', w: 3, h: 7 },
          { id: 'dr_french', name: 'French Door', icon: 'DoorOpen', label: 'French door', w: 5, h: 7 },
          { id: 'dr_sliding', name: 'Sliding Door', icon: 'DoorOpen', label: 'Sliding door', w: 6, h: 7 },
        ],
      },
      {
        id: 'gates',
        label: 'Gates',
        variants: [
          { id: 'gt_compound', name: 'Compound Gate', icon: 'Fence', label: 'Compound gate', w: 12, h: 7 },
          { id: 'gt_pedestrian', name: 'Pedestrian Gate', icon: 'Fence', label: 'Pedestrian gate', w: 3.5, h: 7 },
          { id: 'gt_garage', name: 'Garage Gate', icon: 'Car', label: 'Garage gate', w: 10, h: 8 },
        ],
      },
    ],
  },
  {
    tool: 'window',
    title: 'Windows',
    blurb: 'Click a room on the plan to insert the window.',
    categories: [
      {
        id: 'windows',
        label: 'Windows',
        variants: [
          { id: 'wn_casement', name: 'Casement Window', icon: 'AppWindow', label: 'Casement window', w: 4, h: 4 },
          { id: 'wn_sliding', name: 'Sliding Window', icon: 'AppWindow', label: 'Sliding window', w: 6, h: 4 },
          { id: 'wn_bay', name: 'Bay Window', icon: 'AppWindow', label: 'Bay window', w: 7, h: 4 },
          { id: 'wn_skylight', name: 'Skylight', icon: 'AppWindow', label: 'Skylight', w: 4, h: 4 },
        ],
      },
    ],
  },
  {
    tool: 'interior',
    title: 'Interior items',
    blurb: 'Place verified imported furniture, appliance and lighting models; each keeps its stable catalog ID in the project.',
    categories: [{
      id: 'real-interior-models',
      label: 'Imported models',
      variants: REAL_MODELS.filter((asset) => asset.category === 'interior' && asset.itemKey).map((asset) => ({
        id: asset.id, name: asset.name, icon: asset.icon, item: asset.itemKey, assetId: asset.id,
      })),
    }],
  },
  {
    tool: 'trees',
    title: 'Site & landscape',
    blurb: 'Use imported catalog models for detailed objects and editable parametric systems for roads, paths, gates and fences.',
    categories: [{
      id: 'site-models-and-systems',
      label: 'Site assets',
      variants: [
        ...REAL_MODELS.filter((asset) => asset.category === 'trees' || asset.category === 'objects').map((asset) => ({
          id: asset.id,
          name: asset.name,
          icon: asset.icon,
          assetId: asset.id,
          kind: asset.itemKey === 'tree' ? 'tree' : asset.itemKey,
        })),
        { id: 'site_fence', name: 'Dimension-driven Fence Segment', icon: 'Fence', kind: 'fence', w: 0.35, h: 10, previewImage: `${import.meta.env.BASE_URL}previews/site-fence.jpg` },
        { id: 'site_gate', name: 'Dimension-driven Compound Gate', icon: 'DoorClosed', kind: 'gate', w: 12, h: 0.5 },
        { id: 'site_path', name: 'Dimension-driven Footpath Segment', icon: 'Box', kind: 'path', w: 4, h: 24, previewImage: `${import.meta.env.BASE_URL}previews/site-path.jpg` },
        { id: 'site_road', name: 'Dimension-driven Road Segment', icon: 'Box', kind: 'road', w: 16, h: 60, previewImage: `${import.meta.env.BASE_URL}previews/site-road.jpg` },
      ],
    }],
  },
]

/** A library variant armed for placement on the plan. */
export interface PendingPlacement {
  tool: 'room' | 'door' | 'window' | 'interior' | 'trees'
  variant: ToolVariant
}

import { ASSETS, type AssetItem } from './assets'

export const ASSET_LOOKUP: Record<string, AssetItem> = Object.fromEntries(ASSETS.map((asset) => [asset.id, asset]))

/** Only real catalog IDs or explicit editable parametric systems resolve here. */
export function variantFromAsset(asset: AssetItem): PendingPlacement | null {
  if (asset.assetKind === 'material') return null
  const variant = { id: `as_${asset.id}`, name: asset.name, icon: asset.icon, assetId: asset.assetKind === 'model' ? asset.id : undefined }
  if (asset.assetKind === 'model' && asset.category === 'interior' && asset.itemKey) {
    return { tool: 'interior', variant: { ...variant, item: asset.itemKey } }
  }
  if (asset.assetKind === 'model' && (asset.category === 'trees' || asset.category === 'objects')) {
    const kind = asset.itemKey === 'tree' ? 'tree'
      : asset.itemKey === 'bench' ? 'bench'
      : asset.itemKey === 'street-light' ? 'street-light'
      : asset.itemKey === 'outdoor-set' ? 'outdoor-set'
      : asset.itemKey === 'decor' ? 'decor'
      : 'site-object'
    return { tool: 'trees', variant: { ...variant, kind } }
  }
  if (asset.assetKind === 'parametric') {
    if (asset.parametricTool === 'door' || asset.parametricTool === 'window') {
      return { tool: asset.parametricTool, variant: { ...variant, label: asset.name } }
    }
    if (asset.parametricTool === 'trees') return { tool: 'trees', variant: { ...variant, kind: asset.name.toLowerCase().includes('gate') ? 'gate' : 'fence' } }
  }
  return null
}
