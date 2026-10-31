import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  Box,
  Boxes,
  DraftingCompass,
  Loader2,
  Save,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import type { ArchitecturalWall, Element, FinishOption, LandscapeItem, PlacedItem, PlotShape, Project, Room, RoomShape, SiteBoundary, Units, Vec2, WallOpening } from '@/types'
import { useProjects } from '@/hooks/useProjects'
import { uid } from '@/lib/id'
import { ROOM_FURNITURE } from '@/data/catalog'
import { canonicalFurnitureKey, findFurniturePosition, getFurnitureDimensions, validateFurniture } from '@/lib/furniture'
import { findAvailableOpeningPosition, getFloorArchitecturalModel, validateOpenings } from '@/lib/architecturalModel'
import { applyAssistantPlan as applyAssistantPlanChanges, type ApplyAssistantPlanResult } from '@/lib/applyAssistantPlan'
import { conversionFactor, convertOrnaments, convertPlacedItem, convertRoomUnits, convertWallThicknesses } from '@/lib/unitConversion'
import { pointInPolygon } from '@/lib/siteGeometry'
import type { AssistantPlan } from '@/services/groqAssistant'
import type { PendingPlacement, ToolVariant } from '@/data/toolLibrary'
import { variantFromAsset, ASSET_LOOKUP } from '@/data/toolLibrary'
import { REAL_MODELS } from '@/data/realAssets'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/FormControls'
import { StatusBadge } from '@/components/ui/Badge'
import { PropertiesPanel } from '@/components/editor/PropertiesPanel'
import { ToolPalette } from '@/components/editor/ToolPalette'
import { AssistantPanel } from '@/components/ai-assistant/AssistantPanel'
import { MissingProjectPage } from '@/pages/workspace/MissingProjectPage'

export type ToolId =
  | 'select'
  | 'pan'
  | 'room'
  | 'door'
  | 'window'
  | 'roof'
  | 'interior'
  | 'trees'
  | 'finish'
  | 'measure'

export interface Ornament extends LandscapeItem {}

export interface EditorState {
  rooms: Room[]
  placed: Record<string, PlacedItem[]>
  ornaments: Ornament[]
  wallThicknesses: { exterior: number; interior: number }
}

export interface WorkspaceContext {
  project: Project
  /** Live clone: edited rooms + preview roof/finishes — what the 3D shows. */
  previewProject: Project
  rooms: Room[]
  walls: ArchitecturalWall[]
  openings: WallOpening[]
  placed: Record<string, PlacedItem[]>
  ornaments: Ornament[]
  selectedItemId: string | null
  selectedSiteId: string | null
  selectedSite: Ornament | null
  selectedItem: PlacedItem | null
  selectedItemRoomId: string | null
  selectItem: (id: string | null) => void
  selectSite: (id: string | null) => void
  updatePlacedItem: (roomId: string, itemId: string, patch: Partial<PlacedItem>) => void
  removePlacedItem: (roomId: string, itemId: string) => void
  duplicatePlacedItem: (roomId: string, itemId: string) => void
  updateRoomElement: (roomId: string, elementId: string, patch: Partial<Element>) => void
  removeRoomElement: (roomId: string, elementId: string) => void
  updateOrnament: (id: string, patch: Partial<Ornament>) => void
  removeOrnament: (id: string) => void
  duplicateOrnament: (id: string) => void
  units: Units
  setUnits: (units: Units) => void
  selectedRoomId: string | null
  selectRoom: (id: string | null) => void
  selectedRoom: Room | null
  resizeRoom: (id: string, width: number, length: number) => void
  setRoomShape: (id: string, shape: RoomShape, outline?: Vec2[]) => void
  renameRoom: (id: string, name: string) => void
  toggleFurniture: (roomId: string, item: string) => void
  setRoomFinish: (roomId: string, finish: FinishOption, color?: string) => void
  wallThicknesses: { exterior: number; interior: number }
  setWallThickness: (kind: 'exterior' | 'interior', value: number) => void
  setPlotDimensions: (width: number, length: number) => void
  updateSiteBoundary: (boundary: SiteBoundary, plotShape: PlotShape) => void
  assistantOpen: boolean
  setAssistantOpen: (open: boolean) => void
  propsOpen: boolean
  setPropsOpen: (open: boolean) => void
  propsCollapsed: boolean
  setPropsCollapsed: (collapsed: boolean) => void
  openRoomDetails: (roomId: string) => void
  save: () => void
  applyAssistantPlan: (plan: AssistantPlan, onProgress: (current: number, total: number, label: string) => void) => Promise<ApplyAssistantPlanResult>
  saved: boolean
  showProperties: boolean
  /* Tools */
  tool: ToolId
  setTool: (tool: ToolId) => void
  pending: PendingPlacement | null
  setPending: (pending: PendingPlacement | null) => void
  addRoomAt: (point: Vec2, variant: ToolVariant) => void
  addOpening: (roomId: string, type: 'door' | 'window', label?: string, size?: { width?: number; height?: number }, target?: Vec2) => boolean
  placementWarning: string | null
  clearPlacementWarning: () => void
  placeInterior: (roomId: string, item: string, target?: Vec2, assetId?: string) => void
  addTreeAt: (point: Vec2, kind?: string, size?: { width?: number; length?: number }, assetId?: string) => void
  /* Editing with history */
  beginEdit: () => void
  liveEdit: (fn: (state: EditorState) => EditorState) => void
  endEdit: () => void
  commit: (fn: (state: EditorState) => EditorState) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /* Preview overrides */
  previewRoof: string
  setPreviewRoof: (roof: string) => void
  previewExt: FinishOption
  setPreviewExt: (finish: FinishOption) => void
  previewExtColor: string
  setPreviewExtColor: (color: string) => void
  previewRoofColor: string
  setPreviewRoofColor: (color: string) => void
  previewInt: FinishOption
  setPreviewInt: (finish: FinishOption) => void
}

export function useWorkspace(): WorkspaceContext {
  return useOutletContext<WorkspaceContext>()
}

const VIEW_TABS = [
  { key: 'floor', to: '', label: 'Floor Plan', icon: DraftingCompass },
  { key: '3d', to: '3d', label: '3D View', icon: Box },
  { key: 'assets', to: 'assets', label: 'Assets', icon: Boxes },
] as const

const EMPTY_EDITOR: EditorState = { rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 } }

export function WorkspaceLayout() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { projects, loading, updateProject } = useProjects()
  const project = projects.find((p) => p.id === id)

  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR)
  const [units, setUnitsState] = useState<Units>('ft')
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [propsOpen, setPropsOpen] = useState(false)
  const [propsCollapsed, setPropsCollapsed] = useState(false)
  const [roomDetailsOpen, setRoomDetailsOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tool, setTool] = useState<ToolId>('select')
  const [pending, setPending] = useState<PendingPlacement | null>(null)
  const [placementWarning, setPlacementWarning] = useState<string | null>(null)
  const [previewRoof, setPreviewRoof] = useState('flat')
  const [previewExt, setPreviewExt] = useState<FinishOption>('render')
  const [previewExtColor, setPreviewExtColor] = useState('#e9e4d8')
  const [previewRoofColor, setPreviewRoofColor] = useState('#33415c')
  const [previewInt, setPreviewInt] = useState<FinishOption>('wood')
  /* ---- undo / redo history ---- */
  const past = useRef<EditorState[]>([])
  const future = useRef<EditorState[]>([])
  const editSnapshot = useRef<EditorState | null>(null)
  const [historyTick, setHistoryTick] = useState(0)
  const bumpHistory = () => setHistoryTick((t) => t + 1)

  const commit = useCallback((fn: (state: EditorState) => EditorState) => {
    setEditor((prev) => {
      past.current.push(prev)
      future.current = []
      return fn(prev)
    })
    bumpHistory()
  }, [])

  const setUnits = useCallback((next: Units) => {
    if (!project || next === units) return
    const convertedRooms = editor.rooms.map((room) => convertRoomUnits(room, next))
    const roomUnits = new Map(editor.rooms.map((room) => [room.id, room.units]))
    const convertedPlaced = Object.fromEntries(Object.entries(editor.placed).map(([roomId, items]) => [
      roomId,
      items.map((item) => convertPlacedItem(item, roomUnits.get(roomId) ?? units, next)),
    ]))
    const convertedOrnaments = convertOrnaments(editor.ornaments, units, next)
    const convertedThicknesses = convertWallThicknesses(editor.wallThicknesses, units, next)
    const convertedFloors = project.floors.map((floor) => ({
      ...floor,
      rooms: floor.level === 1 ? convertedRooms : floor.rooms.map((room) => convertRoomUnits(room, next)),
    }))
    const plotFactor = conversionFactor(project.plot.units, next)
    const landscape = convertOrnaments(project.landscape ?? [], project.plot.units, next)
    const preferences = {
      ...project.preferences,
      exteriorWallThickness: (project.preferences.exteriorWallThickness ?? editor.wallThicknesses.exterior) * plotFactor,
      interiorWallThickness: (project.preferences.interiorWallThickness ?? editor.wallThicknesses.interior) * plotFactor,
    }
    setUnitsState(next)
    commit((state) => ({
      ...state,
      rooms: convertedRooms,
      placed: convertedPlaced,
      ornaments: convertedOrnaments,
      wallThicknesses: convertedThicknesses,
    }))
    void updateProject(project.id, {
      plot: { ...project.plot, width: round4(project.plot.width * plotFactor), length: round4(project.plot.length * plotFactor), units: next },
      floors: convertedFloors,
      landscape,
      preferences,
    })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }, [project, units, editor.rooms, editor.placed, editor.ornaments, editor.wallThicknesses, commit, updateProject])

  const beginEdit = useCallback(() => {
    editSnapshot.current = null
    setEditor((prev) => {
      editSnapshot.current = prev
      return prev
    })
  }, [])

  const liveEdit = useCallback((fn: (state: EditorState) => EditorState) => {
    setEditor(fn)
  }, [])

  const endEdit = useCallback(() => {
    if (editSnapshot.current) {
      past.current.push(editSnapshot.current)
      future.current = []
      editSnapshot.current = null
      bumpHistory()
    }
  }, [])

  const undo = useCallback(() => {
    const prev = past.current.pop()
    if (!prev) return
    setEditor((current) => {
      future.current.push(current)
      return prev
    })
    bumpHistory()
  }, [])

  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return
    setEditor((current) => {
      past.current.push(current)
      return next
    })
    bumpHistory()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      ) {
        return
      }
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (key === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  /* ---- load project into editor ---- */
  useEffect(() => {
    if (!project) return
    const loadedRooms = structuredClone(project.floors.find((f) => f.level === 1)?.rooms ?? [])
    setEditor({
      rooms: loadedRooms,
      placed: Object.fromEntries(loadedRooms.map((room) => [room.id, room.items ?? []])),
      ornaments: structuredClone(project.landscape ?? []),
      wallThicknesses: {
        exterior: project.preferences.exteriorWallThickness ?? (project.plot.units === 'ft' ? 0.75 : 0.23),
        interior: project.preferences.interiorWallThickness ?? (project.plot.units === 'ft' ? 0.375 : 0.12),
      },
    })
    setUnitsState(project.plot.units)
    setSelectedRoomId(null)
    setSelectedItemId(null)
    setSelectedSiteId(null)
    setPreviewRoof(project.roof)
    setPreviewExt(project.preferences.exteriorFinish)
    setPreviewExtColor(project.preferences.exteriorColor ?? defaultExteriorColor(project.preferences.exteriorFinish))
    setPreviewRoofColor(project.preferences.roofColor ?? '#33415c')
    setPreviewInt(project.preferences.interiorFinish)
    setTool('select')
    setPending(null)
    setPlacementWarning(null)
    past.current = []
    future.current = []
    bumpHistory()

    /* Deep link: ?add=<assetId> arms a placement from the Assets library. */
    const addId = searchParams.get('add')
    if (addId) {
      const asset = ASSET_LOOKUP[addId]
      const placement = asset ? variantFromAsset(asset) : null
      if (placement) {
        setPending(placement)
        setTool(placement.tool)
      }
    }
    const materialId = searchParams.get('material')
    const material = materialId ? ASSET_LOOKUP[materialId] : undefined
    if (material?.assetKind === 'material') {
      if (material.sourceAssetId === 'brushed_concrete') setPreviewExt('concrete')
      else if (material.sourceAssetId === 'brick_pavement') setPreviewExt('brick')
      else if (material.sourceAssetId === 'american_walnut_veneer') setPreviewInt('wood')
      else if (material.sourceAssetId === 'stone_pavers') setPreviewExt('stone')
    }
  }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const architecturalModel = useMemo(
    () => getFloorArchitecturalModel(editor.rooms, undefined, undefined, editor.wallThicknesses),
    [editor.rooms, editor.wallThicknesses],
  )

  const selectRoom = useCallback((roomId: string | null) => {
    setSelectedRoomId(roomId)
    setSelectedItemId(null)
    setSelectedSiteId(null)
    if (roomId && window.matchMedia('(max-width: 1023px)').matches) {
      setPropsOpen(true)
    }
  }, [])

  const openRoomDetails = useCallback((roomId: string) => {
    setSelectedRoomId(roomId)
    setSelectedItemId(null)
    setSelectedSiteId(null)
    setRoomDetailsOpen(true)
  }, [])

  const selectItem = useCallback((itemId: string | null) => {
    setSelectedItemId(itemId)
    setSelectedSiteId(null)
    if (itemId) {
      const owner = Object.entries(editor.placed).find(([, items]) => items.some((item) => item.id === itemId))?.[0]
      if (owner) setSelectedRoomId(owner)
      if (window.matchMedia('(max-width: 1023px)').matches) setPropsOpen(true)
    }
  }, [editor.placed])

  const selectSite = useCallback((siteId: string | null) => {
    setSelectedSiteId(siteId)
    setSelectedItemId(null)
    setSelectedRoomId(null)
    if (siteId && window.matchMedia('(max-width: 1023px)').matches) setPropsOpen(true)
  }, [])

  /* ---- mutators ---- */
  const addRoomAt = useCallback(
    (point: Vec2, variant: ToolVariant) => {
      commit((state) => {
        const plotW = project?.plot.width ?? 50
        const plotL = project?.plot.length ?? 50
        const w = Math.min(plotW, variant.w ?? 10)
        const h = Math.min(plotL, variant.h ?? 10)
        const x = Math.max(0, Math.min(plotW - w, point.x - w / 2))
        const y = Math.max(0, Math.min(plotL - h, point.y - h / 2))
        const category = variant.id.startsWith('rm_')
          ? (variant.id.replace('rm_', '') as Room['category'])
          : 'other'
        return {
          ...state,
          rooms: [
            ...state.rooms,
            {
              id: uid('room'),
              name: variant.name,
              category: normaliseCategory(category),
              width: w,
              length: h,
              units: project?.plot.units ?? 'ft',
              rect: { x: round1(x), y: round1(y), w, h },
              level: 1,
              furniture: ROOM_FURNITURE[normaliseCategory(category)] ?? [],
              elements: [],
            },
          ],
        }
      })
    },
    [commit, project],
  )

  const addOpening = useCallback(
    (roomId: string, type: 'door' | 'window', label?: string, size?: { width?: number; height?: number }, target?: Vec2): boolean => {
      setPlacementWarning(null)
      const room = editor.rooms.find((candidate) => candidate.id === roomId)
      if (!room) return false
      const defaultWidth = units === 'ft' ? (type === 'door' ? 3 : 4) : (type === 'door' ? 0.9 : 1.2)
      const defaultHeight = units === 'ft' ? (type === 'door' ? 7 : 4) : (type === 'door' ? 2.1 : 1.2)
      const width = size?.width ?? defaultWidth
      const height = size?.height ?? defaultHeight
      const placement = findAvailableOpeningPosition(editor.rooms, roomId, type, width, target)
      if (!placement) {
        setPlacementWarning(`No clear wall segment is wide enough for this ${type}. Select a wider room wall or reduce the opening width.`)
        return false
      }
      const element: Element = {
        id: uid('el'),
        type,
        label: label ?? (type === 'door' ? 'Door' : 'Window'),
        width,
        height,
        wallId: placement.wallId,
        offset: placement.offset,
        position: { x: 0, y: 0 },
        doorStyle: type === 'door' ? 'single-hinged' : undefined,
        windowStyle: type === 'window' ? 'sliding' : undefined,
        openingDirection: 'inward',
        hingeSide: 'left',
        sillHeight: type === 'window' ? (units === 'ft' ? 3 : 0.9) : 0,
        color: type === 'door' ? '#8a6a48' : '#9fd4ee',
      }
      commit((state) => ({
        ...state,
        rooms: state.rooms.map((candidate) => candidate.id === roomId
          ? { ...candidate, elements: [...candidate.elements, element] }
          : candidate),
      }))
      return true
    },
    [commit, editor.rooms, units],
  )

  const placeInterior = useCallback(
    (roomId: string, item: string, target?: Vec2, assetId?: string) => {
      const room = editor.rooms.find((candidate) => candidate.id === roomId)
      if (!room) return
      const canonical = canonicalItem(item)
      const sourceAsset = assetId ? REAL_MODELS.find((asset) => asset.id === assetId) : undefined
      const unitFactor = room.units === 'ft' ? 3.28084 : 1
      const dimensions = sourceAsset?.dimensionsM
        ? { width: sourceAsset.dimensionsM[0] * unitFactor, depth: sourceAsset.dimensionsM[1] * unitFactor, height: sourceAsset.dimensionsM[2] * unitFactor }
        : getFurnitureDimensions(canonical, room.units)
      const existing = editor.placed[roomId] ?? []
      const position = findFurniturePosition(room, existing, dimensions, target)
      if (!position) {
        setPlacementWarning(`No clear floor area is available for ${item}. Move or remove another object, or use a smaller size.`)
        return
      }
      setPlacementWarning(null)
      const placedItem: PlacedItem = {
        id: uid('item'), ...(sourceAsset ? { assetId: sourceAsset.id } : {}), item: canonical, x: position.x, z: position.y, rotation: 0, scale: 1,
        ...dimensions, color: defaultItemColor(canonical),
      }
      const next = [...existing, placedItem]
      commit((state) => ({
        ...state,
        placed: { ...state.placed, [roomId]: next },
        rooms: state.rooms.map((candidate) => candidate.id === roomId ? { ...candidate, items: next } : candidate),
      }))
    },
    [commit, editor.rooms, editor.placed, units],
  )

  const updatePlacedItem = useCallback((roomId: string, itemId: string, patch: Partial<PlacedItem>) => {
    const room = editor.rooms.find((candidate) => candidate.id === roomId)
    if (!room) return
    const current = editor.placed[roomId] ?? []
    const candidateItems = current.map((item) => item.id === itemId ? { ...item, ...patch } : item)
    const itemIssues = validateFurniture(room, candidateItems, architecturalModel.openings, architecturalModel.walls)
    const error = itemIssues.find((issue) => issue.severity === 'error' && issue.itemIds.includes(itemId))
    if (error) {
      setPlacementWarning(error.message)
      return
    }
    setPlacementWarning(null)
    commit((state) => ({
      ...state,
      placed: { ...state.placed, [roomId]: candidateItems },
      rooms: state.rooms.map((candidate) => candidate.id === roomId ? { ...candidate, items: candidateItems } : candidate),
    }))
  }, [commit, editor.rooms, editor.placed, architecturalModel])

  const removePlacedItem = useCallback((roomId: string, itemId: string) => {
    commit((state) => {
      const next = (state.placed[roomId] ?? []).filter((item) => item.id !== itemId)
      return {
        ...state,
        placed: { ...state.placed, [roomId]: next },
        rooms: state.rooms.map((room) => room.id === roomId ? { ...room, items: next } : room),
      }
    })
    setSelectedItemId((selected) => selected === itemId ? null : selected)
  }, [commit])

  const duplicatePlacedItem = useCallback((roomId: string, itemId: string) => {
    const room = editor.rooms.find((candidate) => candidate.id === roomId)
    const original = (editor.placed[roomId] ?? []).find((item) => item.id === itemId)
    if (!room || !original) return
    const dimensions = getFurnitureDimensions(original.item, units)
    const position = findFurniturePosition(room, (editor.placed[roomId] ?? []).filter((item) => item.id !== itemId), {
      width: original.width ?? dimensions.width, depth: original.depth ?? dimensions.depth, height: original.height ?? dimensions.height,
    })
    if (!position) {
      setPlacementWarning(`No clear floor area is available to duplicate ${original.item}.`)
      return
    }
    const duplicate: PlacedItem = { ...original, id: uid('item'), x: position.x, z: position.y }
    commit((state) => {
      const next = [...(state.placed[roomId] ?? []), duplicate]
      return { ...state, placed: { ...state.placed, [roomId]: next }, rooms: state.rooms.map((candidate) => candidate.id === roomId ? { ...candidate, items: next } : candidate) }
    })
    setSelectedItemId(duplicate.id)
    setPlacementWarning(null)
  }, [commit, editor.rooms, editor.placed, units])

  const updateRoomElement = useCallback((roomId: string, elementId: string, patch: Partial<Element>) => {
    const geometryFields: (keyof Element)[] = ['width', 'height', 'offset', 'wallId', 'sillHeight']
    if (geometryFields.some((field) => field in patch)) {
      const candidateRooms = editor.rooms.map((room) => room.id === roomId ? {
        ...room, elements: room.elements.map((element) => element.id === elementId ? { ...element, ...patch } : element),
      } : room)
      const candidateModel = getFloorArchitecturalModel(candidateRooms, undefined, undefined, editor.wallThicknesses)
      const issue = validateOpenings(candidateModel.walls, candidateModel.openings).find((item) => item.openingId === elementId && item.severity === 'error')
      if (issue) {
        setPlacementWarning(issue.message)
        return
      }
    }
    setPlacementWarning(null)
    commit((state) => ({
      ...state,
      rooms: state.rooms.map((room) => room.id === roomId ? {
        ...room, elements: room.elements.map((element) => element.id === elementId ? { ...element, ...patch } : element),
      } : room),
    }))
  }, [commit, editor.rooms, editor.wallThicknesses])

  const removeRoomElement = useCallback((roomId: string, elementId: string) => {
    commit((state) => ({
      ...state,
      rooms: state.rooms.map((room) => room.id === roomId ? { ...room, elements: room.elements.filter((element) => element.id !== elementId) } : room),
    }))
  }, [commit])

  const updateOrnament = useCallback((id: string, patch: Partial<Ornament>) => {
    commit((state) => ({ ...state, ornaments: state.ornaments.map((item) => item.id === id ? { ...item, ...patch } : item) }))
  }, [commit])

  const removeOrnament = useCallback((id: string) => {
    commit((state) => ({ ...state, ornaments: state.ornaments.filter((item) => item.id !== id) }))
    setSelectedSiteId((selected) => selected === id ? null : selected)
  }, [commit])

  const duplicateOrnament = useCallback((id: string) => {
    const source = editor.ornaments.find((item) => item.id === id)
    if (!source || !project) return
    const w = (source.width ?? (units === 'ft' ? 2 : 0.6)) * source.scale
    const l = (source.length ?? (units === 'ft' ? 2 : 0.6)) * source.scale
    const margin = units === 'ft' ? 0.5 : 0.15
    const offsets = [[w + margin, 0], [-(w + margin), 0], [0, l + margin], [0, -(l + margin)], [w + margin, l + margin], [-(w + margin), l + margin]]
    const boundary = project.site?.boundary && project.site.boundary.status !== 'unknown' ? project.site.boundary.vertices : []
    const fits = (x: number, y: number) => {
      const hw = w / 2, hl = l / 2
      const cos = Math.cos(source.rotation), sin = Math.sin(source.rotation)
      const corners = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([dx, dy]) => ({ x: x + dx * cos - dy * sin, y: y + dx * sin + dy * cos }))
      return corners.every((point) => point.x >= 0 && point.y >= 0 && point.x <= project.plot.width && point.y <= project.plot.length)
        && (boundary.length < 3 || corners.every((point) => pointInPolygon(point, boundary)))
    }
    const position = offsets.map(([dx, dy]) => ({ x: source.x + dx, y: source.y + dy })).find((point) => fits(point.x, point.y))
    if (!position) { setPlacementWarning('No remaining in-boundary position is available for this duplicate.'); return }
    const duplicate: Ornament = { ...source, id: uid('site'), x: round1(position.x), y: round1(position.y) }
    commit((state) => ({ ...state, ornaments: [...state.ornaments, duplicate] }))
    setSelectedSiteId(duplicate.id)
    setPlacementWarning(null)
  }, [commit, editor.ornaments, project, units])

  const addTreeAt = useCallback(
    (point: Vec2, kind?: string, size?: { width?: number; length?: number }, assetId?: string) => {
      if (!project) return
      const ft = units === 'ft'
      const defaults: Record<string, { width: number; length: number }> = {
        palm: { width: ft ? 3 : 0.9, length: ft ? 3 : 0.9 }, conifer: { width: ft ? 3 : 0.9, length: ft ? 3 : 0.9 }, tree: { width: ft ? 3 : 0.9, length: ft ? 3 : 0.9 },
        shrub: { width: ft ? 2 : 0.6, length: ft ? 2 : 0.6 }, flower: { width: ft ? 2 : 0.6, length: ft ? 2 : 0.6 }, hedge: { width: ft ? 2 : 0.6, length: ft ? 8 : 2.4 },
        bench: { width: ft ? 14.2 : 4.34, length: ft ? 2.5 : 0.77 }, 'outdoor-set': { width: ft ? 2.55 : 0.776, length: ft ? 6 : 1.831 }, 'street-light': { width: ft ? 2.3 : 0.704, length: ft ? 1.27 : 0.386 }, decor: { width: ft ? 0.5 : 0.15, length: ft ? 0.82 : 0.25 },
        car: { width: ft ? 7 : 2.1, length: ft ? 14 : 4.3 },
        fence: { width: ft ? 0.35 : 0.1, length: ft ? 10 : 3 },
        gate: { width: ft ? 12 : 3.6, length: ft ? 0.5 : 0.15 },
        road: { width: ft ? 16 : 5, length: ft ? 60 : 18 },
        path: { width: ft ? 4 : 1.2, length: ft ? 24 : 7.2 },
        person: { width: ft ? 1 : 0.3, length: ft ? 1 : 0.3 },
      }
      const base = defaults[kind ?? ''] ?? { width: ft ? 2 : 0.6, length: ft ? 2 : 0.6 }
      const sourceAsset = assetId ? REAL_MODELS.find((asset) => asset.id === assetId) : undefined
      const unitFactor = ft ? 3.28084 : 1
      const width = size?.width ?? (sourceAsset?.dimensionsM ? sourceAsset.dimensionsM[0] * unitFactor : base.width)
      const length = size?.length ?? (sourceAsset?.dimensionsM ? sourceAsset.dimensionsM[1] * unitFactor : base.length)
      if (width > project.plot.width || length > project.plot.length) {
        setPlacementWarning(`${kind ?? 'Site object'} is larger than the current plot and could not be placed.`)
        return
      }
      const halfWidth = width / 2, halfLength = length / 2
      const x = Math.max(halfWidth, Math.min(project.plot.width - halfWidth, point.x))
      const y = Math.max(halfLength, Math.min(project.plot.length - halfLength, point.y))
      if (x !== point.x || y !== point.y) setPlacementWarning(`Placed ${kind ?? 'site object'} at the nearest in-bounds location.`)
      else setPlacementWarning(null)
      commit((state) => ({
        ...state,
        ornaments: [...state.ornaments, { id: uid('site'), ...(sourceAsset ? { assetId: sourceAsset.id } : {}), x: round1(x), y: round1(y), kind, rotation: 0, scale: 1, color: kind === 'car' ? '#53677e' : kind === 'person' ? '#455f87' : kind === 'road' ? '#555b62' : kind === 'path' ? '#c9c4b9' : kind === 'fence' || kind === 'gate' ? '#6c6254' : '#4f8a3f', width, length }],
      }))
    },
    [commit, project, setPlacementWarning, units],
  )

  const setRoomShape = useCallback(
    (roomId: string, shape: RoomShape, outline?: Vec2[]) => {
      const presets: Record<Exclude<RoomShape, 'custom'>, Vec2[]> = {
        rectangle: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
        L: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.48 }, { x: 0.55, y: 0.48 }, { x: 0.55, y: 1 }, { x: 0, y: 1 }],
        T: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.38 }, { x: 0.68, y: 0.38 }, { x: 0.68, y: 1 }, { x: 0.32, y: 1 }, { x: 0.32, y: 0.38 }, { x: 0, y: 0.38 }],
        U: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.72, y: 1 }, { x: 0.72, y: 0.34 }, { x: 0.28, y: 0.34 }, { x: 0.28, y: 1 }, { x: 0, y: 1 }],
      }
      commit((state) => ({
        ...state,
        rooms: state.rooms.map((room) => room.id === roomId
          ? { ...room, shape, outline: outline ?? (shape === 'custom' ? room.outline ?? presets.rectangle : presets[shape]) }
          : room),
      }))
    },
    [commit],
  )

  const resizeRoom = useCallback(
    (roomId: string, width: number, length: number) => {
      commit((state) => ({
        ...state,
        rooms: state.rooms.map((room) =>
          room.id === roomId
            ? { ...room, width, length, rect: { ...room.rect, w: width, h: length } }
            : room,
        ),
      }))
    },
    [commit],
  )

  const renameRoom = useCallback(
    (roomId: string, name: string) => {
      commit((state) => ({
        ...state,
        rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, name } : room)),
      }))
    },
    [commit],
  )

  const setRoomFinish = useCallback(
    (roomId: string, finish: FinishOption, color?: string) => {
      commit((state) => ({
        ...state,
        rooms: state.rooms.map((room) => room.id === roomId ? { ...room, finish, finishColor: color ?? room.finishColor } : room),
      }))
    },
    [commit],
  )

  const setWallThickness = useCallback((kind: 'exterior' | 'interior', value: number) => {
    const min = units === 'ft' ? 0.1 : 0.03
    const max = units === 'ft' ? 2 : 0.6
    const clamped = Math.max(min, Math.min(max, value))
    commit((state) => ({ ...state, wallThicknesses: { ...state.wallThicknesses, [kind]: Math.round(clamped * 1000) / 1000 } }))
  }, [commit, units])

  const setPlotDimensions = useCallback((width: number, length: number) => {
    if (!project || !(width > 0) || !(length > 0) || (width === project.plot.width && length === project.plot.length)) return
    const clampRooms = (rooms: Room[]) => rooms.map((room) => {
      const w = Math.min(room.rect.w, width)
      const h = Math.min(room.rect.h, length)
      const x = Math.max(0, Math.min(width - w, room.rect.x))
      const y = Math.max(0, Math.min(length - h, room.rect.y))
      return { ...room, width: w, length: h, rect: { x, y, w, h } }
    })
    const rooms = clampRooms(editor.rooms)
    const ornaments = editor.ornaments.map((item) => {
      const halfWidth = Math.min(width / 2, Math.max(0.25, (item.width ?? 1.5) * item.scale / 2))
      const halfLength = Math.min(length / 2, Math.max(0.25, (item.length ?? 1.5) * item.scale / 2))
      return { ...item, x: Math.max(halfWidth, Math.min(width - halfWidth, item.x)), y: Math.max(halfLength, Math.min(length - halfLength, item.y)) }
    })
    const floors = project.floors.map((floor) => ({ ...floor, rooms: floor.level === 1 ? rooms : clampRooms(floor.rooms) }))
    commit((state) => ({ ...state, rooms, ornaments }))
    void updateProject(project.id, { plot: { ...project.plot, width, length }, floors, landscape: ornaments })
  }, [commit, editor.ornaments, editor.rooms, project, updateProject])

  const updateSiteBoundary = useCallback((boundary: SiteBoundary, plotShape: PlotShape) => {
    if (!project) return
    const previousSite = project.site ?? { northDirectionDegrees: null, orientationSource: 'unknown' as const, assumptions: [] }
    const site = {
      ...previousSite,
      assumptions: boundary.source === 'user-drawn'
        ? previousSite.assumptions.filter((assumption) => !assumption.includes('no polygon has been fabricated'))
        : previousSite.assumptions,
      boundary,
    }
    void updateProject(project.id, { site, plot: { ...project.plot, shape: plotShape } })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }, [project, updateProject])

  const toggleFurniture = useCallback(
    (roomId: string, item: string) => {
      const canonical = canonicalItem(item)
      const current = editor.placed[roomId] ?? []
      const existing = current.find((placedItem) => placedItem.item === canonical)
      const next = existing
        ? current.filter((placedItem) => placedItem.id !== existing.id)
        : (() => {
            const room = editor.rooms.find((candidate) => candidate.id === roomId)
            if (!room) return current
            const dimensions = getFurnitureDimensions(canonical, units)
            const position = findFurniturePosition(room, current, dimensions)
            if (!position) {
              setPlacementWarning(`No clear floor area is available for ${item}. Move or remove another object, or use a smaller size.`)
              return current
            }
            setPlacementWarning(null)
            return [...current, { id: uid('item'), item: canonical, x: position.x, z: position.y, rotation: 0, scale: 1, ...dimensions, color: defaultItemColor(canonical) }]
          })()
      if (next === current) return
      commit((state) => ({
        ...state,
        placed: { ...state.placed, [roomId]: next },
        rooms: state.rooms.map((room) => room.id === roomId ? { ...room, items: next } : room),
      }))
    },
    [commit, editor.placed, editor.rooms, units],
  )

  const save = useCallback(() => {
    if (!project) return
    const floors = project.floors.map((floor) =>
      floor.level === 1 ? { ...floor, rooms: editor.rooms } : floor,
    )
    void updateProject(project.id, { roof: previewRoof, floors, landscape: editor.ornaments, preferences: { ...project.preferences, roof: previewRoof, exteriorFinish: previewExt, interiorFinish: previewInt, exteriorColor: previewExtColor, roofColor: previewRoofColor, exteriorWallThickness: editor.wallThicknesses.exterior, interiorWallThickness: editor.wallThicknesses.interior } })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }, [project, editor.rooms, editor.ornaments, editor.wallThicknesses, previewRoof, previewExt, previewInt, previewExtColor, previewRoofColor, updateProject])

  const applyAssistantPlan = useCallback(async (
    plan: AssistantPlan,
    onProgress: (current: number, total: number, label: string) => void,
  ): Promise<ApplyAssistantPlanResult> => {
    const originalEditor = editor
    if (!project) return { ok: false, rooms: editor.rooms, placed: editor.placed, ornaments: editor.ornaments, wallThicknesses: editor.wallThicknesses, projectPatch: {}, appliedCount: 0, errors: ['The project is not loaded yet.'], warnings: [] }
    const liveProject: Project = {
      ...project,
      roof: previewRoof,
      preferences: {
        ...project.preferences,
        roof: previewRoof,
        exteriorFinish: previewExt,
        interiorFinish: previewInt,
        exteriorColor: previewExtColor,
        roofColor: previewRoofColor,
        exteriorWallThickness: editor.wallThicknesses.exterior,
        interiorWallThickness: editor.wallThicknesses.interior,
      },
    }

    // Validate the complete proposed target state first. Do not show partial or unchecked geometry.
    const result = applyAssistantPlanChanges({ plan, project: liveProject, rooms: editor.rooms, placed: editor.placed, ornaments: editor.ornaments, wallThicknesses: editor.wallThicknesses, units })
    if (!result.ok) return result
    const roomsWithItems = result.rooms.map((room) => ({ ...room, items: result.placed[room.id] ?? room.items ?? [] }))
    const targetById = new Map(roomsWithItems.map((room) => [room.id, room]))
    const startById = new Map(editor.rooms.map((room) => [room.id, room]))
    const targetUnits = result.projectPatch.plot?.units ?? project.plot.units
    const unitConversion = targetUnits !== project.plot.units
    const totalSteps = unitConversion ? 1 : 12

    // Unit conversion is atomic to avoid briefly drawing converted geometry against the old plot scale.
    onProgress(0, totalSteps, unitConversion
      ? 'Geometry passed. Converting the full project to the requested units…'
      : 'Geometry passed. Animating approved changes in 2D and 3D…')
    if (unitConversion) {
      onProgress(1, 1, 'Unit conversion is ready; synchronizing the project scale…')
    } else {
      for (let step = 1; step <= totalSteps; step += 1) {
        const linear = step / totalSteps
        const t = linear * linear * (3 - 2 * linear)
        const framePlaced: Record<string, PlacedItem[]> = {}
        const roomIds = new Set([...Object.keys(editor.placed), ...Object.keys(result.placed)])
        for (const roomId of roomIds) {
          const from = editor.placed[roomId] ?? []
          const to = result.placed[roomId] ?? []
          const fromById = new Map(from.map((item) => [item.id, item]))
          const toById = new Map(to.map((item) => [item.id, item]))
          const frame: PlacedItem[] = []
          for (const target of to) {
            const previous = fromById.get(target.id)
            if (!previous) {
              frame.push(step === totalSteps ? target : { ...target, scale: target.scale * (0.2 + 0.8 * t) })
            } else if (step === totalSteps) frame.push(target)
            else {
              const angleDelta = Math.atan2(Math.sin(target.rotation - previous.rotation), Math.cos(target.rotation - previous.rotation))
              frame.push({
                ...previous,
                x: previous.x + (target.x - previous.x) * t,
                z: previous.z + (target.z - previous.z) * t,
                width: previous.width === undefined || target.width === undefined ? target.width ?? previous.width : previous.width + (target.width - previous.width) * t,
                depth: previous.depth === undefined || target.depth === undefined ? target.depth ?? previous.depth : previous.depth + (target.depth - previous.depth) * t,
                height: previous.height === undefined || target.height === undefined ? target.height ?? previous.height : previous.height + (target.height - previous.height) * t,
                rotation: previous.rotation + angleDelta * t,
                scale: previous.scale + (target.scale - previous.scale) * t,
                ...(t >= 0.95 ? { color: target.color } : {}),
              })
            }
          }
          if (step < totalSteps) for (const previous of from) if (!toById.has(previous.id)) frame.push({ ...previous, scale: previous.scale * (1 - 0.8 * t) })
          framePlaced[roomId] = frame
        }
        const frameRooms = roomsWithItems.map((target) => {
          const start = startById.get(target.id)
          if (!start) {
            const scale = 0.2 + 0.8 * t
            const centerX = target.rect.x + target.rect.w / 2
            const centerY = target.rect.y + target.rect.h / 2
            const w = target.rect.w * scale, h = target.rect.h * scale
            return step === totalSteps ? target : { ...target, width: w, length: h, rect: { x: centerX - w / 2, y: centerY - h / 2, w, h }, items: framePlaced[target.id] ?? [] }
          }
          if (step === totalSteps) return target
          const rect = {
            x: start.rect.x + (target.rect.x - start.rect.x) * t,
            y: start.rect.y + (target.rect.y - start.rect.y) * t,
            w: start.rect.w + (target.rect.w - start.rect.w) * t,
            h: start.rect.h + (target.rect.h - start.rect.h) * t,
          }
          return { ...start, width: rect.w, length: rect.h, rect, items: framePlaced[target.id] ?? [] }
        })
        if (step < totalSteps) for (const start of editor.rooms) if (!targetById.has(start.id)) {
          const scale = 1 - 0.8 * t
          const w = start.rect.w * scale, h = start.rect.h * scale
          frameRooms.push({ ...start, width: w, length: h, rect: { x: start.rect.x + (start.rect.w - w) / 2, y: start.rect.y + (start.rect.h - h) / 2, w, h }, items: framePlaced[start.id] ?? [] })
        }
        const startSites = new Map(editor.ornaments.map((site) => [site.id, site]))
        const targetSites = new Map(result.ornaments.map((site) => [site.id, site]))
        const frameOrnaments = result.ornaments.map((target) => {
          const start = startSites.get(target.id)
          if (!start) return step === totalSteps ? target : { ...target, x: target.x, y: target.y, scale: target.scale * (0.2 + 0.8 * t) }
          if (step === totalSteps) return target
          const angleDelta = Math.atan2(Math.sin(target.rotation - start.rotation), Math.cos(target.rotation - start.rotation))
          return { ...start, x: start.x + (target.x - start.x) * t, y: start.y + (target.y - start.y) * t, rotation: start.rotation + angleDelta * t, scale: start.scale + (target.scale - start.scale) * t, ...(t >= 0.95 ? { color: target.color } : {}) }
        })
        if (step < totalSteps) for (const start of editor.ornaments) if (!targetSites.has(start.id)) frameOrnaments.push({ ...start, scale: start.scale * (1 - 0.8 * t) })
        const frameThicknesses = {
          exterior: editor.wallThicknesses.exterior + (result.wallThicknesses.exterior - editor.wallThicknesses.exterior) * t,
          interior: editor.wallThicknesses.interior + (result.wallThicknesses.interior - editor.wallThicknesses.interior) * t,
        }
        setEditor((current) => ({ ...current, rooms: frameRooms, placed: framePlaced, ornaments: frameOrnaments, wallThicknesses: frameThicknesses }))
        onProgress(step, totalSteps, step === totalSteps ? 'Finishing the synchronized 2D and 3D update…' : `Rendering validated changes · ${Math.round(linear * 100)}%`)
        await new Promise<void>((resolve) => window.setTimeout(resolve, 45))
      }
    }

    const floors = liveProject.floors.map((floor) => floor.level === 1
      ? { ...floor, rooms: roomsWithItems }
      : unitConversion ? { ...floor, rooms: floor.rooms.map((room) => convertRoomUnits(room, targetUnits)) } : floor)
    if (!floors.some((floor) => floor.level === 1)) floors.unshift({ id: uid('floor'), name: 'Ground Floor', level: 1, rooms: roomsWithItems })
    const nextProjectPatch: Partial<Project> = {
      ...result.projectPatch,
      floors,
      landscape: result.ornaments,
      preferences: {
        ...liveProject.preferences,
        ...(result.projectPatch.preferences ?? {}),
        ...(result.projectPatch.style ? { style: result.projectPatch.style } : {}),
        ...(result.projectPatch.roof ? { roof: result.projectPatch.roof } : {}),
        ...(unitConversion ? { exteriorWallThickness: result.wallThicknesses.exterior, interiorWallThickness: result.wallThicknesses.interior } : {}),
      },
    }
    try {
      const updated = await updateProject(project.id, nextProjectPatch)
      if (!updated) {
        setEditor(originalEditor)
        return { ...result, ok: false, errors: ['The plan was prepared, but the project could not be saved. The preview was rolled back. Try again.'] }
      }
      setEditor({ ...originalEditor, rooms: roomsWithItems, placed: result.placed, ornaments: result.ornaments, wallThicknesses: result.wallThicknesses })
      setUnitsState(targetUnits)
      past.current.push(originalEditor)
      future.current = []
      bumpHistory()
      setSelectedRoomId((selected) => roomsWithItems.some((room) => room.id === selected) ? selected : null)
      if (nextProjectPatch.roof) setPreviewRoof(nextProjectPatch.roof)
      const preferences = nextProjectPatch.preferences!
      setPreviewExt(preferences.exteriorFinish)
      setPreviewInt(preferences.interiorFinish)
      setPreviewExtColor(preferences.exteriorColor ?? defaultExteriorColor(preferences.exteriorFinish))
      setPreviewRoofColor(preferences.roofColor ?? '#33415c')
      setSelectedItemId(null)
      setSelectedSiteId(null)
      setPlacementWarning(null)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2200)
      onProgress(totalSteps, totalSteps, 'Applied and saved. The accepted design is synchronized across the workspace.')
      return { ...result, rooms: roomsWithItems }
    } catch {
      setEditor(originalEditor)
      return { ...result, ok: false, errors: ['The project could not be saved. The preview was rolled back; check local storage and try again.'] }
    }
  }, [project, editor, units, previewRoof, previewExt, previewInt, previewExtColor, previewRoofColor, updateProject])

  const selectedRoom = useMemo(
    () => editor.rooms.find((room) => room.id === selectedRoomId) ?? null,
    [editor.rooms, selectedRoomId],
  )

  const selectedItemRoomId = useMemo(
    () => Object.entries(editor.placed).find(([, items]) => items.some((item) => item.id === selectedItemId))?.[0] ?? null,
    [editor.placed, selectedItemId],
  )
  const selectedItem = useMemo(
    () => (selectedItemRoomId ? editor.placed[selectedItemRoomId]?.find((item) => item.id === selectedItemId) ?? null : null),
    [editor.placed, selectedItemId, selectedItemRoomId],
  )
  const selectedItemRoom = useMemo(
    () => editor.rooms.find((room) => room.id === selectedItemRoomId) ?? null,
    [editor.rooms, selectedItemRoomId],
  )
  const selectedSite = useMemo(
    () => editor.ornaments.find((site) => site.id === selectedSiteId) ?? null,
    [editor.ornaments, selectedSiteId],
  )

  const previewProject = useMemo<Project | null>(
    () =>
      project
        ? {
            ...project,
            roof: previewRoof,
            floors: project.floors.map((floor) =>
              floor.level === 1 ? { ...floor, rooms: editor.rooms } : floor,
            ),
            preferences: {
              ...project.preferences,
              exteriorFinish: previewExt,
              exteriorColor: previewExtColor,
              roofColor: previewRoofColor,
              exteriorWallThickness: editor.wallThicknesses.exterior,
              interiorWallThickness: editor.wallThicknesses.interior,
              interiorFinish: previewInt,
            },
          }
        : null,
    [project, previewRoof, previewExt, previewExtColor, previewRoofColor, previewInt, editor.rooms, editor.wallThicknesses],
  )

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    )
  }

  if (!project || !previewProject) {
    return <MissingProjectPage />
  }

  const segment = location.pathname
    .slice(`/workspace/${id}`.length)
    .replace(/^\/+/, '')
    .split('/')[0]
  const showProperties = segment === '' || segment === 'floor-plan'
  const isActiveTab = (key: (typeof VIEW_TABS)[number]['key']) =>
    key === 'floor' ? segment === '' || segment === 'floor-plan' : segment === key

  const context: WorkspaceContext = {
    project,
    previewProject,
    rooms: editor.rooms,
    walls: architecturalModel.walls,
    openings: architecturalModel.openings,
    placed: editor.placed,
    ornaments: editor.ornaments,
    selectedItemId,
    selectedSiteId,
    selectedSite,
    selectedItem,
    selectedItemRoomId,
    selectItem,
    selectSite,
    updatePlacedItem,
    removePlacedItem,
    duplicatePlacedItem,
    updateRoomElement,
    removeRoomElement,
    updateOrnament,
    removeOrnament,
    duplicateOrnament,
    units,
    setUnits,
    selectedRoomId,
    selectRoom,
    selectedRoom,
    resizeRoom,
    setRoomShape,
    renameRoom,
    toggleFurniture,
    setRoomFinish,
    wallThicknesses: editor.wallThicknesses,
    setWallThickness,
    setPlotDimensions,
    updateSiteBoundary,
    assistantOpen,
    setAssistantOpen,
    propsOpen,
    setPropsOpen,
    propsCollapsed,
    setPropsCollapsed,
    openRoomDetails,
    save,
    applyAssistantPlan,
    saved,
    showProperties,
    tool,
    setTool,
    pending,
    setPending,
    addRoomAt,
    addOpening,
    placementWarning,
    clearPlacementWarning: () => setPlacementWarning(null),
    placeInterior,
    addTreeAt,
    beginEdit,
    liveEdit,
    endEdit,
    commit,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    previewRoof,
    setPreviewRoof,
    previewExt,
    setPreviewExt,
    previewExtColor,
    setPreviewExtColor,
    previewRoofColor,
    setPreviewRoofColor,
    previewInt,
    setPreviewInt,
  }
  void historyTick

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
        <button
          onClick={() => navigate('/')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas-soft hover:text-ink-text"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <Logo onDark={false} showWordmark={false} />
        </div>
        <div className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-ink-text">{project.name}</span>
          <span className="hidden sm:inline">
            <StatusBadge status={project.status} />
          </span>
        </div>

        <nav className="hidden items-center gap-1 rounded-lg bg-canvas-soft p-1 md:flex">
          {VIEW_TABS.map((tab) => (
            <NavLink
              key={tab.key}
              to={tab.to}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                isActiveTab(tab.key) ? 'bg-surface text-ink-text shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink-text'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:block">
          <SegmentedControl<'2D' | '3D'>
            size="sm"
            options={[
              { value: '2D', label: '2D' },
              { value: '3D', label: '3D' },
            ]}
            value={segment === '3d' ? '3D' : '2D'}
            onChange={(next) => navigate(next === '3D' ? '3d' : '')}
          />
        </div>

        <Button size="sm" variant="secondary" onClick={save} icon={<Save className="h-3.5 w-3.5" />}>
          <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setAssistantOpen(true)}
          icon={<Sparkles className="h-3.5 w-3.5" />}
        >
          <span className="hidden sm:inline">Assistant</span>
        </Button>
        {showProperties ? (
          <button
            onClick={() => setPropsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted hover:bg-canvas-soft lg:hidden"
            aria-label="Open properties"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        ) : null}
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-2 py-1.5 scroll-thin md:hidden">
        {VIEW_TABS.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.to}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium ${
              isActiveTab(tab.key) ? 'bg-brand-600 text-white' : 'bg-canvas-soft text-muted'
            }`}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <ToolPalette ctx={context} />

        <main className="min-w-0 flex-1">
          <Outlet context={context} />
        </main>

        {((showProperties && Boolean(selectedRoomId)) || Boolean(selectedItemId) || Boolean(selectedSiteId)) ? (
          propsCollapsed ? (
            <button type="button" onClick={() => setPropsCollapsed(false)} className="hidden h-full w-9 shrink-0 items-center justify-center border-l border-line bg-surface text-muted hover:bg-canvas-soft lg:flex" aria-label="Expand properties panel" title="Expand properties">
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <aside className="hidden h-full min-h-0 w-[min(360px,34vw)] min-w-[300px] shrink-0 border-l border-line bg-surface lg:block" aria-label="Room properties panel">
              <PropertiesPanel
                room={selectedRoom ?? selectedItemRoom}
                units={units}
                onClose={() => { selectRoom(null); selectItem(null); selectSite(null) }}
                onCollapse={() => setPropsCollapsed(true)}
                onRename={renameRoom}
                onResize={resizeRoom}
                onSetShape={setRoomShape}
                wallThicknesses={editor.wallThicknesses}
                onSetWallThickness={setWallThickness}
                walls={architecturalModel.walls}
                openings={architecturalModel.openings}
                placed={editor.placed}
                selectedItem={selectedItem}
                selectedItemRoomId={selectedItemRoomId}
                selectedSite={selectedSite}
                onUpdateSite={updateOrnament}
                onRemoveSite={removeOrnament}
                onDuplicateSite={duplicateOrnament}
                onSelectItem={selectItem}
                onUpdatePlacedItem={updatePlacedItem}
                onRemovePlacedItem={removePlacedItem}
                onDuplicatePlacedItem={duplicatePlacedItem}
                onUpdateRoomElement={updateRoomElement}
                onRemoveRoomElement={removeRoomElement}
                onToggleFurniture={toggleFurniture}
                onSetFinish={setRoomFinish}
                onViewIn3D={(roomId) => navigate(`/workspace/${id}/3d?room=${encodeURIComponent(roomId)}`)}
              />
            </aside>
          )
        ) : null}

        {roomDetailsOpen && selectedRoom ? (
          <div className="fixed inset-0 z-[65] flex items-center justify-center bg-ink-950/45 p-4 backdrop-blur-sm" onClick={() => setRoomDetailsOpen(false)}>
            <div role="dialog" aria-modal="true" aria-label={`${selectedRoom.name} room details`} className="flex h-[min(88vh,760px)] min-h-0 w-[min(560px,96vw)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <PropertiesPanel
                room={selectedRoom}
                units={units}
                onClose={() => setRoomDetailsOpen(false)}
                onRename={renameRoom}
                onResize={resizeRoom}
                onSetShape={setRoomShape}
                wallThicknesses={editor.wallThicknesses}
                onSetWallThickness={setWallThickness}
                walls={architecturalModel.walls}
                openings={architecturalModel.openings}
                placed={editor.placed}
                selectedItem={selectedItem}
                selectedItemRoomId={selectedItemRoomId}
                onSelectItem={selectItem}
                onUpdatePlacedItem={updatePlacedItem}
                onRemovePlacedItem={removePlacedItem}
                onDuplicatePlacedItem={duplicatePlacedItem}
                onUpdateRoomElement={updateRoomElement}
                onRemoveRoomElement={removeRoomElement}
                onToggleFurniture={toggleFurniture}
                onSetFinish={setRoomFinish}
                onViewIn3D={(roomId) => navigate(`/workspace/${id}/3d?room=${encodeURIComponent(roomId)}`)}
              />
            </div>
          </div>
        ) : null}

        <AssistantPanel
          key={project.id}
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          project={previewProject}
          rooms={editor.rooms}
          placed={editor.placed}
          ornaments={editor.ornaments}
          wallThicknesses={editor.wallThicknesses}
          walls={architecturalModel.walls}
          units={units}
          onApplyPlan={applyAssistantPlan}
        />
      </div>

      {propsOpen && (showProperties || Boolean(selectedItemId) || Boolean(selectedSiteId)) ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50 animate-fade-in" onClick={() => setPropsOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 h-[72%] overflow-hidden rounded-t-2xl bg-surface shadow-2xl">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" />
            <div className="h-[calc(100%-12px)]">
              <PropertiesPanel
                room={selectedRoom ?? selectedItemRoom}
                units={units}
                onClose={() => setPropsOpen(false)}
                onRename={renameRoom}
                onResize={resizeRoom}
                onSetShape={setRoomShape}
                wallThicknesses={editor.wallThicknesses}
                onSetWallThickness={setWallThickness}
                walls={architecturalModel.walls}
                openings={architecturalModel.openings}
                placed={editor.placed}
                selectedItem={selectedItem}
                selectedItemRoomId={selectedItemRoomId}
                selectedSite={selectedSite}
                onUpdateSite={updateOrnament}
                onRemoveSite={removeOrnament}
                onDuplicateSite={duplicateOrnament}
                onSelectItem={selectItem}
                onUpdatePlacedItem={updatePlacedItem}
                onRemovePlacedItem={removePlacedItem}
                onDuplicatePlacedItem={duplicatePlacedItem}
                onUpdateRoomElement={updateRoomElement}
                onRemoveRoomElement={removeRoomElement}
                onToggleFurniture={toggleFurniture}
                onSetFinish={setRoomFinish}
                onViewIn3D={(roomId) => navigate(`/workspace/${id}/3d?room=${encodeURIComponent(roomId)}`)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function canonicalItem(value: string): string {
  return canonicalFurnitureKey(value)
}


function defaultExteriorColor(finish: FinishOption): string {
  const colors: Record<FinishOption, string> = { render: '#e9e4d8', paint: '#f3efe6', brick: '#b0715a', stone: '#c8c1b2', wood: '#a9805a', glass: '#bcd6e2', tile: '#dad8d0', marble: '#e5e1d8', concrete: '#aeb1b3', carpet: '#8a8790', terrazzo: '#d4d0c7', metal: '#87929a' }
  return colors[finish]
}

function defaultItemColor(item: string): string {
  const key = item.toLowerCase()
  if (key.includes('bed')) return '#e8e2d6'
  if (key.includes('sofa') || key.includes('chair')) return '#7d8ba1'
  if (key.includes('fridge') || key.includes('ac')) return '#c9ced4'
  if (key.includes('bulb') || key.includes('light')) return '#ffe6a2'
  return '#a9805a'
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function normaliseCategory(value: string): Room['category'] {
  const known = [
    'bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'study', 'garage', 'storage',
    'porch', 'balcony', 'laundry', 'garden', 'pool', 'circulation',
  ]
  const mapped: Record<string, string> = {
    master: 'bedroom',
    bed: 'bedroom',
    kids: 'bedroom',
    guest: 'bedroom',
    family: 'living',
    pantry: 'storage',
    ensuite: 'bathroom',
  }
  if (known.includes(value)) return value as Room['category']
  if (mapped[value]) return mapped[value] as Room['category']
  return 'other'
}
