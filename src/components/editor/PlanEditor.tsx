import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Compass, Crosshair, Frame, Info, MapPin, Printer, Tag, X } from 'lucide-react'
import type { BuildingEntranceKind, PlotShape, Room, SiteAccessKind, SiteAccessPoint, SiteBoundary, SiteEdgeLabel, SiteEdgeLabelType, SiteRoute, SiteRouteKind, SiteVertex, Vec2 } from '@/types'
import { useWorkspace } from '@/pages/workspace/WorkspaceLayout'
import { FloorPlanDiagram } from '@/components/floor-plan/FloorPlanDiagram'
import { PlanCanvas, ZoomControls, useZoom } from '@/components/floor-plan/PlanCanvas'
import { SegmentedControl } from '@/components/ui/FormControls'
import { NumberField } from '@/components/ui/Field'
import type { PendingPlacement } from '@/data/toolLibrary'
import { validatePlan } from '@/lib/planValidation'
import { classifyBoundaryShape, findSiteEdgeLabel, polygonArea, resolveSiteRoutePoints, siteEdgeLength, validateSiteBoundary, validateSiteBuildingPlacement, validateSiteParkingBays, validateSiteRoutes } from '@/lib/siteGeometry'
import { conversionFactor } from '@/lib/unitConversion'
import { uid } from '@/lib/id'

function IconToggle({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors ${
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-line bg-surface text-muted hover:bg-canvas-soft'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

const TOOL_HINTS: Record<string, string> = {
  select: 'Select tool: click and drag rooms, separately recorded building blocks, or site items to move them. Pull a room’s blue handle to resize. Ctrl+Z undo · Ctrl+Shift+Z redo.',
  pan: 'Pan: drag the canvas to move around.',
  measure: 'Measure: click two points to read a distance · click again to start over.',
}

/**
 * The 2D design canvas (Floor Plan view): grid, zoom, measure, library
 * placement (click or drag & drop), direct move/resize and selection.
 */
export function PlanEditor() {
  const ctx = useWorkspace()
  const { project, rooms, units, setUnits, wallThicknesses, selectedRoomId, selectedRoom } = ctx
  const [zoom, setZoom] = useZoom()
  const [showLabels, setShowLabels] = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)
  const [showAreas, setShowAreas] = useState(true)
  const [showCompass, setShowCompass] = useState(true)
  const [northDirectionText, setNorthDirectionText] = useState(project.site?.northDirectionDegrees == null ? '' : String(project.site.northDirectionDegrees))
  const [newRouteKind, setNewRouteKind] = useState<SiteRouteKind>('path')
  const [newRouteWidth, setNewRouteWidth] = useState(project.plot.units === 'ft' ? '4' : '1.2')
  const [newRouteAccessId, setNewRouteAccessId] = useState('')
  const [newRouteTargetKey, setNewRouteTargetKey] = useState('')
  const [routeDrawingId, setRouteDrawingId] = useState<string | null>(null)
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null)
  const [selectedInteriorFloor, setSelectedInteriorFloor] = useState(1)
  const [showPlanCheck, setShowPlanCheck] = useState(false)
  const planIssues = useMemo(() => {
    const roomIssues = validatePlan(
      rooms,
      { width: project.plot.width, length: project.plot.length, units },
      ctx.walls,
      ctx.openings,
      ctx.placed,
    )
    const boundary = project.site?.boundary
    const siteIssues = boundary && boundary.status !== 'unknown' && boundary.vertices.length
      ? validateSiteBoundary(boundary.vertices, { width: project.plot.width, length: project.plot.length }).map((issue) => ({ ...issue, code: `site-${issue.code}` }))
      : boundary?.status === 'unknown'
        ? [{ code: 'site-boundary-unknown', severity: 'warning' as const, message: 'Actual plot boundary is unknown; the dashed rectangle is only a dimensions envelope.' }]
        : []
    const siteBuildingIssues = validateSiteBuildingPlacement(project.buildings ?? [], project.site?.boundary, project.plot.units)
    const siteRouteIssues = validateSiteRoutes(project.site?.routes ?? [], project.site, project.buildings ?? [], { width: project.plot.width, length: project.plot.length }, project.plot.units)
    const parkingIssues = validateSiteParkingBays(ctx.ornaments, project.buildings ?? [], project.site?.boundary, { width: project.plot.width, length: project.plot.length }, project.plot.units)
    return [...roomIssues, ...siteIssues, ...siteBuildingIssues, ...siteRouteIssues, ...parkingIssues]
  }, [rooms, project.plot.width, project.plot.length, project.plot.units, units, project.site, project.buildings, ctx.walls, ctx.openings, ctx.placed, ctx.ornaments])
  const planErrorCount = planIssues.filter((issue) => issue.severity === 'error').length
  const entranceBuildings = (project.buildings ?? []).filter((building) => building.footprint && building.footprint.status !== 'unknown' && building.footprint.vertices.length >= 3)
  const routeTargets = entranceBuildings.flatMap((building) => (building.entrances ?? []).map((entrance) => ({ building, entrance, key: JSON.stringify([building.id, entrance.id]) })))
  const interiorBuildings = (project.buildings ?? []).filter((building) => building.role !== 'primary' && building.footprint && building.footprint.vertices.length >= 3)
  const activeInteriorBuilding = interiorBuildings.find((building) => building.id === selectedBuildingId) ?? interiorBuildings[0]
  const activeInteriorFloor = activeInteriorBuilding?.floors.find((floor) => floor.level === selectedInteriorFloor) ?? activeInteriorBuilding?.floors[0]
  const buildingInteriorPlan = activeInteriorBuilding && activeInteriorFloor ? {
    buildingId: activeInteriorBuilding.id, buildingName: activeInteriorBuilding.name,
    floorLevel: activeInteriorFloor.level, floorName: activeInteriorFloor.name, rooms: activeInteriorFloor.rooms,
  } : null
  const resolvedSiteRoutes = useMemo(() => (project.site?.routes ?? []).flatMap((route) => {
    const points = resolveSiteRoutePoints(route, project.site, project.buildings ?? [], project.plot.units)
    if (!points) return []
    return [{ id: route.id, kind: route.kind, width: route.width * conversionFactor(route.units, project.plot.units), points }]
  }), [project.site, project.buildings, project.plot.units])
  const [plotWidth, setPlotWidth] = useState(String(project.plot.width))
  const [plotLength, setPlotLength] = useState(String(project.plot.length))
  const [plotModalOpen, setPlotModalOpen] = useState(false)
  const [boundaryEditMode, setBoundaryEditMode] = useState(false)
  const [boundaryDraft, setBoundaryDraft] = useState<SiteVertex[]>([])
  const [boundaryEdgeLabels, setBoundaryEdgeLabels] = useState<SiteEdgeLabel[]>([])
  const [boundaryAccessPoints, setBoundaryAccessPoints] = useState<SiteAccessPoint[]>([])
  const savedBoundary = project.site?.boundary
  const boundaryIssues = useMemo(() => boundaryDraft.length
    ? validateSiteBoundary(boundaryDraft, { width: project.plot.width, length: project.plot.length })
    : [], [boundaryDraft, project.plot.width, project.plot.length])
  const boundaryErrors = boundaryIssues.filter((issue) => issue.severity === 'error')
  const draftBoundaryArea = boundaryDraft.length >= 3 ? polygonArea(boundaryDraft) : 0
  const missingCustomEdgeName = boundaryDraft.some((vertex, index) => {
    const next = boundaryDraft[(index + 1) % boundaryDraft.length]
    const label = findSiteEdgeLabel(boundaryEdgeLabels, vertex.id, next?.id ?? '')
    return label?.type === 'custom' && !label.customName?.trim()
  })
  useEffect(() => {
    setBoundaryEditMode(false)
    setBoundaryDraft([])
    setRouteDrawingId(null)
    setSelectedBuildingId(null)
    setSelectedInteriorFloor(1)
    setNewRouteAccessId('')
    setNewRouteTargetKey('')
  }, [project.id])
  useEffect(() => {
    setPlotWidth(String(project.plot.width))
    setPlotLength(String(project.plot.length))
  }, [project.plot.width, project.plot.length])
  useEffect(() => {
    setNorthDirectionText(project.site?.northDirectionDegrees == null ? '' : String(project.site.northDirectionDegrees))
  }, [project.id, project.site?.northDirectionDegrees])
  useEffect(() => {
    setNewRouteWidth(newRouteKind === 'road' ? (project.plot.units === 'ft' ? '16' : '4.8') : (project.plot.units === 'ft' ? '4' : '1.2'))
  }, [project.plot.units, newRouteKind])
  const applyNorthDirection = () => {
    const value = northDirectionText.trim()
    if (!value) {
      ctx.setNorthDirection(null)
      return
    }
    const degrees = Number(value)
    if (Number.isFinite(degrees)) ctx.setNorthDirection(degrees)
    else setNorthDirectionText(project.site?.northDirectionDegrees == null ? '' : String(project.site.northDirectionDegrees))
  }
  const applyPlotSize = () => {
    const width = Number(plotWidth)
    const length = Number(plotLength)
    if (width >= 5 && length >= 5) ctx.setPlotDimensions(width, length)
    else {
      setPlotWidth(String(project.plot.width))
      setPlotLength(String(project.plot.length))
    }
  }
  const startBoundaryEdit = () => {
    setRouteDrawingId(null)
    setBoundaryDraft(savedBoundary && savedBoundary.status !== 'unknown' ? savedBoundary.vertices.map((point) => ({ ...point })) : [])
    setBoundaryEdgeLabels(savedBoundary?.edgeLabels?.map((edge) => ({ ...edge })) ?? [])
    setBoundaryAccessPoints(project.site?.accessPoints?.map((point) => ({ ...point })) ?? [])
    setBoundaryEditMode(true)
  }
  const updateBoundaryAccessPoint = (fromVertexId: string, toVertexId: string, type: SiteAccessKind | 'none', percent?: number) => {
    setBoundaryAccessPoints((previous) => {
      const existing = previous.find((point) => point.fromVertexId === fromVertexId && point.toVertexId === toVertexId)
      const next = previous.filter((point) => !(point.fromVertexId === fromVertexId && point.toVertexId === toVertexId))
      if (type === 'none') return next
      const fraction = Math.max(0, Math.min(100, percent ?? (existing?.fraction ?? 0.5) * 100)) / 100
      next.push({ id: existing?.id ?? uid('site-access'), fromVertexId, toVertexId, fraction, type })
      return next
    })
  }
  const updateBuildingEntrance = (buildingId: string, fromVertexId: string, toVertexId: string, type: BuildingEntranceKind | 'none', percent?: number) => {
    const building = project.buildings?.find((item) => item.id === buildingId)
    if (!building) return
    const existing = building.entrances?.find((entrance) => entrance.fromVertexId === fromVertexId && entrance.toVertexId === toVertexId)
    const next = (building.entrances ?? []).filter((entrance) => !(entrance.fromVertexId === fromVertexId && entrance.toVertexId === toVertexId))
    if (type !== 'none') {
      const fraction = Math.max(0, Math.min(100, percent ?? (existing?.fraction ?? 0.5) * 100)) / 100
      next.push({ id: existing?.id ?? uid('building-entrance'), fromVertexId, toVertexId, fraction, type })
    }
    ctx.updateBuildingEntrances(buildingId, next)
  }
  const selectInteriorBuilding = (buildingId: string) => {
    setSelectedBuildingId(buildingId || null)
    const building = interiorBuildings.find((item) => item.id === buildingId)
    setSelectedInteriorFloor(building?.floors[0]?.level ?? 1)
    ctx.selectRoom(null)
  }
  const patchSiteRoute = (routeId: string, patch: Partial<SiteRoute>) => {
    const routes = project.site?.routes ?? []
    ctx.updateSiteRoutes(routes.map((route) => {
      if (route.id !== routeId) return route
      const factor = conversionFactor(route.units, project.plot.units)
      return { ...route, units: project.plot.units, width: route.width * factor, waypoints: route.waypoints.map((point) => ({ x: point.x * factor, y: point.y * factor })), ...patch }
    }))
  }
  const createSiteRoute = () => {
    const accessPoint = project.site?.accessPoints?.find((point) => point.id === newRouteAccessId)
    const target = routeTargets.find((item) => item.key === newRouteTargetKey)
    const width = Number(newRouteWidth)
    if (!accessPoint || !target || !Number.isFinite(width) || width <= 0) return
    const route: SiteRoute = {
      id: uid('site-route'), kind: newRouteKind, fromAccessPointId: accessPoint.id,
      toBuildingId: target.building.id, toEntranceId: target.entrance.id,
      width, units: project.plot.units, waypoints: [],
    }
    ctx.updateSiteRoutes([...(project.site?.routes ?? []), route])
  }
  const updateBoundaryEdgeLabel = (fromVertexId: string, toVertexId: string, type: SiteEdgeLabelType, customName?: string, setback?: number | null) => {
    setBoundaryEdgeLabels((previous) => {
      const existing = previous.find((edge) => edge.fromVertexId === fromVertexId && edge.toVertexId === toVertexId)
      const next = previous.filter((edge) => !(edge.fromVertexId === fromVertexId && edge.toVertexId === toVertexId))
      const resolvedSetback = setback === null ? undefined : setback ?? existing?.setback
      const resolvedName = type === 'custom' ? customName ?? existing?.customName : undefined
      const value: SiteEdgeLabel = {
        fromVertexId,
        toVertexId,
        type,
        ...(resolvedName !== undefined ? { customName: resolvedName } : {}),
        ...(resolvedSetback !== undefined ? { setback: resolvedSetback } : {}),
      }
      if (type !== 'unknown' || (value.setback !== undefined && value.setback > 0)) next.push(value)
      return next
    })
  }
  const addBoundaryPoint = (point: Vec2) => {
    const x = roundSite(Math.max(0, Math.min(project.plot.width, point.x)))
    const y = roundSite(Math.max(0, Math.min(project.plot.length, point.y)))
    setBoundaryDraft((previous) => {
      if (previous.some((vertex) => Math.hypot(vertex.x - x, vertex.y - y) < 0.25)) return previous
      return [...previous, { id: uid('site-vertex'), x, y }]
    })
  }
  const moveBoundaryPoint = (index: number, point: Vec2) => {
    const x = roundSite(Math.max(0, Math.min(project.plot.width, point.x)))
    const y = roundSite(Math.max(0, Math.min(project.plot.length, point.y)))
    setBoundaryDraft((previous) => previous.map((vertex, vertexIndex) => vertexIndex === index ? { ...vertex, x, y } : vertex))
  }
  const finishBoundaryEdit = () => {
    if (boundaryErrors.length > 0 || boundaryDraft.length < 3 || missingCustomEdgeName) return
    const shape = classifyBoundaryShape(boundaryDraft)
    const edgeLabels = boundaryDraft.flatMap((vertex, index) => {
      const next = boundaryDraft[(index + 1) % boundaryDraft.length]
      const edge = findSiteEdgeLabel(boundaryEdgeLabels, vertex.id, next.id)
      if (!edge || (edge.type === 'unknown' && !(edge.setback && edge.setback > 0))) return []
      return [{ ...edge, ...(edge.type === 'custom' ? { customName: edge.customName?.trim() } : {}) }]
    })
    const boundary: SiteBoundary = {
      id: savedBoundary?.id ?? `site:${project.id}:boundary`,
      shape,
      vertices: boundaryDraft,
      units,
      status: 'defined',
      source: 'user-drawn',
      area: draftBoundaryArea,
      edgeLabels,
      assumptions: [],
    }
    const validEdgeKeys = new Set(boundaryDraft.map((vertex, index) => `${vertex.id}:${boundaryDraft[(index + 1) % boundaryDraft.length].id}`))
    const accessPoints = boundaryAccessPoints.filter((point) => validEdgeKeys.has(`${point.fromVertexId}:${point.toVertexId}`)).map((point) => ({ ...point, fraction: Math.max(0, Math.min(1, point.fraction)) }))
    ctx.updateSiteBoundary(boundary, shape as PlotShape, accessPoints)
    setBoundaryEditMode(false)
  }
  const useDimensionRectangle = () => {
    const shape: PlotShape = Math.abs(project.plot.width - project.plot.length) < 1e-6 ? 'square' : 'rectangle'
    const boundary: SiteBoundary = {
      id: savedBoundary?.id ?? `site:${project.id}:boundary`,
      shape,
      vertices: [
        { id: `site:${project.id}:v1`, x: 0, y: 0 },
        { id: `site:${project.id}:v2`, x: project.plot.width, y: 0 },
        { id: `site:${project.id}:v3`, x: project.plot.width, y: project.plot.length },
        { id: `site:${project.id}:v4`, x: 0, y: project.plot.length },
      ],
      units,
      status: 'assumed',
      source: 'dimension-derived',
      area: project.plot.width * project.plot.length,
      edgeLabels: [],
      assumptions: ['Rectangular boundary derived from dimensions; edge labels and north direction remain unspecified unless explicitly set by the user.'],
    }
    ctx.updateSiteBoundary(boundary, shape, [])
    setBoundaryEdgeLabels([])
    setBoundaryAccessPoints([])
    setBoundaryDraft(boundary.vertices)
    setBoundaryEditMode(false)
  }

  const clientToPlan = useRef<((x: number, y: number) => Vec2 | null) | null>(null)

  const measure = ctx.tool === 'measure'

  const roomAt = (point: Vec2): Room | null =>
    [...rooms]
      .reverse()
      .find(
        (room) =>
          point.x >= room.rect.x &&
          point.x <= room.rect.x + room.rect.w &&
          point.y >= room.rect.y &&
          point.y <= room.rect.y + room.rect.h,
      ) ?? null

  const applyPlacement = (placement: PendingPlacement, point: Vec2) => {
    const { tool, variant } = placement
    if (tool === 'room') {
      ctx.addRoomAt(point, variant)
      return
    }
    if (tool === 'trees') {
      ctx.addTreeAt(point, variant.kind, { width: variant.w, length: variant.h }, variant.assetId)
      return
    }
    const room = roomAt(point)
    if (!room) return
    if (tool === 'door') ctx.addOpening(room.id, 'door', variant.label, { width: variant.w, height: variant.h }, point)
    if (tool === 'window') ctx.addOpening(room.id, 'window', variant.label, { width: variant.w, height: variant.h }, point)
    if (tool === 'interior' && variant.item) ctx.placeInterior(room.id, variant.item, point, variant.assetId)
  }

  const handleRoomClick = (room: Room, point?: Vec2) => {
    if (ctx.pending) {
      const { tool, variant } = ctx.pending
      if (tool === 'door') return ctx.addOpening(room.id, 'door', variant.label, { width: variant.w, height: variant.h }, point)
      if (tool === 'window') return ctx.addOpening(room.id, 'window', variant.label, { width: variant.w, height: variant.h }, point)
      if (tool === 'interior' && variant.item) return ctx.placeInterior(room.id, variant.item, point, variant.assetId)
    }
    setSelectedBuildingId(null)
    ctx.selectRoom(room.id === selectedRoomId ? null : room.id)
  }

  const handleCanvasClick = (point: Vec2) => {
    if (routeDrawingId) {
      const route = project.site?.routes?.find((item) => item.id === routeDrawingId)
      if (!route) return
      const toProjectUnits = conversionFactor(route.units, project.plot.units)
      const waypoints = route.waypoints.map((item) => ({ x: item.x * toProjectUnits, y: item.y * toProjectUnits }))
      const waypoint = { x: roundSite(Math.max(0, Math.min(project.plot.width, point.x))), y: roundSite(Math.max(0, Math.min(project.plot.length, point.y))) }
      patchSiteRoute(route.id, { waypoints: [...waypoints, waypoint] })
      return
    }
    if (ctx.pending) applyPlacement(ctx.pending, point)
  }

  const handleDrop = (event: React.DragEvent) => {
    const raw = event.dataTransfer.getData('application/x-archnova')
    if (!raw) return
    event.preventDefault()
    const point = clientToPlan.current?.(event.clientX, event.clientY)
    if (!point) return
    try {
      applyPlacement(JSON.parse(raw) as PendingPlacement, point)
    } catch {
      /* ignore malformed payloads */
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <SegmentedControl<'ft' | 'm'>
          size="sm"
          options={[
            { value: 'ft', label: 'ft' },
            { value: 'm', label: 'm' },
          ]}
          value={units}
          onChange={setUnits}
        />
        <button type="button" onClick={() => setPlotModalOpen(true)} className="flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-medium text-muted hover:bg-canvas-soft" title="Set plot dimensions">
          <Frame className="h-3.5 w-3.5" /> Plot Size
        </button>
        <button
          type="button"
          onClick={() => boundaryEditMode ? setBoundaryEditMode(false) : startBoundaryEdit()}
          aria-pressed={boundaryEditMode}
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium ${boundaryEditMode ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-line bg-surface text-muted hover:bg-canvas-soft'}`}
          title="Draw or edit the actual plot boundary"
        >
          <MapPin className="h-3.5 w-3.5" /> Boundary
        </button>
        <ZoomControls zoom={zoom} setZoom={setZoom} />
        <IconToggle
          active={measure}
          onClick={() => ctx.setTool(measure ? 'select' : 'measure')}
          label="Measure"
          icon={<Crosshair className="h-3.5 w-3.5" />}
        />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <IconToggle active={showLabels} onClick={() => setShowLabels((v) => !v)} label="Labels" icon={<Tag className="h-3.5 w-3.5" />} />
          <IconToggle active={showDimensions} onClick={() => setShowDimensions((v) => !v)} label="Dims" icon={<Frame className="h-3.5 w-3.5" />} />
          <IconToggle active={showAreas} onClick={() => setShowAreas((v) => !v)} label="Areas" icon={<Info className="h-3.5 w-3.5" />} />
          <IconToggle active={showCompass} onClick={() => setShowCompass((v) => !v)} label="Compass" icon={<Compass className="h-3.5 w-3.5" />} />
          <label className="flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[10px] text-muted" title="Set north clockwise from drawing-up; leave blank when unknown">
            <span>North°</span>
            <input aria-label="North direction clockwise from drawing-up in degrees" type="number" min="0" max="359.9" step="1" value={northDirectionText} placeholder="?" onChange={(event) => setNorthDirectionText(event.target.value)} onBlur={applyNorthDirection} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} className="w-12 bg-transparent text-[11px] text-ink-text outline-none placeholder:text-faint" />
          </label>
          <button type="button" onClick={() => setShowPlanCheck((value) => !value)} aria-expanded={showPlanCheck} className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium ${planErrorCount ? 'border-red-200 bg-red-50 text-red-700' : 'border-line bg-surface text-muted hover:bg-canvas-soft'}`}>
            <AlertTriangle className="h-3.5 w-3.5" /> Check plan <span className="rounded-full bg-white/70 px-1.5 text-[10px]">{planIssues.length}</span>
          </button>
          <button type="button" onClick={() => window.print()} title="Print this floor plan or save it as PDF" className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12px] font-medium text-muted hover:bg-canvas-soft">
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </button>
        </div>
      </div>

      {boundaryEditMode ? (
        <section aria-label="Plot boundary editor" className="shrink-0 border-b border-teal-200 bg-teal-50/80 px-3 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h3 className="text-[12.5px] font-semibold text-teal-950">Edit actual plot boundary</h3>
              <p className="mt-1 text-[11.5px] leading-relaxed text-teal-900">
                Tap inside the plot envelope to add points; drag the handles to adjust them. The outline is not treated as a real boundary until you save at least three valid vertices. Label edges, set optional conceptual building clearances, and designate vehicle, pedestrian, or service access points.
              </p>
              <p className="mt-1 text-[11px] font-medium text-teal-900" aria-live="polite">
                {boundaryDraft.length} vertices · area {boundaryDraft.length >= 3 ? formatSiteArea(draftBoundaryArea, units) : '—'}
              </p>
              {boundaryDraft.length >= 2 ? (
                <div className="mt-2 space-y-2">
                  {boundaryDraft.map((vertex, index) => {
                    const next = boundaryDraft[(index + 1) % boundaryDraft.length]
                    const edgeLabel = findSiteEdgeLabel(boundaryEdgeLabels, vertex.id, next.id)
                    const edgeType = edgeLabel?.type ?? 'unknown'
                    const accessPoint = boundaryAccessPoints.find((point) => point.fromVertexId === vertex.id && point.toVertexId === next.id)
                    return <div key={`${vertex.id}-${next.id}`} className="flex flex-wrap items-center gap-2 text-[10.5px] text-teal-950">
                      <span className="min-w-28 font-medium">Edge {index + 1}: {formatSiteLength(siteEdgeLength(vertex, next))} {units}</span>
                      <label className="flex items-center gap-1.5">
                        <span className="sr-only">Label plot edge {index + 1}</span>
                        <select aria-label={`Label plot edge ${index + 1}`} value={edgeType} onChange={(event) => updateBoundaryEdgeLabel(vertex.id, next.id, event.target.value as SiteEdgeLabelType, edgeLabel?.customName)} className="rounded-md border border-teal-300 bg-white px-2 py-1 text-[10.5px]">
                          <option value="unknown">Unknown</option><option value="front">Front</option><option value="rear">Rear</option><option value="left">Left</option><option value="right">Right</option><option value="road-facing">Road-facing</option><option value="custom">Custom name</option>
                        </select>
                      </label>
                      {edgeType === 'custom' ? <input aria-label={`Custom name for plot edge ${index + 1}`} value={edgeLabel?.customName ?? ''} onChange={(event) => updateBoundaryEdgeLabel(vertex.id, next.id, 'custom', event.target.value)} placeholder="Enter edge name" className="w-36 rounded-md border border-teal-300 bg-white px-2 py-1 text-[10.5px]" /> : null}
                      <label className="flex items-center gap-1.5">
                        <span>Setback</span>
                        <input aria-label={`Building setback for plot edge ${index + 1} in ${units}`} type="number" min="0" max="1000" step="0.5" value={edgeLabel?.setback ?? ''} onChange={(event) => { const value = event.target.value; const parsed = Number(value); updateBoundaryEdgeLabel(vertex.id, next.id, edgeType, edgeLabel?.customName, value === '' || !Number.isFinite(parsed) ? null : Math.min(1000, Math.max(0, parsed))) }} placeholder="0" className="w-16 rounded-md border border-teal-300 bg-white px-2 py-1 text-[10.5px]" />
                        <span>{units}</span>
                      </label>
                      <label className="flex items-center gap-1.5">
                        <span>Access</span>
                        <select aria-label={`Access type at plot edge ${index + 1}`} value={accessPoint?.type ?? 'none'} onChange={(event) => updateBoundaryAccessPoint(vertex.id, next.id, event.target.value as SiteAccessKind | 'none')} className="rounded-md border border-teal-300 bg-white px-2 py-1 text-[10.5px]">
                          <option value="none">None</option><option value="vehicle">Vehicle</option><option value="pedestrian">Pedestrian</option><option value="service">Service</option>
                        </select>
                      </label>
                      {accessPoint ? <label className="flex items-center gap-1.5"><span>Position %</span><input aria-label={`Position of ${accessPoint.type} access on plot edge ${index + 1}`} type="number" min="0" max="100" step="1" value={Math.round(accessPoint.fraction * 100)} onChange={(event) => updateBoundaryAccessPoint(vertex.id, next.id, accessPoint.type, Number(event.target.value))} className="w-14 rounded-md border border-teal-300 bg-white px-2 py-1 text-[10.5px]" /></label> : null}
                    </div>
                  })}
                  <p className="text-[10px] text-teal-800">Lengths are derived from the vertices; labels and access points are user-assigned. Access markers do not infer road geometry, legal access, or approval.</p>
                </div>
              ) : null}
              {boundaryErrors.length || missingCustomEdgeName ? (
                <ul role="alert" className="mt-2 space-y-1 text-[11px] font-medium text-red-700">
                  {boundaryErrors.map((issue) => <li key={`${issue.code}-${issue.edgeIndices?.join('-') ?? issue.vertexIndex ?? ''}`}>{issue.message}</li>)}
                  {missingCustomEdgeName ? <li>Enter a custom name or choose another label for each custom-labeled edge.</li> : null}
                </ul>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={() => setBoundaryDraft([])} className="rounded-lg border border-teal-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-teal-900">Clear points</button>
              <button type="button" onClick={useDimensionRectangle} className="rounded-lg border border-teal-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-teal-900">Use dimension rectangle</button>
              <button type="button" onClick={() => setBoundaryEditMode(false)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-medium text-muted">Cancel</button>
              <button type="button" onClick={finishBoundaryEdit} disabled={boundaryDraft.length < 3 || boundaryErrors.length > 0 || missingCustomEdgeName} className="rounded-lg bg-teal-700 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Save boundary</button>
            </div>
          </div>
        </section>
      ) : null}

      <details className="shrink-0 border-b border-line bg-surface px-4 py-2">
        <summary className="cursor-pointer text-[12px] font-semibold text-ink-text">Building entrances ({entranceBuildings.reduce((count, building) => count + (building.entrances?.length ?? 0), 0)})</summary>
        <p className="mt-1 text-[10.5px] text-muted">Designate an entrance on an explicitly recorded building-footprint edge. These are conceptual markers, not code-compliance or door-construction checks.</p>
        {entranceBuildings.length ? <div className="mt-2 space-y-2">
          {entranceBuildings.map((building) => <div key={building.id} className="rounded-lg border border-line-soft bg-canvas-soft/50 p-2">
            <div className="mb-1 text-[11px] font-semibold text-ink-text">{building.name} · {building.role}</div>
            <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
              {building.footprint!.vertices.map((vertex, index) => {
                const next = building.footprint!.vertices[(index + 1) % building.footprint!.vertices.length]
                const entrance = building.entrances?.find((item) => item.fromVertexId === vertex.id && item.toVertexId === next.id)
                return <div key={`${vertex.id}-${next.id}`} className="flex items-center gap-1.5 text-[10px] text-muted">
                  <span className="w-16 shrink-0">Edge {index + 1} · {formatSiteLength(siteEdgeLength(vertex, next))} {building.footprint!.units}</span>
                  <select aria-label={`${building.name} entrance type on edge ${index + 1}`} value={entrance?.type ?? 'none'} onChange={(event) => updateBuildingEntrance(building.id, vertex.id, next.id, event.target.value as BuildingEntranceKind | 'none')} className="min-w-0 rounded-md border border-line bg-white px-1.5 py-1 text-[10px]">
                    <option value="none">None</option><option value="main">Main</option><option value="pedestrian">Pedestrian</option><option value="service">Service</option>
                  </select>
                  {entrance ? <label className="flex items-center gap-1"><span className="sr-only">Position along edge percent</span><input aria-label={`${building.name} entrance position on edge ${index + 1} percent`} type="number" min="0" max="100" step="1" value={Math.round(entrance.fraction * 100)} onChange={(event) => updateBuildingEntrance(building.id, vertex.id, next.id, entrance.type, Number(event.target.value))} className="w-12 rounded-md border border-line bg-white px-1.5 py-1 text-[10px]" /><span>%</span></label> : null}
                </div>
              })}
            </div>
          </div>)}
        </div> : <p className="mt-2 text-[10.5px] text-muted">No explicit building footprints are available to place an entrance marker. Existing room doors remain defined by the architectural wall/opening model; no building outline is fabricated.</p>}
      </details>

      <details className="shrink-0 border-b border-line bg-surface px-4 py-2">
        <summary className="cursor-pointer text-[12px] font-semibold text-ink-text">Block interiors ({interiorBuildings.reduce((count, building) => count + building.floors.reduce((floorCount, floor) => floorCount + floor.rooms.length, 0), 0)} rooms)</summary>
        <p className="mt-1 text-[10.5px] text-muted">Secondary blocks can store rooms, openings, and catalog furniture on each recorded floor. Choose a block and floor to preview its room layout on the 2D site plan; the 3D massing view includes its floors, walls, and openings. These remain conceptual designs.</p>
        {interiorBuildings.length ? <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-[10px] text-muted"><span>Building block</span><select aria-label="Interior building block" value={activeInteriorBuilding?.id ?? ''} onChange={(event) => selectInteriorBuilding(event.target.value)} className="min-w-36 rounded-md border border-line bg-white px-2 py-1.5 text-[11px]">{interiorBuildings.map((building) => <option key={building.id} value={building.id}>{building.name} · {building.role}</option>)}</select></label>
          <label className="grid gap-1 text-[10px] text-muted"><span>Floor</span><select aria-label="Interior building floor" value={activeInteriorFloor?.level ?? ''} onChange={(event) => setSelectedInteriorFloor(Number(event.target.value))} className="min-w-28 rounded-md border border-line bg-white px-2 py-1.5 text-[11px]">{activeInteriorBuilding?.floors.map((floor) => <option key={floor.id} value={floor.level}>{floor.name}</option>)}</select></label>
        </div> : <p className="mt-2 text-[10.5px] text-muted">Add a separately recorded building block first. The primary building continues to use the existing room editor.</p>}
        {activeInteriorBuilding && activeInteriorFloor ? activeInteriorFloor.rooms.length ? <ul className="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">{activeInteriorFloor.rooms.map((room) => <li key={room.id} className="rounded-md border border-line-soft bg-canvas-soft/50 px-2 py-1 text-[10.5px] text-ink-text"><span className="font-medium">{room.name}</span> · {room.category}<span className="block text-[9.5px] text-muted">{room.rect.w} × {room.rect.h} {room.units} · {(room.elements ?? []).filter((element) => element.type === 'door' || element.type === 'window').length} openings · {(room.items ?? []).length} items</span></li>)}</ul> : <p className="mt-2 text-[10.5px] text-muted">No rooms on this floor yet. Ask the assistant to add rooms to “{activeInteriorBuilding.name}”, naming the floor, then review and apply the proposal.</p> : null}
      </details>

      <details className="shrink-0 border-b border-line bg-surface px-4 py-2">
        <summary className="cursor-pointer text-[12px] font-semibold text-ink-text">Site circulation routes ({project.site?.routes?.length ?? 0})</summary>
        <p className="mt-1 text-[10.5px] text-muted">Create a conceptual connection between a chosen plot access point and an explicitly marked entrance. The initial segment is direct; add user-drawn bends on the plan. This is not survey geometry, a legal-access check, or code compliance.</p>
        {project.site?.accessPoints?.length && routeTargets.length ? <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-line-soft bg-canvas-soft/50 p-2">
          <label className="grid gap-1 text-[10px] text-muted"><span>From access</span><select aria-label="Route starting access point" value={newRouteAccessId} onChange={(event) => setNewRouteAccessId(event.target.value)} className="rounded-md border border-line bg-white px-2 py-1.5 text-[11px]"><option value="">Choose access point</option>{project.site.accessPoints.map((point) => { const edgeIndex = project.site?.boundary?.vertices.findIndex((vertex) => vertex.id === point.fromVertexId) ?? -1; return <option key={point.id} value={point.id}>{point.type} · {edgeIndex >= 0 ? `edge ${edgeIndex + 1}` : point.id} · {Math.round(point.fraction * 100)}%</option> })}</select></label>
          <label className="grid gap-1 text-[10px] text-muted"><span>To entrance</span><select aria-label="Route target building entrance" value={newRouteTargetKey} onChange={(event) => setNewRouteTargetKey(event.target.value)} className="rounded-md border border-line bg-white px-2 py-1.5 text-[11px]"><option value="">Choose building entrance</option>{routeTargets.map((item) => { const edgeIndex = item.building.footprint!.vertices.findIndex((vertex) => vertex.id === item.entrance.fromVertexId); return <option key={item.key} value={item.key}>{item.building.name} · {item.entrance.type} · edge {edgeIndex + 1} · {Math.round(item.entrance.fraction * 100)}%</option> })}</select></label>
          <label className="grid gap-1 text-[10px] text-muted"><span>Route type</span><select aria-label="New route type" value={newRouteKind} onChange={(event) => { const kind = event.target.value as SiteRouteKind; setNewRouteKind(kind); setNewRouteWidth(kind === 'road' ? (project.plot.units === 'ft' ? '16' : '4.8') : (project.plot.units === 'ft' ? '4' : '1.2')) }} className="rounded-md border border-line bg-white px-2 py-1.5 text-[11px]"><option value="path">Pedestrian path</option><option value="road">Vehicle road</option></select></label>
          <label className="grid gap-1 text-[10px] text-muted"><span>Width ({project.plot.units})</span><input aria-label="New route width" type="number" min="0.1" step="0.1" value={newRouteWidth} onChange={(event) => setNewRouteWidth(event.target.value)} className="w-20 rounded-md border border-line bg-white px-2 py-1.5 text-[11px]" /></label>
          <button type="button" disabled={!newRouteAccessId || !newRouteTargetKey || !Number.isFinite(Number(newRouteWidth)) || Number(newRouteWidth) <= 0} onClick={createSiteRoute} className="rounded-md bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">Connect</button>
        </div> : <p className="mt-2 text-[10.5px] text-muted">Add a boundary access point and mark an entrance on a recorded building footprint before connecting a route.</p>}
        {project.site?.routes?.length ? <div className="mt-2 space-y-1.5">{project.site.routes.map((route) => {
          const width = route.width * conversionFactor(route.units, project.plot.units)
          const target = (project.buildings ?? []).find((building) => building.id === route.toBuildingId)
          const drawing = routeDrawingId === route.id
          return <div key={route.id} className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-[10.5px] ${drawing ? 'border-brand-300 bg-brand-50' : 'border-line-soft bg-white'}`}>
            <span className="min-w-32 font-medium text-ink-text">{route.kind === 'road' ? 'Vehicle road' : 'Pedestrian path'} → {target?.name ?? 'missing building'} · {width.toFixed(1)} {project.plot.units}</span>
            <label className="flex items-center gap-1 text-muted"><span>Width</span><input aria-label={`${route.kind} route width`} type="number" min="0.1" step="0.1" value={width} onChange={(event) => patchSiteRoute(route.id, { width: Number(event.target.value) })} className="w-16 rounded border border-line px-1.5 py-1" /><span>{project.plot.units}</span></label>
            <button type="button" aria-pressed={drawing} onClick={() => setRouteDrawingId(drawing ? null : route.id)} className="rounded border border-line px-2 py-1 text-muted hover:bg-canvas-soft">{drawing ? 'Stop adding bends' : 'Add bends on plan'}</button>
            <button type="button" disabled={!route.waypoints.length} onClick={() => { const factor = conversionFactor(route.units, project.plot.units); patchSiteRoute(route.id, { waypoints: route.waypoints.slice(0, -1).map((point) => ({ x: point.x * factor, y: point.y * factor })) }) }} className="rounded border border-line px-2 py-1 text-muted disabled:opacity-40">Undo bend</button>
            <button type="button" disabled={!route.waypoints.length} onClick={() => patchSiteRoute(route.id, { waypoints: [] })} className="rounded border border-line px-2 py-1 text-muted disabled:opacity-40">Clear bends</button>
            <button type="button" onClick={() => { ctx.updateSiteRoutes(project.site!.routes!.filter((item) => item.id !== route.id)); if (drawing) setRouteDrawingId(null) }} className="rounded border border-red-200 px-2 py-1 text-red-700">Remove</button>
            {drawing ? <span className="w-full text-brand-700">Click inside the plan to add route bends. Finish by clicking “Stop adding bends”.</span> : null}
          </div>
        })}</div> : null}
      </details>

      {showPlanCheck ? (
        <section aria-label="Plan checks" className="max-h-44 shrink-0 overflow-y-auto border-b border-line bg-white px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold text-ink-text">Plan checks</h3>
            <span className="text-[10px] text-muted">Geometry checks only — not building-code or permit compliance.</span>
          </div>
          {planIssues.length ? (
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {planIssues.map((issue, index) => <li key={`${issue.code}-${'roomId' in issue ? issue.roomId ?? '' : ''}-${index}`} className={`rounded px-2 py-1 text-[11px] ${issue.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{issue.severity === 'error' ? 'Error: ' : 'Check: '}{issue.message}</li>)}
            </ul>
          ) : <p className="mt-2 text-[11px] font-medium text-emerald-700">No geometry conflicts detected in this plan.</p>}
        </section>
      ) : null}

      <div
        className="min-h-0 flex-1"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('application/x-archnova')) {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }
        }}
        onDrop={handleDrop}
      >
        <PlanCanvas zoom={zoom} setZoom={setZoom} pan={ctx.tool === 'pan'} className="h-full">
          <FloorPlanDiagram
            rooms={rooms}
            units={units}
            wallThicknesses={wallThicknesses}
            plot={{ width: project.plot.width, length: project.plot.length }}
            siteBoundary={project.site?.boundary}
            siteAccessPoints={boundaryEditMode ? boundaryAccessPoints : project.site?.accessPoints}
            siteRoutes={resolvedSiteRoutes}
            buildingFootprints={(project.buildings ?? []).filter((building) => building.role !== 'primary' && Boolean(building.footprint)).map((building) => ({ id: building.id, name: building.name, role: building.role, footprint: building.footprint!, entrances: building.entrances ?? [] }))}
            buildingInterior={buildingInteriorPlan}
            selectedBuildingId={selectedBuildingId}
            onSelectBuilding={(id) => { if (id) selectInteriorBuilding(id); else setSelectedBuildingId(null) }}
            onMoveBuilding={ctx.moveBuildingFootprint}
            boundaryEditMode={boundaryEditMode}
            boundaryDraft={boundaryDraft}
            boundaryDraftEdgeLabels={boundaryEdgeLabels}
            onBoundaryAddPoint={addBoundaryPoint}
            onBoundaryMovePoint={moveBoundaryPoint}
            showLabels={showLabels}
            showDimensions={showDimensions}
            showAreas={showAreas}
            showCompass={showCompass}
            northDirectionDegrees={project.site?.northDirectionDegrees}
            showBoundary
            measure={measure}
            trees={ctx.ornaments}
            selectedTreeId={ctx.selectedSiteId}
            onSelectTree={ctx.selectSite}
            onMoveTree={(id, x, y) => ctx.liveEdit((state) => ({ ...state, ornaments: state.ornaments.map((tree) => tree.id === id ? { ...tree, x, y } : tree) }))}
            onResizeTree={(id, scale) => ctx.liveEdit((state) => ({ ...state, ornaments: state.ornaments.map((tree) => tree.id === id ? { ...tree, scale } : tree) }))}
            onCanvasClick={handleCanvasClick}
            selectedId={selectedRoomId}
            onSelectRoom={handleRoomClick}
            onDoubleClickRoom={(room) => ctx.openRoomDetails(room.id)}
            placed={ctx.placed}
            selectedItemId={ctx.selectedItemId}
            onSelectItem={ctx.selectItem}
            onMoveItem={(roomId, itemId, x, z) => ctx.liveEdit((state) => {
              const items = (state.placed[roomId] ?? []).map((item) => item.id === itemId ? { ...item, x, z } : item)
              return { ...state, placed: { ...state.placed, [roomId]: items }, rooms: state.rooms.map((room) => room.id === roomId ? { ...room, items } : room) }
            })}
            dragEnabled={ctx.tool === 'select'}
            onEditBegin={ctx.beginEdit}
            onEditEnd={ctx.endEdit}
            onDragLive={(id, x, y) =>
              ctx.liveEdit((state) => ({
                ...state,
                rooms: state.rooms.map((room) =>
                  room.id === id ? { ...room, rect: { ...room.rect, x, y } } : room,
                ),
              }))
            }
            onResizeLive={(id, w, h) =>
              ctx.liveEdit((state) => ({
                ...state,
                rooms: state.rooms.map((room) =>
                  room.id === id
                    ? { ...room, width: w, length: h, rect: { ...room.rect, w, h } }
                    : room,
                ),
              }))
            }
            registerClientToPlan={(fn) => {
              clientToPlan.current = fn
            }}
            className="print-plan-svg min-h-0 min-w-0 drop-shadow-sm"
          />
        </PlanCanvas>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3 py-2">
        <p className="text-[11.5px] text-muted">
          {ctx.placementWarning ? (
            <span role="alert" className="font-medium text-red-700">{ctx.placementWarning} <button className="underline underline-offset-2" onClick={ctx.clearPlacementWarning}>Dismiss</button></span>
          ) : ctx.pending ? (
            <span className="font-medium text-brand-700">
              Placing: {ctx.pending.variant.name} — click the plan
              {ctx.pending.tool === 'door' || ctx.pending.tool === 'window' || ctx.pending.tool === 'interior'
                ? ' on a room'
                : ''}
              , or drag a library tile.{' '}
              <button className="underline underline-offset-2" onClick={() => ctx.setPending(null)}>
                Cancel
              </button>
            </span>
          ) : (
            TOOL_HINTS[ctx.tool] ?? TOOL_HINTS.select
          )}
        </p>
        <p className="text-[11.5px] font-medium text-ink-text">
          {selectedRoom
            ? `${selectedRoom.name} · ${selectedRoom.width} × ${selectedRoom.length} ${units} · double-click for details`
            : `${rooms.length} spaces · ${project.name}`}
        </p>
      </div>
      {plotModalOpen ? (() => {
        const liveWidth = Math.max(5, Number(plotWidth) || project.plot.width)
        const liveLength = Math.max(5, Number(plotLength) || project.plot.length)
        const scale = Math.min(180 / liveWidth, 125 / liveLength)
        const previewWidth = liveWidth * scale
        const previewLength = liveLength * scale
        return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/45 p-4 backdrop-blur-sm" onClick={() => setPlotModalOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="plot-size-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div><h2 id="plot-size-title" className="text-[15px] font-semibold text-ink-text">Plot Size</h2><p className="mt-0.5 text-[11px] text-muted">Set the overall plot width and length.</p></div>
              <button type="button" onClick={() => setPlotModalOpen(false)} className="rounded-lg p-2 text-muted hover:bg-canvas-soft" aria-label="Close plot size dialog"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-[1fr_1.1fr]">
              <div className="space-y-3">
                <NumberField label="Plot width" min={5} max={1000} step={0.5} suffix={units} value={plotWidth} onChange={(event) => setPlotWidth(event.target.value)} />
                <NumberField label="Plot length" min={5} max={1000} step={0.5} suffix={units} value={plotLength} onChange={(event) => setPlotLength(event.target.value)} />
                <p className="text-[10.5px] leading-relaxed text-muted">The animated preview updates as you type. Existing rooms and site objects stay in their plot positions where they fit.</p>
              </div>
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-line bg-canvas-soft/60 p-3">
                <svg viewBox="0 0 220 170" className="max-h-44 w-full animate-pulse" role="img" aria-label={`Plot skeleton preview, ${liveWidth} by ${liveLength} ${units}`}>
                  <rect x={110 - previewWidth / 2} y={85 - previewLength / 2} width={previewWidth} height={previewLength} rx="3" fill="#e5f0ff" stroke="#3973e8" strokeWidth="2" />
                  {rooms.slice(0, 18).map((room) => <rect key={room.id} x={110 - previewWidth / 2 + room.rect.x * scale} y={85 - previewLength / 2 + room.rect.y * scale} width={Math.max(3, room.rect.w * scale)} height={Math.max(3, room.rect.h * scale)} rx="1.5" fill="#d5dce7" stroke="#9aa6b6" strokeWidth="1" />)}
                </svg>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-line bg-canvas-soft/40 px-5 py-3">
              <button type="button" onClick={() => { setPlotWidth(String(project.plot.width)); setPlotLength(String(project.plot.length)); setPlotModalOpen(false) }} className="rounded-lg border border-line bg-white px-3 py-2 text-[12px] font-medium text-muted">Cancel</button>
              <button type="button" onClick={() => { applyPlotSize(); setPlotModalOpen(false) }} className="rounded-lg bg-brand-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-brand-700">Apply plot size</button>
            </div>
          </section>
        </div>
      })() : null}
    </div>
  )
}

function roundSite(value: number): number {
  return Math.round(value * 100) / 100
}

function formatSiteArea(area: number, units: 'ft' | 'm'): string {
  const suffix = units === 'ft' ? 'ft²' : 'm²'
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(area)} ${suffix}`
}

function formatSiteLength(length: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(length)
}
