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
  /** Tree ornament kind. */
  kind?: string
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
    blurb: 'Place furniture into a room — it also appears in the 3D interior.',
    categories: [
      {
        id: 'int_living',
        label: 'Living',
        variants: [
          { id: 'in_sofa', name: '3-seat Sofa', icon: 'Sofa', item: 'sofa' },
          { id: 'in_armchair', name: 'Armchair', icon: 'Armchair', item: 'armchair' },
          { id: 'in_tv', name: 'TV Stand', icon: 'Monitor', item: 'tv' },
          { id: 'in_lamp', name: 'Floor Lamp', icon: 'Lamp', item: 'lamp' },
          { id: 'in_chair', name: 'Dining Chair', icon: 'Armchair', item: 'chair' },
          { id: 'in_table', name: 'Coffee Table', icon: 'Box', item: 'coffee-table' },
          { id: 'in_ac', name: 'Wall AC Unit', icon: 'Box', item: 'ac' },
          { id: 'in_fan', name: 'Ceiling Fan', icon: 'Lamp', item: 'fan' },
          { id: 'in_bulb', name: 'Ceiling Light', icon: 'Lamp', item: 'bulb' },
        ],
      },
      {
        id: 'int_bed',
        label: 'Bedroom',
        variants: [
          { id: 'in_bed', name: 'Double Bed', icon: 'BedDouble', item: 'bed' },
          { id: 'in_wardrobe', name: 'Wardrobe', icon: 'Box', item: 'wardrobe' },
          { id: 'in_bedside', name: 'Bedside Table', icon: 'Table', item: 'bedside-table' },
        ],
      },
      {
        id: 'int_kitchen',
        label: 'Kitchen & dining',
        variants: [
          { id: 'in_cabinet', name: 'Cabinet Run', icon: 'UtensilsCrossed', item: 'kitchen' },
          { id: 'in_island', name: 'Kitchen Island', icon: 'PanelTop', item: 'island' },
          { id: 'in_sink', name: 'Kitchen Sink', icon: 'Waves', item: 'sink' },
          { id: 'in_cooker', name: 'Cooker / Hob', icon: 'CookingPot', item: 'cooker' },
          { id: 'in_fridge', name: 'Refrigerator', icon: 'Refrigerator', item: 'fridge' },
          { id: 'in_dining', name: 'Dining Table', icon: 'Utensils', item: 'dining' },
          { id: 'in_chairs', name: 'Dining Chair', icon: 'Armchair', item: 'chair' },
        ],
      },
      {
        id: 'int_bath',
        label: 'Bath & office',
        variants: [
          { id: 'in_bath', name: 'Bathtub', icon: 'Bath', item: 'bath' },
          { id: 'in_shower', name: 'Shower', icon: 'Waves', item: 'shower' },
          { id: 'in_washbasin', name: 'Washbasin', icon: 'Waves', item: 'washbasin' },
          { id: 'in_toilet', name: 'Toilet', icon: 'Box', item: 'toilet' },
          { id: 'in_desk', name: 'Study Desk', icon: 'Laptop', item: 'desk' },
        ],
      },
      {
        id: 'int_utility',
        label: 'Laundry & garage',
        variants: [
          { id: 'in_washer', name: 'Washer', icon: 'Box', item: 'washer' },
          { id: 'in_dryer', name: 'Dryer', icon: 'Box', item: 'dryer' },
          { id: 'in_car', name: 'Vehicle footprint', icon: 'Car', item: 'vehicle-footprint' },
          { id: 'in_shelf', name: 'Storage rack', icon: 'Box', item: 'storage-rack' },
        ],
      },
    ],
  },
  {
    tool: 'trees',
    title: 'Site & landscape',
    blurb: 'Place trees, cars, fences, gates, lights, paths and roads at the clicked plot location.',
    categories: [
      {
        id: 'trees',
        label: 'Site objects',
        variants: [
          { id: 'tr_palm', name: 'Palm Tree', icon: 'TreePalm', kind: 'palm' },
          { id: 'tr_conifer', name: 'Conifer', icon: 'TreePine', kind: 'conifer' },
          { id: 'tr_shrub', name: 'Shrub Bed', icon: 'Sprout', kind: 'shrub' },
          { id: 'tr_flower', name: 'Flower Bed', icon: 'Flower2', kind: 'flower' },
          { id: 'tr_hedge', name: 'Hedge Row', icon: 'Trees', kind: 'hedge' },
          { id: 'site_car', name: 'Parked Car', icon: 'Car', kind: 'car', w: 7, h: 14 },
          { id: 'site_person', name: 'Person Scale Figure', icon: 'Armchair', kind: 'person' },
          { id: 'site_fence', name: 'Fence Segment', icon: 'Fence', kind: 'fence', w: 0.35, h: 10 },
          { id: 'site_gate', name: 'Compound Gate', icon: 'DoorClosed', kind: 'gate', w: 12, h: 0.5 },
          { id: 'site_light', name: 'Street Light', icon: 'Lamp', kind: 'street-light' },
          { id: 'site_path', name: 'Footpath Segment', icon: 'Box', kind: 'path', w: 4, h: 24 },
          { id: 'site_road', name: 'Road Segment', icon: 'Box', kind: 'road', w: 16, h: 60 },
        ],
      },
    ],
  },
]

/** A library variant armed for placement on the plan. */
export interface PendingPlacement {
  tool: 'room' | 'door' | 'window' | 'interior' | 'trees'
  variant: ToolVariant
}

import { ASSETS } from './assets'

export const ASSET_LOOKUP: Record<string, { id: string; name: string; category: string }> =
  Object.fromEntries(ASSETS.map((a) => [a.id, { id: a.id, name: a.name, category: a.category }]))

/** Maps an asset-library record to a placeable tool variant (where possible). */
export function variantFromAsset(asset: {
  id: string
  name: string
  category: string
}): PendingPlacement | null {
  const name = asset.name
  if (asset.category === 'interior') {
    const item = name.toLowerCase().includes('sofa') ? 'sofa'
      : name.toLowerCase().includes('armchair') ? 'armchair'
      : name.toLowerCase().includes('bed') ? 'bed'
      : name.toLowerCase().includes('wardrobe') ? 'wardrobe'
      : name.toLowerCase().includes('tv') ? 'tv'
      : name.toLowerCase().includes('desk') ? 'desk'
      : name.toLowerCase().includes('kitchen') ? 'kitchen'
      : name.toLowerCase().includes('refrigerator') ? 'fridge'
      : name.toLowerCase().includes('lamp') ? 'lamp'
      : name.toLowerCase().includes('bathtub') ? 'bath'
      : name.toLowerCase().includes('dining') ? 'dining'
      : 'sofa'
    return { tool: 'interior', variant: { id: `as_${asset.id}`, name, icon: 'Sofa', item } }
  }
  if (asset.category === 'trees') {
    const kind = name.toLowerCase().includes('palm') ? 'palm'
      : name.toLowerCase().includes('conifer') ? 'conifer'
      : name.toLowerCase().includes('shrub') ? 'shrub'
      : name.toLowerCase().includes('flower') ? 'flower'
      : 'hedge'
    return { tool: 'trees', variant: { id: `as_${asset.id}`, name, icon: 'TreePine', kind } }
  }
  if (asset.category === 'objects') {
    const lower = name.toLowerCase()
    if (lower.includes('gate')) return { tool: 'door', variant: { id: `as_${asset.id}`, name, icon: 'Fence', label: name } }
    if (lower.includes('door')) return { tool: 'door', variant: { id: `as_${asset.id}`, name, icon: 'DoorOpen', label: name } }
    if (lower.includes('window')) return { tool: 'window', variant: { id: `as_${asset.id}`, name, icon: 'AppWindow', label: name } }
  }
  return null
}
