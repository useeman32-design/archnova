import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Box,
  DraftingCompass,
  FileDown,
  Home,
  Loader2,
  Save,
  Settings,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import type { Project, Room, Units } from '@/types'
import { useProjects } from '@/hooks/useProjects'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/FormControls'
import { StatusBadge } from '@/components/ui/Badge'
import { PropertiesPanel } from '@/components/editor/PropertiesPanel'
import { AssistantPanel } from '@/components/ai-assistant/AssistantPanel'
import { NotFoundPage } from '@/pages/NotFoundPage'

export interface WorkspaceContext {
  project: Project
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
  save: () => void
  saved: boolean
  showProperties: boolean
}

export function useWorkspace(): WorkspaceContext {
  return useOutletContext<WorkspaceContext>()
}

const RAIL = [
  { to: '', label: 'Overview', icon: Home, end: true },
  { to: 'floor-plan', label: 'Floor Plan', icon: DraftingCompass, end: false },
  { to: '3d', label: '3D View', icon: Box, end: false },
  { to: 'drawings', label: 'Drawings', icon: FileDown, end: false },
]

export function WorkspaceLayout() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { projects, loading, updateProject } = useProjects()
  const project = projects.find((p) => p.id === id)

  const [rooms, setRooms] = useState<Room[]>([])
  const [units, setUnits] = useState<Units>('ft')
  const [selectedRoomId, selectRoom] = useState<string | null>(null)
  const [placed, setPlaced] = useState<Record<string, string[]>>({})
  const [assistantOpen, setAssistantOpen] = useState(searchParams.get('assistant') === '1')
  const [propsOpen, setPropsOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!project) return
    setRooms(structuredClone(project.floors.find((f) => f.level === 1)?.rooms ?? []))
    setUnits(project.plot.units)
    selectRoom(null)
  }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    )
  }

  if (!project) {
    return <NotFoundPage />
  }

  const showProperties = !location.pathname.endsWith('/3d') && !location.pathname.endsWith('/drawings')
  const view: '2D' | '3D' = location.pathname.endsWith('/3d') ? '3D' : '2D'

  const context: WorkspaceContext = {
    project,
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
    save,
    saved,
    showProperties,
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
          <span className="hidden text-[13px] text-muted md:inline">Project</span>
          <span className="hidden text-muted md:inline">/</span>
          <span className="truncate text-[14px] font-semibold text-ink-text">{project.name}</span>
          <span className="hidden sm:inline">
            <StatusBadge status={project.status} />
          </span>
        </div>

        <div className="hidden md:block">
          <SegmentedControl<'2D' | '3D'>
            size="sm"
            options={[
              { value: '2D', label: '2D' },
              { value: '3D', label: '3D' },
            ]}
            value={view}
            onChange={(next) => navigate(next === '3D' ? '3d' : 'floor-plan')}
          />
        </div>

        <Button size="sm" variant="secondary" onClick={save} icon={<Save className="h-3.5 w-3.5" />}>
          <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate('drawings')}
          icon={<FileDown className="h-3.5 w-3.5" />}
        >
          <span className="hidden sm:inline">Export</span>
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

      <div className="relative flex min-h-0 flex-1">
        {/* Workspace rail */}
        <nav className="hidden w-52 shrink-0 flex-col border-r border-ink-700/40 bg-ink-900 py-3 lg:flex">
          {RAIL.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                  isActive ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30' : 'text-white/60 hover:bg-ink-800/60 hover:text-white'
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => setAssistantOpen(true)}
            className="mx-2 mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-medium text-white/60 transition-colors hover:bg-ink-800/60 hover:text-white"
          >
            <Sparkles className="h-[18px] w-[18px] shrink-0" />
            AI Assistant
          </button>
          <div className="mx-4 my-3 border-t border-ink-700/60" />
          <NavLink
            to="/settings"
            className="mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-white/60 transition-colors hover:bg-ink-800/60 hover:text-white"
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            Settings
          </NavLink>
          <div className="mt-auto px-5 pb-2">
            <p className="text-[10.5px] leading-relaxed text-white/35">
              Prototype workspace. Geometry and 3D model services connect later.
            </p>
          </div>
        </nav>

        {/* Mobile workspace tabs */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 overflow-x-auto border-b border-line bg-surface px-2 py-1.5 scroll-thin lg:hidden">
          {RAIL.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium ${
                  isActive ? 'bg-brand-600 text-white' : 'bg-canvas-soft text-muted'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <main className="min-w-0 flex-1 pt-11 lg:pt-0">
          <Outlet context={context} />
        </main>

        {showProperties ? (
          <aside className="hidden w-80 shrink-0 border-l border-line lg:block">
            <PropertiesPanel
              room={selectedRoom}
              units={units}
              onRename={renameRoom}
              onResize={resizeRoom}
              placed={placed}
              onToggleFurniture={toggleFurniture}
            />
          </aside>
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
