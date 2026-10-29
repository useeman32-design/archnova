/**
 * Shared domain types for ArchNova (Pixel Studios AI House Design).
 *
 * These types are intentionally framework-agnostic so that the same business
 * logic can be reused later from a React Native / Expo client and from the
 * PHP/MySQL REST API layer.
 */

export type Units = 'ft' | 'm'

export type PlotShape = 'square' | 'rectangle' | 'narrow' | 'irregular' | 'corner'

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

export type OutdoorFeature =
  | 'parking'
  | 'garage'
  | 'garden'
  | 'pool'
  | 'terrace'
  | 'fence'
  | 'barbecue'
  | 'shed'

export type FinishOption = 'render' | 'paint' | 'brick' | 'stone' | 'wood' | 'glass'

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

export interface Room {
  id: string
  name: string
  category: RoomCategory
  /** Room dimensions in the room's own units (derived from rect when generated). */
  width: number
  length: number
  units: Units
  rect: RoomRect
  level: number
  /** Optional furniture swatches for the properties panel. */
  furniture: string[]
  elements: Element[]
}

export interface Element {
  id: string
  type: ElementType
  label?: string
}

export interface Floor {
  id: string
  name: string
  level: number
  rooms: Room[]
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
  outdoor: OutdoorFeature[]
  notes: string
}

export interface Project {
  id: string
  name: string
  status: ProjectStatus
  buildingType: BuildingType
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
  /** True while a simulated response is being produced. */
  pending?: boolean
  /** Present on assistant turns that are frontend simulations. */
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
