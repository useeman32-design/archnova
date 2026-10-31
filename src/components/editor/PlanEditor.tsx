import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Compass, Crosshair, Frame, Info, MapPin, Printer, Tag, X } from 'lucide-react'
import type { PlotShape, Room, SiteBoundary, SiteEdgeLabel, SiteEdgeLabelType, SiteVertex, Vec2 } from '@/types'
import { useWorkspace } from '@/pages/workspace/WorkspaceLayout'
import { FloorPlanDiagram } from '@/components/floor-plan/FloorPlanDiagram'
import { PlanCanvas, ZoomControls, useZoom } from '@/components/floor-plan/PlanCanvas'
import { SegmentedControl } from '@/components/ui/FormControls'
import { NumberField } from '@/components/ui/Field'
import type { PendingPlacement } from '@/data/toolLibrary'
import { validatePlan } from '@/lib/planValidation'
import { classifyBoundaryShape, findSiteEdgeLabel, polygonArea, siteEdgeLength, validateSiteBoundary } from '@/lib/siteGeometry'
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
  select: 'Select tool: click a room to edit, drag it to move, pull the blue handle to resize. Ctrl+Z undo · Ctrl+Shift+Z redo.',
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
    return [...roomIssues, ...siteIssues]
  }, [rooms, project.plot.width, project.plot.length, units, project.site?.boundary, ctx.walls, ctx.openings, ctx.placed])
  const planErrorCount = planIssues.filter((issue) => issue.severity === 'error').length
  const [plotWidth, setPlotWidth] = useState(String(project.plot.width))
  const [plotLength, setPlotLength] = useState(String(project.plot.length))
  const [plotModalOpen, setPlotModalOpen] = useState(false)
  const [boundaryEditMode, setBoundaryEditMode] = useState(false)
  const [boundaryDraft, setBoundaryDraft] = useState<SiteVertex[]>([])
  const [boundaryEdgeLabels, setBoundaryEdgeLabels] = useState<SiteEdgeLabel[]>([])
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
  }, [project.id])
  useEffect(() => {
    setPlotWidth(String(project.plot.width))
    setPlotLength(String(project.plot.length))
  }, [project.plot.width, project.plot.length])
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
    setBoundaryDraft(savedBoundary && savedBoundary.status !== 'unknown' ? savedBoundary.vertices.map((point) => ({ ...point })) : [])
    setBoundaryEdgeLabels(savedBoundary?.edgeLabels?.map((edge) => ({ ...edge })) ?? [])
    setBoundaryEditMode(true)
  }
  const updateBoundaryEdgeLabel = (fromVertexId: string, toVertexId: string, type: SiteEdgeLabelType, customName?: string) => {
    setBoundaryEdgeLabels((previous) => {
      const next = previous.filter((edge) => !(edge.fromVertexId === fromVertexId && edge.toVertexId === toVertexId))
      if (type !== 'unknown') next.push({ fromVertexId, toVertexId, type, ...(customName !== undefined ? { customName } : {}) })
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
      if (!edge || edge.type === 'unknown') return []
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
    ctx.updateSiteBoundary(boundary, shape as PlotShape)
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
    ctx.updateSiteBoundary(boundary, shape)
    setBoundaryEdgeLabels([])
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
    ctx.selectRoom(room.id === selectedRoomId ? null : room.id)
  }

  const handleCanvasClick = (point: Vec2) => {
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
          <IconToggle active={showCompass} onClick={() => setShowCompass((v) => !v)} label="North" icon={<Compass className="h-3.5 w-3.5" />} />
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
                Tap inside the plot envelope to add points; drag the handles to adjust them. The outline is not treated as a real boundary until you save at least three valid vertices.
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
                    return <div key={`${vertex.id}-${next.id}`} className="flex flex-wrap items-center gap-2 text-[10.5px] text-teal-950">
                      <span className="min-w-28 font-medium">Edge {index + 1}: {formatSiteLength(siteEdgeLength(vertex, next))} {units}</span>
                      <label className="flex items-center gap-1.5">
                        <span className="sr-only">Label plot edge {index + 1}</span>
                        <select aria-label={`Label plot edge ${index + 1}`} value={edgeType} onChange={(event) => updateBoundaryEdgeLabel(vertex.id, next.id, event.target.value as SiteEdgeLabelType, edgeLabel?.customName)} className="rounded-md border border-teal-300 bg-white px-2 py-1 text-[10.5px]">
                          <option value="unknown">Unknown</option><option value="front">Front</option><option value="rear">Rear</option><option value="left">Left</option><option value="right">Right</option><option value="road-facing">Road-facing</option><option value="custom">Custom name</option>
                        </select>
                      </label>
                      {edgeType === 'custom' ? <input aria-label={`Custom name for plot edge ${index + 1}`} value={edgeLabel?.customName ?? ''} onChange={(event) => updateBoundaryEdgeLabel(vertex.id, next.id, 'custom', event.target.value)} placeholder="Enter edge name" className="w-36 rounded-md border border-teal-300 bg-white px-2 py-1 text-[10.5px]" /> : null}
                    </div>
                  })}
                  <p className="text-[10px] text-teal-800">Lengths are derived from the vertices; labels are user-assigned. No frontage or compass direction is assumed.</p>
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
            buildingFootprints={(project.buildings ?? []).filter((building) => building.role !== 'primary' && Boolean(building.footprint)).map((building) => ({ id: building.id, name: building.name, role: building.role, footprint: building.footprint! }))}
            boundaryEditMode={boundaryEditMode}
            boundaryDraft={boundaryDraft}
            boundaryDraftEdgeLabels={boundaryEdgeLabels}
            onBoundaryAddPoint={addBoundaryPoint}
            onBoundaryMovePoint={moveBoundaryPoint}
            showLabels={showLabels}
            showDimensions={showDimensions}
            showAreas={showAreas}
            showCompass={showCompass}
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
