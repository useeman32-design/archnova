import type {
  BuildingType,
  FinishOption,
  OutdoorFeature,
  PlotShape,
  RoomCategory,
} from '@/types'

export interface Option<T extends string> {
  value: T
  label: string
  description: string
}

export const BUILDING_TYPES: Option<BuildingType>[] = [
  { value: 'bungalow', label: 'Bungalow', description: 'Single-storey home on one floor' },
  { value: 'duplex', label: 'Duplex', description: 'Two identical units sharing a wall' },
  { value: 'detached', label: 'Detached', description: 'Standalone house on its own plot' },
  { value: 'semi-detached', label: 'Semi-detached', description: 'Paired house sharing one wall' },
  { value: 'flats', label: 'Block of flats', description: 'Multi-storey apartment block' },
  { value: 'other', label: 'Other', description: 'Something custom' },
]

export const PLOT_SHAPES: Option<PlotShape>[] = [
  { value: 'rectangle', label: 'Rectangle', description: 'Standard long plot' },
  { value: 'square', label: 'Square', description: 'Equal side lengths' },
  { value: 'narrow', label: 'Narrow', description: 'Tight frontage, deeper plot' },
  { value: 'corner', label: 'Corner', description: 'Two street frontages' },
  { value: 'irregular', label: 'Irregular', description: 'Unusual or tapered boundary' },
]

export const SITE_CONSTRAINTS: { value: string; label: string }[] = [
  { value: 'setback', label: 'Building setback / margin' },
  { value: 'flood', label: 'Flood zone or drainage' },
  { value: 'soil', label: 'Poor or expansive soil' },
  { value: 'rock', label: 'Rocky / hard ground' },
  { value: 'sun', label: 'Orientation & sunlight' },
  { value: 'road', label: 'Road or noise exposure' },
  { value: 'utility', label: 'Utility easements' },
  { value: 'height', label: 'Height or planning limits' },
]

export const ARCHITECTURAL_STYLES: Option<string>[] = [
  { value: 'modern-minimal', label: 'Modern minimal', description: 'Clean lines, flat roof, large glass' },
  { value: 'contemporary', label: 'Contemporary', description: 'Soft forms, warm materials' },
  { value: 'traditional', label: 'Traditional', description: 'Classic proportions, pitched roof' },
  { value: 'tropical', label: 'Tropical', description: 'Open plan, deep eaves, ventilation' },
  { value: 'industrial', label: 'Industrial', description: 'Exposed structure, raw finishes' },
  { value: 'mediterranean', label: 'Mediterranean', description: 'Stucco walls, tiled roofs' },
  { value: 'scandinavian', label: 'Scandinavian', description: 'Light wood, white walls, cosy' },
  { value: 'victorian', label: 'Victorian', description: 'Ornate detail, steep roofline' },
]

export const ROOF_TYPES: Option<string>[] = [
  { value: 'flat', label: 'Flat roof', description: 'Minimal, modern, low maintenance' },
  { value: 'pitched-gable', label: 'Pitched gable', description: 'Triangular profile, classic' },
  { value: 'hip', label: 'Hip roof', description: 'Sloped on all four sides' },
  { value: 'shed', label: 'Shed / sloping', description: 'Single-plane slope' },
  { value: 'mansard', label: 'Mansard', description: 'Double-slope, extra headroom' },
  { value: 'dome', label: 'Dome / curved', description: 'Curved profile, distinctive' },
]

export const EXTERIOR_FINISHES: Option<FinishOption>[] = [
  { value: 'render', label: 'Render', description: 'Smooth plaster finish' },
  { value: 'paint', label: 'Painted walls', description: 'Colour-blocked paint' },
  { value: 'brick', label: 'Brick', description: 'Exposed brickwork' },
  { value: 'stone', label: 'Stone', description: 'Natural stone cladding' },
  { value: 'wood', label: 'Timber', description: 'Warm timber cladding' },
  { value: 'glass', label: 'Glass / curtain wall', description: 'Full-height glazing' },
  { value: 'concrete', label: 'Fair-face concrete', description: 'Architectural exposed concrete' },
  { value: 'metal', label: 'Metal cladding', description: 'Standing seam / sheet cladding' },
]

export const INTERIOR_FINISHES: Option<FinishOption>[] = [
  { value: 'render', label: 'Plaster / paint', description: 'Smooth painted walls' },
  { value: 'wood', label: 'Timber flooring', description: 'Wood floor & joinery' },
  { value: 'stone', label: 'Stone & tile', description: 'Tile, stone, terrazzo' },
  { value: 'paint', label: 'Minimal white', description: 'Bright, neutral palette' },
  { value: 'glass', label: 'Glass partitions', description: 'Open, glazed interiors' },
  { value: 'brick', label: 'Exposed brick', description: 'Brick & raw texture' },
  { value: 'tile', label: 'Porcelain tile', description: 'Durable patterned tile' },
  { value: 'marble', label: 'Polished marble', description: 'Glossy natural stone' },
  { value: 'terrazzo', label: 'Terrazzo', description: 'Composite stone with aggregate' },
  { value: 'concrete', label: 'Concrete', description: 'Polished or honed concrete' },
  { value: 'carpet', label: 'Carpet', description: 'Soft textile finish' },
]

export const ROOM_OPTIONS: { value: RoomCategory; label: string }[] = [
  { value: 'living', label: 'Living room' },
  { value: 'dining', label: 'Dining room' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'study', label: 'Study / office' },
  { value: 'laundry', label: 'Laundry room' },
  { value: 'storage', label: 'Store / pantry' },
  { value: 'porch', label: 'Porch / veranda' },
  { value: 'balcony', label: 'Balcony' },
  { value: 'garage', label: 'Garage' },
  { value: 'garden', label: 'Front garden' },
]

export const OUTDOOR_FEATURES: Option<OutdoorFeature>[] = [
  { value: 'parking', label: 'Car park', description: 'Covered or open parking space' },
  { value: 'garage', label: 'Garage', description: 'Enclosed vehicle storage' },
  { value: 'garden', label: 'Garden', description: 'Landscaped lawn and planting' },
  { value: 'pool', label: 'Swimming pool', description: 'Pool and sun deck' },
  { value: 'terrace', label: 'Terrace', description: 'Outdoor seating terrace' },
  { value: 'fence', label: 'Boundary fence', description: 'Perimeter enclosure' },
  { value: 'barbecue', label: 'BBQ / outdoor kitchen', description: 'Entertaining area' },
  { value: 'shed', label: 'Tool shed', description: 'Storage outbuilding' },
]

export const ROOM_FURNITURE: Record<RoomCategory, string[]> = {
  bedroom: ['Bed', 'Wardrobe', 'Bedside table', 'Desk'],
  bathroom: ['Bathtub', 'Shower', 'Washbasin', 'Toilet'],
  kitchen: ['Cabinets', 'Island', 'Sink', 'Fridge'],
  living: ['Sofa', 'TV unit', 'Coffee table', 'Rug'],
  dining: ['Dining table', 'Chairs', 'Sideboard'],
  study: ['Desk', 'Bookshelf', 'Chair'],
  garage: ['Workbench', 'Storage rack'],
  storage: ['Shelving', 'Cabinets'],
  porch: ['Bench', 'Plants', 'Lighting'],
  balcony: ['Lounger', 'Plants', 'Table'],
  laundry: ['Washer', 'Dryer', 'Ironing board'],
  garden: ['Planters', 'Lawn', 'Path'],
  pool: ['Pool shell', 'Sun loungers'],
  circulation: ['Hallway', 'Console'],
  other: [],
}

export const CURRENCIES: { value: string; label: string }[] = [
  { value: 'NGN', label: 'Nigerian Naira (₦)' },
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'AED', label: 'UAE Dirham' },
  { value: 'CAD', label: 'Canadian Dollar' },
]

export function labelFor<T extends string>(options: Option<T>[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value
}
