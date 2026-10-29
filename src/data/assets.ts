/**
 * ArchNova asset library catalogue.
 *
 * Frontend-only preview of the library that will feed the 3D model service:
 * 3D objects, textures & materials, interior items and landscape/trees.
 * Real models (GLTF) and texture files attach to these records later.
 */

export type AssetCategory = 'objects' | 'textures' | 'interior' | 'trees'

export interface AssetItem {
  id: string
  name: string
  category: AssetCategory
  /** Lucide icon key rendered as the placeholder thumbnail. */
  icon: string
  tags: string[]
  /** Placeholder material swatch for texture assets. */
  swatch?: string
}

export const ASSET_CATEGORIES: { value: AssetCategory | 'all'; label: string; blurb: string }[] = [
  { value: 'all', label: 'All assets', blurb: 'Everything in the ArchNova library.' },
  { value: 'objects', label: '3D Objects', blurb: 'Building components: openings, stairs, roofs, gates.' },
  { value: 'textures', label: 'Textures & Materials', blurb: 'Wall, floor and roof finishes for renders.' },
  { value: 'interior', label: 'Interior', blurb: 'Furniture and interior items for room styling.' },
  { value: 'trees', label: 'Trees & Landscape', blurb: 'Planting, lawn and landscape features.' },
]

export const ASSETS: AssetItem[] = [
  // 3D objects
  { id: 'obj_door', name: 'Entrance door', category: 'objects', icon: 'Frame', tags: ['opening', '3 ft × 7 ft'] },
  { id: 'obj_window', name: 'Casement window', category: 'objects', icon: 'Grid3x3', tags: ['opening', 'glazing'] },
  { id: 'obj_stairs', name: 'Straight stair flight', category: 'objects', icon: 'Layers', tags: ['circulation', 'duplex'] },
  { id: 'obj_roof_panel', name: 'Roof panel', category: 'objects', icon: 'Home', tags: ['structure'] },
  { id: 'obj_garage_door', name: 'Garage door', category: 'objects', icon: 'Car', tags: ['opening', 'garage'] },
  { id: 'obj_gate', name: 'Compound gate', category: 'objects', icon: 'Fence', tags: ['site', 'security'] },
  { id: 'obj_fence', name: 'Fence panel', category: 'objects', icon: 'Fence', tags: ['site', 'boundary'] },

  // Textures & materials
  { id: 'tex_render', name: 'Smooth wall render', category: 'textures', icon: 'Layers', tags: ['exterior'], swatch: '#e9e4d8' },
  { id: 'tex_brick', name: 'Facing brick', category: 'textures', icon: 'Square', tags: ['exterior'], swatch: '#b0715a' },
  { id: 'tex_stone', name: 'Stone cladding', category: 'textures', icon: 'Mountain', tags: ['exterior', 'feature'], swatch: '#c8c1b2' },
  { id: 'tex_wood_floor', name: 'Wood flooring', category: 'textures', icon: 'Plane', tags: ['interior', 'floor'], swatch: '#c9a97f' },
  { id: 'tex_roof_tile', name: 'Roof tiles', category: 'textures', icon: 'Grid', tags: ['roof'], swatch: '#33415c' },
  { id: 'tex_glass', name: 'Glass façade', category: 'textures', icon: 'Grid3x3', tags: ['glazing'], swatch: '#bcd6e2' },
  { id: 'tex_tiles', name: 'Porcelain tiles', category: 'textures', icon: 'Grid3x3', tags: ['interior', 'wet areas'], swatch: '#dfe4e8' },

  // Interior
  { id: 'int_sofa', name: '3-seat sofa', category: 'interior', icon: 'Sofa', tags: ['living'] },
  { id: 'int_armchair', name: 'Armchair', category: 'interior', icon: 'Armchair', tags: ['living'] },
  { id: 'int_bed', name: 'Double bed', category: 'interior', icon: 'BedDouble', tags: ['bedroom'] },
  { id: 'int_dining', name: 'Dining table & chairs', category: 'interior', icon: 'Utensils', tags: ['dining'] },
  { id: 'int_wardrobe', name: 'Wardrobe', category: 'interior', icon: 'Box', tags: ['bedroom', 'storage'] },
  { id: 'int_tv', name: 'TV stand', category: 'interior', icon: 'Monitor', tags: ['living'] },
  { id: 'int_desk', name: 'Study desk', category: 'interior', icon: 'Laptop', tags: ['study'] },
  { id: 'int_kitchen', name: 'Kitchen cabinet run', category: 'interior', icon: 'UtensilsCrossed', tags: ['kitchen'] },
  { id: 'int_fridge', name: 'Refrigerator', category: 'interior', icon: 'Refrigerator', tags: ['kitchen'] },
  { id: 'int_lamp', name: 'Floor lamp', category: 'interior', icon: 'Lamp', tags: ['lighting'] },
  { id: 'int_bath', name: 'Bathtub', category: 'interior', icon: 'Bath', tags: ['bathroom'] },

  // Trees & landscape
  { id: 'tree_palm', name: 'Palm tree', category: 'trees', icon: 'TreePalm', tags: ['tropical'] },
  { id: 'tree_pine', name: 'Conifer', category: 'trees', icon: 'TreePine', tags: ['evergreen'] },
  { id: 'tree_shrub', name: 'Shrub bed', category: 'trees', icon: 'Sprout', tags: ['planting'] },
  { id: 'tree_flowers', name: 'Flower bed', category: 'trees', icon: 'Flower2', tags: ['planting'] },
  { id: 'tree_lawn', name: 'Lawn turf', category: 'trees', icon: 'Grid', tags: ['ground'] },
  { id: 'tree_hedge', name: 'Hedge row', category: 'trees', icon: 'Trees', tags: ['boundary'] },
]
