import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Box,
  Boxes,
  ChevronsLeft,
  DraftingCompass,
  Loader2,
  Save,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import type { ElementType, FinishOption, Project, Room, Units, Vec2 } from '@/types'
import { useProjects } from '@/hooks/useProjects'
import { uid } from '@/lib/id'
import { ROOM_FURNITURE } from '@/data/catalog'
import type { PendingPlacement, ToolVariant } from '@/data/toolLibrary'
import { variantFromAsset, ASSET_LOOKUP } from '@/data/toolLibrary'
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

export interface Ornament extends Vec2 {
  kind?: string
}

export interface EditorState {
  rooms: Room[]
  placed: Record<string, string[]>
  ornaments: Ornament[]
}

export interface WorkspaceContext {
  project: Project
  /** Live clone: edited rooms + preview roof/finishes — what the 3D shows. */
  previewProject: Project
  rooms: Room[]
  placed: Record<string, string[]>
  ornaments: Ornament[]
  units: Units
  setUnits: (units: Units) => void
  selectedRoomId: string | null
  selectRoom: (id: string | null) => void
  selectedRoom: Room | null
  resizeRoom: (id: string, width: number, length: number) => void
  renameRoom: (id: string, name: string) => void
  toggleFurniture: (roomId: string, item: string) => void
  setRoomFinish: (roomId: string, finish: FinishOption) => void
  setPlotDimensions: (width: number, length: number) => void
  assistantOpen: boolean
  setAssistantOpen: (open: boolean) => void
  propsOpen: boolean
  setPropsOpen: (open: boolean) => void
  save: () => void
  saved: boolean
  showProperties: boolean
  /* Tools */
  tool: ToolId
  setTool: (tool: ToolId) => void
  pending: PendingPlacement | null
  setPending: (pending: PendingPlacement | null) => void
  addRoomAt: (point: Vec2, variant: ToolVariant) => void
  addOpening: (roomId: string, type: ElementType, label?: string, size?: { width?: number; height?: number }) => void
  placeInterior: (roomId: string, item: string) => void
  addTreeAt: (point: Vec2, kind?: string) => void
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

const EMPTY_EDITOR: EditorState = { rooms: [], placed: {}, ornaments: [] }

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
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [propsOpen, setPropsOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [propsCollapsed, setPropsCollapsed] = useState(false)
  const [tool, setTool] = useState<ToolId>('select')
  const [pending, setPending] = useState<PendingPlacement | null>(null)
  const [previewRoof, setPreviewRoof] = useState('flat')
  const [previewExt, setPreviewExt] = useState<FinishOption>('render')
  const [previewInt, setPreviewInt] = useState<FinishOption>('wood')
  const setUnits = useCallback((next: Units) => {
    setUnitsState(next)
    if (project && project.plot.units !== next) {
      void updateProject(project.id, { plot: { ...project.plot, units: next } })
    }
  }, [project, updateProject])

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
    setEditor({
      rooms: structuredClone(project.floors.find((f) => f.level === 1)?.rooms ?? []),
      placed: {},
      ornaments: [],
    })
    setUnits(project.plot.units)
    setSelectedRoomId(null)
    setPreviewRoof(project.roof)
    setPreviewExt(project.preferences.exteriorFinish)
    setPreviewInt(project.preferences.interiorFinish)
    setTool('select')
    setPending(null)
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
  }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectRoom = useCallback((roomId: string | null) => {
    setSelectedRoomId(roomId)
    if (roomId && window.matchMedia('(max-width: 1023px)').matches) {
      setPropsOpen(true)
    }
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
              elements: [
                { id: uid('el'), type: 'door', label: 'Door' },
                { id: uid('el'), type: 'window', label: 'Window' },
              ],
            },
          ],
        }
      })
    },
    [commit, project],
  )

  const addOpening = useCallback(
    (roomId: string, type: ElementType, label?: string, size?: { width?: number; height?: number }) => {
      commit((state) => ({
        ...state,
        rooms: state.rooms.map((room) =>
          room.id === roomId
            ? {
                ...room,
                elements: [
                  ...room.elements,
                  { id: uid('el'), type, label: label ?? (type === 'door' ? 'Door' : 'Window'), width: size?.width, height: size?.height },
                ],
              }
            : room,
        ),
      }))
    },
    [commit],
  )

  const placeInterior = useCallback(
    (roomId: string, item: string) => {
      commit((state) => {
        const current = state.placed[roomId] ?? []
        return { ...state, placed: { ...state.placed, [roomId]: [...current, item] } }
      })
    },
    [commit],
  )

  const addTreeAt = useCallback(
    (point: Vec2, kind?: string) => {
      commit((state) => ({
        ...state,
        ornaments: [...state.ornaments, { x: round1(point.x), y: round1(point.y), kind }],
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
    (roomId: string, finish: FinishOption) => {
      commit((state) => ({
        ...state,
        rooms: state.rooms.map((room) => room.id === roomId ? { ...room, finish } : room),
      }))
    },
    [commit],
  )

  const setPlotDimensions = useCallback((width: number, length: number) => {
    if (!project || !(width > 0) || !(length > 0)) return
    void updateProject(project.id, { plot: { ...project.plot, width, length } })
  }, [project, updateProject])

  const toggleFurniture = useCallback(
    (roomId: string, item: string) => {
      commit((state) => {
        const current = state.placed[roomId] ?? []
        return {
          ...state,
          placed: {
            ...state.placed,
            [roomId]: current.includes(item) ? current.filter((i) => i !== item) : [...current, item],
          },
        }
      })
    },
    [commit],
  )

  const save = useCallback(() => {
    if (!project) return
    const floors = project.floors.map((floor) =>
      floor.level === 1 ? { ...floor, rooms: editor.rooms } : floor,
    )
    void updateProject(project.id, { floors })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }, [project, editor.rooms, updateProject])

  const selectedRoom = useMemo(
    () => editor.rooms.find((room) => room.id === selectedRoomId) ?? null,
    [editor.rooms, selectedRoomId],
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
              interiorFinish: previewInt,
            },
          }
        : null,
    [project, previewRoof, previewExt, previewInt, editor.rooms],
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
    placed: editor.placed,
    ornaments: editor.ornaments,
    units,
    setUnits,
    selectedRoomId,
    selectRoom,
    selectedRoom,
    resizeRoom,
    renameRoom,
    toggleFurniture,
    setRoomFinish,
    setPlotDimensions,
    assistantOpen,
    setAssistantOpen,
    propsOpen,
    setPropsOpen,
    save,
    saved,
    showProperties,
    tool,
    setTool,
    pending,
    setPending,
    addRoomAt,
    addOpening,
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
                placed={editor.placed}
                onToggleFurniture={toggleFurniture}
                onSetFinish={setRoomFinish}
                onViewIn3D={(roomId) => navigate(`/workspace/${id}/3d?room=${encodeURIComponent(roomId)}`)}
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
                placed={editor.placed}
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

function round1(value: number): number {
  return Math.round(value * 10) / 10
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
