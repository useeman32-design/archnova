import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams, useOutletContext } from 'react-router-dom'
import {
  ArrowLeft,
  Box,
  Boxes,
  ChevronsLeft,
  DraftingCompass,
  FileDown,
  Loader2,
  Save,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import type { ElementType, FinishOption, Project, Room, RoomCategory, Units, Vec2 } from '@/types'
import { useProjects } from '@/hooks/useProjects'
import { uid } from '@/lib/id'
import { ROOM_FURNITURE, ROOM_OPTIONS } from '@/data/catalog'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/FormControls'
import { StatusBadge } from '@/components/ui/Badge'
import { PropertiesPanel } from '@/components/editor/PropertiesPanel'
import { ToolPalette } from '@/components/editor/ToolPalette'
import { AssistantPanel } from '@/components/ai-assistant/AssistantPanel'
import { NotFoundPage } from '@/pages/NotFoundPage'

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

export interface WorkspaceContext {
  project: Project
  /** Project clone with preview overrides (roof / finishes) applied. */
  previewProject: Project
  rooms: Room[]
  units: Units
  setUnits: (units: Units) => void
  selectedRoomId: string | null
  selectRoom: (id: string | null) => void
  selectedRoom: Room | null
  resizeRoom: (id: string, width: number, length: number) => void
  renameRoom: (id: string, name: string) => void
  placed: Record<string, string[]>
  toggleFurniture: (roomId: string, item: string) => void
  assistantOpen: boolean
  setAssistantOpen: (open: boolean) => void
  propsOpen: boolean
  setPropsOpen: (open: boolean) => void
  canvasView: '2D' | '3D'
  setCanvasView: (view: '2D' | '3D') => void
  save: () => void
  saved: boolean
  showProperties: boolean
  /* Editing tools */
  tool: ToolId
  setTool: (tool: ToolId) => void
  pendingRoom: RoomCategory | null
  setPendingRoom: (category: RoomCategory | null) => void
  pendingInterior: string | null
  setPendingInterior: (item: string | null) => void
  ornaments: Vec2[]
  addRoomAt: (point: Vec2, category: RoomCategory) => void
  addOpening: (roomId: string, type: ElementType) => void
  placeInterior: (roomId: string, item: string) => void
  addTreeAt: (point: Vec2) => void
  previewRoof: string
  setPreviewRoof: (roof: string) => void
  previewExt: FinishOption
  setPreviewExt: (finish: FinishOption) => void
  previewInt: FinishOption
  setPreviewInt: (finish: FinishOption) => void
}

export function useWorkspace(): WorkspaceContext {
  return useOutletContext<WorkspaceContext>()
}

const VIEW_TABS = [
  { key: 'floor', to: '', label: 'Floor Plan', icon: DraftingCompass },
  { key: '3d', to: '3d', label: '3D View', icon: Box },
  { key: 'drawings', to: 'drawings', label: 'Drawings', icon: FileDown },
  { key: 'assets', to: 'assets', label: 'Assets', icon: Boxes },
] as const

export function WorkspaceLayout() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { projects, loading, updateProject } = useProjects()
  const project = projects.find((p) => p.id === id)

  const [rooms, setRooms] = useState<Room[]>([])
  const [units, setUnits] = useState<Units>('ft')
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [placed, setPlaced] = useState<Record<string, string[]>>({})
  const [ornaments, setOrnaments] = useState<Vec2[]>([])
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [propsOpen, setPropsOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [canvasView, setCanvasView] = useState<'2D' | '3D'>('2D')
  const [propsCollapsed, setPropsCollapsed] = useState(false)
  const [tool, setTool] = useState<ToolId>('select')
  const [pendingRoom, setPendingRoom] = useState<RoomCategory | null>(null)
  const [pendingInterior, setPendingInterior] = useState<string | null>(null)
  const [previewRoof, setPreviewRoof] = useState('flat')
  const [previewExt, setPreviewExt] = useState<FinishOption>('render')
  const [previewInt, setPreviewInt] = useState<FinishOption>('wood')

  useEffect(() => {
    if (!project) return
    setRooms(structuredClone(project.floors.find((f) => f.level === 1)?.rooms ?? []))
    setUnits(project.plot.units)
    setSelectedRoomId(null)
    setOrnaments([])
    setPreviewRoof(project.roof)
    setPreviewExt(project.preferences.exteriorFinish)
    setPreviewInt(project.preferences.interiorFinish)
    setTool('select')
  }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Selecting a room on a phone opens the properties drawer so the edit is visible. */
  const selectRoom = useCallback((roomId: string | null) => {
    setSelectedRoomId(roomId)
    if (roomId && window.matchMedia('(max-width: 1023px)').matches) {
      setPropsOpen(true)
    }
  }, [])

  const resizeRoom = useCallback((roomId: string, width: number, length: number) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === roomId
          ? { ...room, width, length, rect: { ...room.rect, w: width, h: length } }
          : room,
      ),
    )
  }, [])

  const renameRoom = useCallback((roomId: string, name: string) => {
    setRooms((prev) => prev.map((room) => (room.id === roomId ? { ...room, name } : room)))
  }, [])

  const toggleFurniture = useCallback((roomId: string, item: string) => {
    setPlaced((prev) => {
      const current = prev[roomId] ?? []
      return {
        ...prev,
        [roomId]: current.includes(item) ? current.filter((i) => i !== item) : [...current, item],
      }
    })
  }, [])

  const addRoomAt = useCallback(
    (point: Vec2, category: RoomCategory) => {
      const size = 10
      const plotW = project?.plot.width ?? 50
      const plotL = project?.plot.length ?? 50
      const x = Math.max(0, Math.min(plotW - size, point.x - size / 2))
      const y = Math.max(0, Math.min(plotL - size, point.y - size / 2))
      const label = ROOM_OPTIONS.find((r) => r.value === category)?.label ?? 'Room'
      setRooms((prev) => [
        ...prev,
        {
          id: uid('room'),
          name: label,
          category,
          width: size,
          length: size,
          units: project?.plot.units ?? 'ft',
          rect: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, w: size, h: size },
          level: 1,
          furniture: ROOM_FURNITURE[category] ?? [],
          elements: [
            { id: uid('el'), type: 'door', label: 'Door' },
            { id: uid('el'), type: 'window', label: 'Window' },
          ],
        },
      ])
    },
    [project],
  )

  const addOpening = useCallback((roomId: string, type: ElementType) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === roomId
          ? { ...room, elements: [...room.elements, { id: uid('el'), type, label: type === 'door' ? 'Door' : 'Window' }] }
          : room,
      ),
    )
  }, [])

  const placeInterior = useCallback((roomId: string, item: string) => {
    setPlaced((prev) => {
      const current = prev[roomId] ?? []
      return current.includes(item) ? prev : { ...prev, [roomId]: [...current, item] }
    })
  }, [])

  const addTreeAt = useCallback((point: Vec2) => {
    setOrnaments((prev) => [...prev, { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 }])
  }, [])

  const save = useCallback(() => {
    if (!project) return
    const floors = project.floors.map((floor) =>
      floor.level === 1 ? { ...floor, rooms } : floor,
    )
    void updateProject(project.id, { floors })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }, [project, rooms, updateProject])

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  )

  const previewProject = useMemo<Project | null>(
    () =>
      project
        ? {
            ...project,
            roof: previewRoof,
            preferences: { ...project.preferences, exteriorFinish: previewExt, interiorFinish: previewInt },
          }
        : null,
    [project, previewRoof, previewExt, previewInt],
  )

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    )
  }

  if (!project || !previewProject) {
    return <NotFoundPage />
  }

  /** Current workspace segment: '' | '3d' | 'drawings' | 'assets' */
  const segment = location.pathname
    .slice(`/workspace/${id}`.length)
    .replace(/^\/+/, '')
    .split('/')[0]
  const showProperties = segment === '' || segment === 'floor-plan'
  const isActiveTab = (key: (typeof VIEW_TABS)[number]['key']) =>
    key === 'floor' ? segment === '' || segment === 'floor-plan' : segment === key

  const handleViewChange = (next: '2D' | '3D') => {
    setCanvasView(next)
    if (segment !== '') navigate('')
  }

  const context: WorkspaceContext = {
    project,
    previewProject,
    rooms,
    units,
    setUnits,
    selectedRoomId,
    selectRoom,
    selectedRoom,
    resizeRoom,
    renameRoom,
    placed,
    toggleFurniture,
    assistantOpen,
    setAssistantOpen,
    propsOpen,
    setPropsOpen,
    canvasView,
    setCanvasView,
    save,
    saved,
    showProperties,
    tool,
    setTool,
    pendingRoom,
    setPendingRoom,
    pendingInterior,
    setPendingInterior,
    ornaments,
    addRoomAt,
    addOpening,
    placeInterior,
    addTreeAt,
    previewRoof,
    setPreviewRoof,
    previewExt,
    setPreviewExt,
    previewInt,
    setPreviewInt,
  }

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      {/* Top toolbar */}
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

        {/* View tabs — like document/view tabs in an editor */}
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
            value={segment === '3d' ? '3D' : canvasView}
            onChange={handleViewChange}
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

      {/* Mobile view tabs */}
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
        <ToolPalette />

        <main className="min-w-0 flex-1">
          <Outlet context={context} />
        </main>

        {showProperties ? (
          propsCollapsed ? (
            <aside className="hidden w-10 shrink-0 flex-col items-center border-l border-line bg-surface pt-3 lg:flex">
              <button
                onClick={() => setPropsCollapsed(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas-soft hover:text-ink-text"
                aria-label="Expand properties panel"
                title="Expand properties"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <span className="mt-3 text-[11px] font-medium text-faint [writing-mode:vertical-rl]">
                Properties
              </span>
            </aside>
          ) : (
            <aside className="hidden w-80 shrink-0 border-l border-line lg:block">
              <PropertiesPanel
                room={selectedRoom}
                units={units}
                onRename={renameRoom}
                onResize={resizeRoom}
                placed={placed}
                onToggleFurniture={toggleFurniture}
                onCollapse={() => setPropsCollapsed(true)}
              />
            </aside>
          )
        ) : null}

        <AssistantPanel
          key={project.id}
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          project={project}
        />
      </div>

      {/* Mobile properties drawer */}
      {propsOpen && showProperties ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50 animate-fade-in" onClick={() => setPropsOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 h-[72%] overflow-hidden rounded-t-2xl bg-surface shadow-2xl">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" />
            <div className="h-[calc(100%-12px)]">
              <PropertiesPanel
                room={selectedRoom}
                units={units}
                onClose={() => setPropsOpen(false)}
                onRename={renameRoom}
                onResize={resizeRoom}
                placed={placed}
                onToggleFurniture={toggleFurniture}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
