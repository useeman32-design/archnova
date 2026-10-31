/**
 * Shared domain types for ArchNova (Pixel Studios AI House Design).
 *
 * These types are intentionally framework-agnostic so that the same business
 * logic can be reused later from a React Native / Expo client and from the
 * PHP/MySQL REST API layer.
 */

export type Units = 'ft' | 'm'

export type PlotShape = 'square' | 'rectangle' | 'narrow' | 'irregular' | 'corner'

/** Use-level classification; intentionally separate from legacy house typology. */
export type BuildingCategory =
  | 'residential'
  | 'government'
  | 'institutional'
  | 'commercial'
  | 'industrial'
  | 'agricultural'
  | 'mixed-use'
  | 'other'

export interface ProjectPurpose {
  category: BuildingCategory
  /** Extensible use label (e.g. ministry, hospital, shopping plaza, bungalow). */
  use: string
  description?: string
  capacity?: { value: number; unit: string }
}

export interface SpaceRequirement {
  id: string
  name: string
  category: string
  quantity: number
  minimumArea?: number
  units?: Units
  notes?: string
}

export interface ProjectBrief {
  purpose: ProjectPurpose
  goals?: string
  requiredSpaces: SpaceRequirement[]
  constraints: string[]
  preferences: string[]
  assumptions: string[]
}

export type BoundaryStatus = 'defined' | 'assumed' | 'unknown'
export type BoundarySource = 'user-drawn' | 'survey-import' | 'dimension-derived' | 'ai-recommended' | 'unknown'

export interface SiteVertex extends Vec2 {
  id: string
}

export type SiteEdgeLabelType = 'unknown' | 'front' | 'rear' | 'left' | 'right' | 'road-facing' | 'custom'

/** Explicit user-assigned metadata for one directed segment; dimensions are always derived from its vertices. */
export interface SiteEdgeLabel {
  fromVertexId: string
  toVertexId: string
  type: SiteEdgeLabelType
  customName?: string
}

/** An actual polygon when vertices are present; unknown geometry stays empty, never rectangularized. */
export interface SiteBoundary {
  id: string
  shape: PlotShape | 'polygon'
  vertices: SiteVertex[]
  units: Units
  status: BoundaryStatus
  source: BoundarySource
  area?: number
  /** Optional explicit labels keyed to directed vertex pairs; absent segments remain unknown. */
  edgeLabels?: SiteEdgeLabel[]
  assumptions: string[]
}

export interface SiteModel {
  boundary?: SiteBoundary
  /** Degrees clockwise from drawing +Y; null means the direction is not known. */
  northDirectionDegrees?: number | null
  orientationSource?: 'user-specified' | 'survey-import' | 'assumed' | 'unknown'
  assumptions: string[]
}

export type BuildingType =
  | 'bungalow'
  | 'duplex'
  | 'detached'
  | 'semi-detached'
  | 'flats'
  | 'other'

export type ProjectStatus = 'draft' | 'in-progress' | 'review' | 'completed'

export type RoomCategory =
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'living'
  | 'dining'
  | 'study'
  | 'garage'
  | 'storage'
  | 'porch'
  | 'balcony'
  | 'laundry'
  | 'garden'
  | 'pool'
  | 'circulation'
  | 'other'

export type ElementType = 'wall' | 'door' | 'window'
export type WallKind = 'exterior' | 'interior'
export type DoorStyle = 'single-hinged' | 'double-hinged' | 'sliding' | 'pocket' | 'folding'
export type WindowStyle = 'casement' | 'sliding' | 'bay' | 'fixed'
export type OpeningDirection = 'inward' | 'outward'
export type HingeSide = 'left' | 'right'

/** One shared, dimensioned wall segment in floor-plan coordinates. */
export interface ArchitecturalWall {
  id: string
  start: Vec2
  end: Vec2
  thickness: number
  height: number
  kind: WallKind
  level: number
  roomIds: string[]
}

/** Door or window hosted along a wall; offset is measured from wall.start. */
export interface WallOpening {
  id: string
  wallId: string
  roomId?: string
  type: 'door' | 'window'
  style: DoorStyle | WindowStyle
  offset: number
  width: number
  height: number
  sillHeight: number
  direction?: OpeningDirection
  hingeSide?: HingeSide
  color?: string
}

export type OutdoorFeature =
  | 'parking'
  | 'garage'
  | 'garden'
  | 'pool'
  | 'terrace'
  | 'fence'
  | 'barbecue'
  | 'shed'

export type FinishOption = 'render' | 'paint' | 'brick' | 'stone' | 'wood' | 'glass' | 'tile' | 'marble' | 'concrete' | 'carpet' | 'terrazzo' | 'metal'

export type SiteElementKind = 'palm' | 'conifer' | 'shrub' | 'flower' | 'hedge' | 'car' | 'person' | 'fence' | 'gate' | 'street-light' | 'path' | 'road' | 'tree' | 'bench' | 'outdoor-set' | 'decor'

export interface LandscapeItem extends Vec2 {
  id: string
  /** Stable imported model catalog ID; omitted for legacy/parametric site objects. */
  assetId?: string
  kind?: SiteElementKind | string
  rotation: number
  scale: number
  color: string
  /** Footprint dimensions for linear/site elements, in plot units. */
  width?: number
  length?: number
}

export interface PlacedItem {
  id: string
  /** Stable imported model catalog ID; old projects omit this and keep procedural rendering. */
  assetId?: string
  item: string
  /** Room-relative normalized floor position; center is 0, 0. */
  x: number
  z: number
  rotation: number
  scale: number
  /** Real-world footprint/height in project units; omitted on legacy items. */
  width?: number
  depth?: number
  height?: number
  color: string
}

export interface Vec2 {
  x: number
  y: number
}

/** A rectangle expressed in drawing units relative to the plot origin. */
export interface RoomRect {
  x: number
  y: number
  w: number
  h: number
}

export interface Dimensions {
  width: number
  length: number
  units: Units
}

export interface Budget {
  amount: number
  currency: string
}

export type RoomShape = 'rectangle' | 'L' | 'T' | 'U' | 'custom'

export interface Room {
  id: string
  name: string
  category: RoomCategory
  /** Room dimensions in the room's own units (derived from rect when generated). */
  width: number
  length: number
  units: Units
  rect: RoomRect
  shape?: RoomShape
  /** Normalized outline coordinates (0–1) relative to the room bounds. */
  outline?: Vec2[]
  level: number
  /** Optional furniture swatches for the properties panel. */
  furniture: string[]
  /** Optional per-room interior finish override. */
  finish?: FinishOption
  finishColor?: string
  /** Individually editable placed furniture/appliances. */
  items?: PlacedItem[]
  elements: Element[]
}

export interface Element {
  id: string
  type: ElementType
  label?: string
  /** Nominal opening size in the project plot units. */
  width?: number
  height?: number
  /** Legacy normalized room anchor; retained for older saved projects. */
  position?: Vec2
  /** Optional wall-hosted metadata used by the shared architectural model. */
  wallId?: string
  offset?: number
  sillHeight?: number
  doorStyle?: DoorStyle
  windowStyle?: WindowStyle
  openingDirection?: OpeningDirection
  hingeSide?: HingeSide
  color?: string
}

export interface Floor {
  id: string
  name: string
  level: number
  rooms: Room[]
  /** Shared wall/opening model; absent on older saved projects, which are derived from rooms. */
  walls?: ArchitecturalWall[]
  openings?: WallOpening[]
}

/** One independently identifiable structure within a shared project/site. */
export interface Building {
  id: string
  name: string
  purpose: ProjectPurpose
  role: 'primary' | 'secondary' | 'service' | 'other'
  floors: Floor[]
  footprint?: SiteBoundary
  assumptions: string[]
}

export interface Plot {
  width: number
  length: number
  units: Units
  shape: PlotShape
  constraints: string[]
  location: string
}

export interface DesignPreferences {
  style: string
  roof: string
  exteriorFinish: FinishOption
  interiorFinish: FinishOption
  exteriorColor?: string
  roofColor?: string
  exteriorWallThickness?: number
  interiorWallThickness?: number
  outdoor: OutdoorFeature[]
  notes: string
}

export interface Project {
  id: string
  name: string
  status: ProjectStatus
  /** Legacy residential typology, retained for existing views and saved projects. */
  buildingType: BuildingType
  /** General project use, independent of the legacy house typology. */
  purpose?: ProjectPurpose
  brief?: ProjectBrief
  /** Actual site geometry and orientation; optional for older projects. */
  site?: SiteModel
  /** Multi-building model. `floors` below remains the primary-building compatibility view. */
  buildings?: Building[]
  location: string
  plot: Omit<Plot, 'constraints'>
  bedrooms: number
  bathrooms: number
  style: string
  roof: string
  budget: Budget
  /** Seed used to vary the generated illustration. */
  thumbnailSeed: number
  isSample: boolean
  createdAt: string
  updatedAt: string
  floors: Floor[]
  /** User-placed landscaping, vehicles and site entourage. */
  landscape?: LandscapeItem[]
  preferences: DesignPreferences
}

/** Everything collected by the new-project questionnaire. */
export interface NewProjectForm {
  name: string
  location: string
  plotWidth: number
  plotLength: number
  units: Units
  plotShape: PlotShape
  constraints: string[]
  buildingType: BuildingType
  /** Optional generalized use; omitted legacy drafts are inferred as residential. */
  purpose?: ProjectPurpose
  bedrooms: number
  bathrooms: number
  rooms: string[]
  outdoor: OutdoorFeature[]
  style: string
  roof: string
  exteriorFinish: FinishOption
  interiorFinish: FinishOption
  budget: Budget
  notes: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: number
  /** True while a model response is being produced. */
  pending?: boolean
  /** Legacy marker retained so earlier stored demo chats remain identifiable. */
  simulated?: boolean
}

export interface Suggestion {
  id: string
  title: string
  detail: string
  tone: 'improve' | 'reduce' | 'add' | 'style'
}

export interface FeasibilityWarning {
  id: string
  level: 'info' | 'warning' | 'blocking'
  text: string
}

export interface InterpretationResult {
  summary: string
  suggestions: Suggestion[]
  warnings: FeasibilityWarning[]
  simulated: true
}

export type PlanDocumentType =
  | 'floor-plan'
  | 'elevation'
  | 'section'
  | 'roof'
  | 'report'

export type ExportFormat = 'pdf' | 'png' | 'svg' | 'dwg'

export interface PlanDocument {
  id: string
  type: PlanDocumentType
  label: string
  description: string
  status: 'available' | 'preview' | 'coming-soon'
  formats: ExportFormat[]
}

export interface ExportRequest {
  projectId: string
  documentId: string
  format: ExportFormat
}

export interface ExportResult {
  ok: boolean
  message: string
  simulated: true
}
