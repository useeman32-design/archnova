import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, TransformControls, Edges } from '@react-three/drei'
import { BackSide, CanvasTexture, RepeatWrapping, SRGBColorSpace, type Mesh, type Object3D } from 'three'
import type { FinishOption, Project, Room } from '@/types'

/**
 * React Three Fiber scene for the massing preview.
 *
 * Rooms are selectable (click) and directly manipulable: TransformControls
 * move/scale writes back into the same room rects the 2D plan edits, so 2D and
 * 3D stay in sync. Trees and placed interior items render as massing props.
 * Swap this scene for a GLTF-loaded model when the 3D model service exists.
 */

const S = 0.12 // world units per foot
const WALL_H = 10 * S
const SLAB = 0.06

export const WALL_COLORS: Record<FinishOption, string> = {
  render: '#e9e4d8',
  paint: '#f3efe6',
  brick: '#b0715a',
  stone: '#c8c1b2',
  wood: '#a9805a',
  glass: '#bcd6e2',
}

export const FLOOR_COLORS: Record<FinishOption, string> = {
  render: '#d9d4c9',
  paint: '#e4ded2',
  brick: '#b98d6f',
  stone: '#cfc8b8',
  wood: '#c9a97f',
  glass: '#d7e2e8',
}

const FLAT_CATEGORIES = new Set(['garden', 'pool', 'circulation'])

export interface MassingCanvasProps {
  project: Project
  mode: 'exterior' | 'interior'
  selectedId?: string | null
  onSelectRoom?: (id: string | null) => void
  transformMode?: 'translate' | 'scale'
  onMoveLive?: (id: string, x: number, y: number) => void
  onResizeLive?: (id: string, w: number, h: number) => void
  onEditBegin?: () => void
  onEditEnd?: () => void
  ornaments?: { x: number; y: number; kind?: string }[]
  placed?: Record<string, string[]>
  pendingItem?: string | null
  onPlaceInterior?: (item: string) => void
}

export default function MassingCanvas(props: MassingCanvasProps) {
  const orbitRef = useRef<any>(null)
  const meshRefs = useRef(new Map<string, Mesh>())
  const [selectedObj, setSelectedObj] = useState<Object3D | null>(null)
  const baseSize = useRef<{ w: number; h: number } | null>(null)
  const { project, mode, selectedId, onSelectRoom, transformMode = 'translate' } = props

  useEffect(() => {
    setSelectedObj(selectedId ? (meshRefs.current.get(selectedId) ?? null) : null)
  }, [selectedId])

  const rooms = project.floors.flatMap((floor) => floor.rooms)
  const selectedRoom = rooms.find((r) => r.id === selectedId) ?? null

  const handleTransform = () => {
    const obj = selectedObj
    if (!obj || !selectedRoom) return
    const { width: plotW, length: plotL } = project.plot
    if (transformMode === 'translate') {
      const nx = obj.position.x / S + plotW / 2 - selectedRoom.rect.w / 2
      const nz = obj.position.z / S + plotL / 2 - selectedRoom.rect.h / 2
      props.onMoveLive?.(selectedRoom.id, Math.round(nx * 10) / 10, Math.round(nz * 10) / 10)
    } else {
      const base = baseSize.current ?? { w: selectedRoom.rect.w, h: selectedRoom.rect.h }
      const nw = Math.max(4, Math.round(base.w * obj.scale.x * 10) / 10)
      const nh = Math.max(4, Math.round(base.h * obj.scale.z * 10) / 10)
      obj.scale.set(1, 1, 1)
      props.onResizeLive?.(selectedRoom.id, nw, nh)
    }
  }

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={
        mode === 'interior'
          ? { position: [0, 0.5, 0.01], fov: 70 }
          : { position: [5.4, 4.2, 6.4], fov: 42 }
      }
      onPointerMissed={() => onSelectRoom?.(null)}
    >
      {mode === 'interior' ? (
        <InteriorScene
          rooms={rooms}
          selected={selectedRoom}
          floorFinish={project.preferences.interiorFinish}
          placed={props.placed ?? {}}
          pendingItem={props.pendingItem ?? null}
          onPlaceInterior={props.onPlaceInterior}
        />
      ) : (
        <ExteriorScene
          project={project}
          selectedId={selectedId ?? null}
          onSelectRoom={onSelectRoom}
          meshRefs={meshRefs}
          ornaments={props.ornaments ?? []}
        />
      )}

      {mode === 'exterior' && selectedObj && onSelectRoom ? (
        <TransformControls
          object={selectedObj}
          mode={transformMode}
          showY={false}
          size={0.7}
          onMouseDown={() => {
            if (orbitRef.current) orbitRef.current.enabled = false
            baseSize.current = selectedRoom
              ? { w: selectedRoom.rect.w, h: selectedRoom.rect.h }
              : null
            props.onEditBegin?.()
          }}
          onMouseUp={() => {
            if (orbitRef.current) orbitRef.current.enabled = true
            baseSize.current = null
            props.onEditEnd?.()
          }}
          onObjectChange={handleTransform}
        />
      ) : null}

      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={mode === 'interior' ? 0.01 : 2.5}
        maxDistance={mode === 'interior' ? 6 : 16}
        maxPolarAngle={mode === 'interior' ? Math.PI : Math.PI / 2.05}
        target={mode === 'interior' ? [0, 0.5, 0] : [0, 0.6, 0]}
      />
    </Canvas>
  )
}

/* ------------------------------------------------------------------ */

function ExteriorScene({
  project,
  selectedId,
  onSelectRoom,
  meshRefs,
  ornaments,
}: {
  project: Project
  selectedId: string | null
  onSelectRoom?: (id: string | null) => void
  meshRefs: React.MutableRefObject<Map<string, Mesh>>
  ornaments: { x: number; y: number; kind?: string }[]
}) {
  const { width: plotW, length: plotL } = project.plot
  const wallColor = WALL_COLORS[project.preferences.exteriorFinish] ?? WALL_COLORS.render
  const topLevel = Math.max(...project.floors.map((f) => f.level), 1)
  const buildingRooms = project.floors.flatMap((floor) => floor.rooms.filter((room) => !FLAT_CATEGORIES.has(room.category)))
  const buildingBounds = buildingRooms.length ? {
    minX: Math.min(...buildingRooms.map((room) => room.rect.x)),
    minY: Math.min(...buildingRooms.map((room) => room.rect.y)),
    maxX: Math.max(...buildingRooms.map((room) => room.rect.x + room.rect.w)),
    maxY: Math.max(...buildingRooms.map((room) => room.rect.y + room.rect.h)),
  } : null

  const toWorld = (x: number, y: number): [number, number] => [
    (x - plotW / 2) * S,
    (y - plotL / 2) * S,
  ]

  return (
    <>
      <color attach="background" args={['#e8edf2']} />
      <hemisphereLight args={['#ffffff', '#b9c2cc', 1.05]} />
      <directionalLight position={[6, 9, 4]} intensity={1.35} castShadow />
      <directionalLight position={[-5, 4, -6]} intensity={0.35} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[plotW * S + 8, plotL * S + 8]} />
        <meshStandardMaterial color="#dfe4e8" />
      </mesh>

      {project.floors.flatMap((floor) =>
        floor.rooms.map((room) => {
          const flat = FLAT_CATEGORIES.has(room.category)
          const h = flat ? 0.05 : WALL_H
          const [wx, wz] = toWorld(room.rect.x + room.rect.w / 2, room.rect.y + room.rect.h / 2)
          const y = (floor.level - 1) * (WALL_H + SLAB) + h / 2
          const isSelected = room.id === selectedId
          const color = flat
            ? room.category === 'pool'
              ? '#7fc4e8'
              : room.category === 'garden'
                ? '#a9cf94'
                : '#d8d5cd'
            : wallColor
          return (
            <mesh
              key={room.id}
              ref={(mesh) => {
                if (mesh) meshRefs.current.set(room.id, mesh)
                else meshRefs.current.delete(room.id)
              }}
              position={[wx, y, wz]}
              castShadow={!flat}
              receiveShadow
              onClick={
                onSelectRoom
                  ? (event: ThreeEvent<MouseEvent>) => {
                      event.stopPropagation()
                      onSelectRoom(room.id === selectedId ? null : room.id)
                    }
                  : undefined
              }
            >
              <boxGeometry args={[room.rect.w * S, h, room.rect.h * S]} />
              <meshStandardMaterial
                color={color}
                roughness={0.85}
                emissive={isSelected ? '#1a56f5' : '#000000'}
                emissiveIntensity={isSelected ? 0.28 : 0}
              />
              {isSelected ? <Edges color="#1a56f5" /> : null}
              {!flat ? room.elements.filter((element) => element.type === 'door').map((element, index, all) => {
                const width = Math.min(room.rect.w * S * 0.82, (element.width ?? 3) * S)
                const height = Math.min(WALL_H * 0.92, (element.height ?? 7) * S)
                const offsetX = -room.rect.w * S / 2 + room.rect.w * S * ((index + 1) / (all.length + 1))
                return <group key={element.id} position={[offsetX, -h / 2 + height / 2, room.rect.h * S / 2 + 0.012]}>
                  <mesh><boxGeometry args={[width + 0.045, height + 0.035, 0.025]} /><meshStandardMaterial color="#44372c" roughness={0.78} /></mesh>
                  <mesh position={[0, 0, 0.016]}><boxGeometry args={[Math.max(0.12, width - 0.035), Math.max(0.2, height - 0.035), 0.012]} /><meshStandardMaterial color="#9a7654" roughness={0.62} /></mesh>
                </group>
              }) : null}
              {!flat ? room.elements.filter((element) => element.type === 'window').map((element, index, all) => {
                const width = Math.min(room.rect.w * S * 0.7, (element.width ?? 4) * S)
                const height = Math.min(WALL_H * 0.62, (element.height ?? 4) * S)
                const offsetX = -room.rect.w * S / 2 + room.rect.w * S * ((index + 1) / (all.length + 1))
                const sill = WALL_H * 0.18
                return <group key={element.id} position={[offsetX, sill + height / 2, room.rect.h * S / 2 + 0.014]}>
                  <mesh><boxGeometry args={[width + 0.045, height + 0.045, 0.026]} /><meshStandardMaterial color="#f3f0e8" roughness={0.55} /></mesh>
                  <mesh position={[0, 0, 0.016]}><boxGeometry args={[width, height, 0.012]} /><meshStandardMaterial color="#a8d2e7" emissive="#8dc7e5" emissiveIntensity={0.18} metalness={0.1} roughness={0.23} /></mesh>
                  <mesh position={[0, 0, 0.024]}><boxGeometry args={[0.018, height, 0.008]} /><meshStandardMaterial color="#e8edf0" /></mesh>
                </group>
              }) : null}
            </mesh>
          )
        }),
      )}

      {ornaments.map((tree, index) => {
        const [tx, tz] = toWorld(tree.x, tree.y)
        return <Tree key={`t${index}`} position={[tx, 0, tz]} kind={tree.kind} />
      })}

      {buildingBounds ? (
        <group position={[(buildingBounds.minX + buildingBounds.maxX - plotW) * S / 2, 0, (buildingBounds.minY + buildingBounds.maxY - plotL) * S / 2]}>
          <Roof
            form={project.roof}
            y={topLevel * (WALL_H + SLAB)}
            width={(buildingBounds.maxX - buildingBounds.minX) * S * 1.06}
            length={(buildingBounds.maxY - buildingBounds.minY) * S * 1.06}
          />
        </group>
      ) : null}
    </>
  )
}

function Tree({ position, kind = 'palm' }: { position: [number, number, number]; kind?: string }) {
  if (kind === 'car') {
    return (
      <group position={position}>
        <mesh position={[0, 0.16, 0]} castShadow><boxGeometry args={[0.52, 0.18, 0.28]} /><meshStandardMaterial color="#53677e" metalness={0.18} roughness={0.45} /></mesh>
        <mesh position={[0, 0.27, -0.01]} castShadow><boxGeometry args={[0.28, 0.16, 0.24]} /><meshStandardMaterial color="#8eb4c8" roughness={0.25} /></mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * 0.17, 0.07, z * 0.12]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.055, 0.055, 0.035, 12]} /><meshStandardMaterial color="#20252b" /></mesh>))}
      </group>
    )
  }
  if (kind === 'person') {
    return (
      <group position={position}>
        <mesh position={[0, 0.24, 0]} castShadow><capsuleGeometry args={[0.055, 0.25, 4, 8]} /><meshStandardMaterial color="#455f87" /></mesh>
        <mesh position={[0, 0.45, 0]} castShadow><sphereGeometry args={[0.075, 12, 10]} /><meshStandardMaterial color="#c9926d" /></mesh>
      </group>
    )
  }
  const tall = kind === 'palm' || kind === 'conifer'
  const trunkH = tall ? 0.55 : 0.18
  return (
    <group position={position}>
      <mesh position={[0, trunkH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, trunkH, 6]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.9} />
      </mesh>
      {kind === 'conifer' ? (
        <mesh position={[0, trunkH + 0.28, 0]} castShadow>
          <coneGeometry args={[0.26, 0.62, 8]} />
          <meshStandardMaterial color="#3f6d3a" roughness={0.85} />
        </mesh>
      ) : kind === 'shrub' || kind === 'flower' ? (
        <mesh position={[0, trunkH + 0.08, 0]} castShadow>
          <sphereGeometry args={[0.14, 12, 10]} />
          <meshStandardMaterial color={kind === 'flower' ? '#c96f8e' : '#5d8a43'} roughness={0.9} />
        </mesh>
      ) : kind === 'hedge' ? (
        <mesh position={[0, trunkH + 0.06, 0]} castShadow>
          <boxGeometry args={[0.5, 0.16, 0.16]} />
          <meshStandardMaterial color="#4f7a3c" roughness={0.9} />
        </mesh>
      ) : (
        <mesh position={[0, trunkH + 0.16, 0]} castShadow>
          <sphereGeometry args={[0.26, 14, 12]} />
          <meshStandardMaterial color="#4f8a3f" roughness={0.85} />
        </mesh>
      )}
    </group>
  )
}

function Roof({ form, y, width, length }: { form: string; y: number; width: number; length: number }) {
  const rise = Math.min(width, length) * 0.32
  const color = '#33415c'

  if (form === 'pitched-gable') {
    const slope = Math.atan2(rise, length / 2)
    const panel = Math.sqrt(rise * rise + (length / 2) ** 2) + 0.12
    return (
      <group position={[0, y, 0]}>
        <mesh position={[0, rise / 2, -length / 4]} rotation={[slope, 0, 0]} castShadow>
          <boxGeometry args={[width + 0.24, 0.05, panel]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
        <mesh position={[0, rise / 2, length / 4]} rotation={[-slope, 0, 0]} castShadow>
          <boxGeometry args={[width + 0.24, 0.05, panel]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      </group>
    )
  }
  if (form === 'hip' || form === 'mansard') {
    return (
      <mesh position={[0, y, 0]} rotation={[0, Math.PI / 4, 0]} scale={[width * 0.72, 1, length * 0.72]} castShadow>
        <coneGeometry args={[1, rise, 4]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    )
  }
  if (form === 'shed') {
    return (
      <mesh position={[0, y + rise * 0.28, 0]} rotation={[0.28, 0, 0]} castShadow>
        <boxGeometry args={[width + 0.24, 0.06, length + 0.3]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    )
  }
  if (form === 'dome') {
    return (
      <mesh position={[0, y, 0]} scale={[width * 0.55, rise * 1.1, length * 0.55]} castShadow>
        <sphereGeometry args={[1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    )
  }
  return (
    <mesh position={[0, y + 0.04, 0]} castShadow>
      <boxGeometry args={[width + 0.3, 0.09, length + 0.3]} />
      <meshStandardMaterial color="#42506b" roughness={0.75} />
    </mesh>
  )
}

/* ---------------------------- interior ---------------------------- */

function InteriorScene({
  rooms,
  selected,
  floorFinish,
  placed,
  pendingItem,
  onPlaceInterior,
}: {
  rooms: Room[]
  selected: Room | null
  floorFinish: FinishOption
  placed: Record<string, string[]>
  pendingItem: string | null
  onPlaceInterior?: (item: string) => void
}) {
  const room = useMemo(() => {
    if (selected) return selected
    const candidates = rooms.filter((r) => r.category === 'living' || r.category === 'bedroom')
    const pool = candidates.length > 0 ? candidates : rooms
    return pool.reduce<Room | null>(
      (best, r) => (!best || r.width * r.length > best.width * best.length ? r : best),
      null,
    )
  }, [rooms, selected])
  const finish = room?.finish ?? floorFinish
  const w = (room?.width ?? 0) * S
  const l = (room?.length ?? 0) * S
  const floorTexture = useMemo(() => room ? makeFloorTexture(finish, w, l) : null, [room?.id, finish, w, l])
  useEffect(() => () => floorTexture?.dispose(), [floorTexture])

  if (!room) return null
  const items = placed[room.id] ?? []
  const effective = items.length > 0 ? items : defaultItemsFor(room.category)

  return (
    <>
      <color attach="background" args={['#eef0f3']} />
      <hemisphereLight args={['#ffffff', '#c9ccd2', 0.9]} />
      <pointLight position={[0, WALL_H * 0.82, 0]} intensity={1.5} distance={7} color="#fff4e0" />
      <directionalLight position={[2, 3, 2]} intensity={0.5} />

      {/* floor + ceiling */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(event) => {
          if (!pendingItem) return
          event.stopPropagation()
          onPlaceInterior?.(pendingItem)
        }}
      >
        <planeGeometry args={[w, l]} />
        <meshStandardMaterial map={floorTexture ?? undefined} color={floorTexture ? '#ffffff' : (FLOOR_COLORS[finish] ?? FLOOR_COLORS.wood)} roughness={finish === 'wood' ? 0.62 : 0.78} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, 0]}>
        <planeGeometry args={[w, l]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.9} />
      </mesh>

      {/* shell */}
      <mesh position={[0, WALL_H / 2, 0]}>
        <boxGeometry args={[w, WALL_H, l]} />
        <meshStandardMaterial color="#efece4" side={BackSide} roughness={0.9} />
      </mesh>

      {/* windows on the far wall */}
      {[-w * 0.22, w * 0.22].map((x, i) => (
        <mesh key={i} position={[x, WALL_H * 0.55, -l / 2 + 0.012]}>
          <planeGeometry args={[w * 0.26, WALL_H * 0.5]} />
          <meshStandardMaterial color="#cfe8f7" emissive="#bfe0f5" emissiveIntensity={0.55} />
        </mesh>
      ))}
      {/* door on the side wall */}
      <mesh position={[-w / 2 + 0.012, WALL_H * 0.35, l * 0.25]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[w * 0.18, WALL_H * 0.7]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.7} />
      </mesh>

      {/* skirting */}
      <mesh position={[0, 0.02, -l / 2 + 0.02]}>
        <boxGeometry args={[w, 0.04, 0.02]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {effective.map((item, index) => (
        <FurniturePiece key={`${item}-${index}`} item={item} w={w} l={l} slot={index} />
      ))}
    </>
  )
}

function makeFloorTexture(finish: FinishOption, width: number, length: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const base = FLOOR_COLORS[finish] ?? FLOOR_COLORS.wood
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)

  if (finish === 'wood') {
    for (let row = 0; row < 8; row++) {
      const y = row * 32
      ctx.fillStyle = row % 2 ? '#c1a078' : '#d2b58b'
      ctx.fillRect(0, y, 256, 31)
      ctx.strokeStyle = 'rgba(92,65,39,.23)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, y + 31); ctx.lineTo(256, y + 31); ctx.stroke()
      const offset = row % 2 ? 0 : 64
      for (let x = offset; x < 256; x += 128) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 31); ctx.stroke()
      }
      for (let grain = 0; grain < 3; grain++) {
        ctx.strokeStyle = 'rgba(112,78,45,.08)'
        ctx.beginPath(); ctx.moveTo(8, y + 5 + grain * 8); ctx.lineTo(245, y + 5 + grain * 8); ctx.stroke()
      }
    }
  } else if (finish === 'stone' || finish === 'glass') {
    ctx.strokeStyle = finish === 'glass' ? 'rgba(81,126,151,.28)' : 'rgba(92,99,105,.24)'
    ctx.lineWidth = 2
    for (let y = 0; y <= 256; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke() }
    for (let x = 0; x <= 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke() }
    if (finish === 'glass') {
      ctx.fillStyle = 'rgba(255,255,255,.18)'
      ctx.fillRect(8, 8, 42, 42)
    }
  } else if (finish === 'brick') {
    ctx.strokeStyle = 'rgba(87,55,43,.3)'
    ctx.lineWidth = 2
    for (let y = 0; y <= 256; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke() }
    for (let row = 0; row < 8; row++) {
      const offset = row % 2 ? 0 : 32
      for (let x = offset; x <= 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, row * 32); ctx.lineTo(x, row * 32 + 32); ctx.stroke() }
    }
  } else {
    ctx.strokeStyle = 'rgba(110,118,126,.12)'
    ctx.lineWidth = 1
    for (let i = 0; i < 90; i++) {
      const x = (i * 73) % 256
      const y = (i * 127) % 256
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.12)' : 'rgba(70,75,80,.04)'
      ctx.fillRect(x, y, 2, 2)
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(Math.max(1, width * 0.75), Math.max(1, length * 0.75))
  texture.needsUpdate = true
  return texture
}

function defaultItemsFor(category: string): string[] {
  switch (category) {
    case 'bedroom':
      return ['bed', 'wardrobe']
    case 'living':
      return ['sofa', 'tv', 'lamp']
    case 'dining':
      return ['dining']
    case 'kitchen':
      return ['kitchen', 'fridge']
    case 'bathroom':
      return ['bath']
    case 'study':
      return ['desk']
    default:
      return []
  }
}

const SLOTS: [number, number][] = [
  [0, -0.38],
  [-0.38, 0],
  [0.38, 0],
  [0, 0.3],
  [-0.3, 0.32],
  [0.3, 0.32],
]

function FurniturePiece({ item, w, l, slot }: { item: string; w: number; l: number; slot: number }) {
  const [sx, sz] = SLOTS[slot % SLOTS.length]
  const x = sx * w
  const z = sz * l
  const wood = '#a9805a'
  const fabric = '#7d8ba1'

  if (item === 'bed') {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.14, 0]} castShadow>
          <boxGeometry args={[Math.min(w * 0.42, 0.85), 0.28, Math.min(l * 0.55, 1.1)]} />
          <meshStandardMaterial color="#e8e2d6" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.32, -Math.min(l * 0.55, 1.1) / 2 + 0.06]} castShadow>
          <boxGeometry args={[Math.min(w * 0.42, 0.85), 0.5, 0.08]} />
          <meshStandardMaterial color={wood} roughness={0.6} />
        </mesh>
      </group>
    )
  }
  if (item === 'sofa' || item === 'armchair') {
    const sw = item === 'sofa' ? Math.min(w * 0.5, 1.1) : 0.5
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.16, 0]} castShadow>
          <boxGeometry args={[sw, 0.32, 0.42]} />
          <meshStandardMaterial color={fabric} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.36, -0.17]} castShadow>
          <boxGeometry args={[sw, 0.4, 0.1]} />
          <meshStandardMaterial color={fabric} roughness={0.9} />
        </mesh>
      </group>
    )
  }
  if (item === 'dining') {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.36, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.05, 20]} />
          <meshStandardMaterial color={wood} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.05, 0.08, 0.36, 10]} />
          <meshStandardMaterial color={wood} />
        </mesh>
      </group>
    )
  }
  if (item === 'tv') {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.9, 0.4, 0.22]} />
          <meshStandardMaterial color={wood} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <boxGeometry args={[0.8, 0.45, 0.04]} />
          <meshStandardMaterial color="#101418" roughness={0.3} />
        </mesh>
      </group>
    )
  }
  if (item === 'wardrobe' || item === 'kitchen' || item === 'fridge') {
    const tall = item === 'fridge' ? 0.95 : 0.8
    const bw = item === 'kitchen' ? Math.min(w * 0.7, 1.4) : 0.7
    return (
      <mesh position={[x, tall / 2, z]} castShadow>
        <boxGeometry args={[bw, tall, 0.32]} />
        <meshStandardMaterial color={item === 'fridge' ? '#c9ced4' : wood} roughness={0.55} />
      </mesh>
    )
  }
  if (item === 'bath') {
    return (
      <mesh position={[x, 0.26, z]} castShadow>
        <boxGeometry args={[0.8, 0.52, 0.45]} />
        <meshStandardMaterial color="#ffffff" roughness={0.25} />
      </mesh>
    )
  }
  if (item === 'desk') {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.36, 0]} castShadow>
          <boxGeometry args={[0.8, 0.05, 0.4]} />
          <meshStandardMaterial color={wood} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <boxGeometry args={[0.7, 0.36, 0.3]} />
          <meshStandardMaterial color="#8f96a3" />
        </mesh>
      </group>
    )
  }
  if (item === 'chair') {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.22, 0]} castShadow><boxGeometry args={[0.34, 0.08, 0.34]} /><meshStandardMaterial color={wood} /></mesh>
        <mesh position={[0, 0.43, -0.14]} castShadow><boxGeometry args={[0.34, 0.42, 0.07]} /><meshStandardMaterial color={wood} /></mesh>
        {[[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]].map(([lx, lz], i) => <mesh key={i} position={[lx, 0.1, lz]}><boxGeometry args={[0.035, 0.2, 0.035]} /><meshStandardMaterial color={wood} /></mesh>)}
      </group>
    )
  }
  if (item === 'table') {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.36, 0]} castShadow><boxGeometry args={[0.72, 0.07, 0.48]} /><meshStandardMaterial color={wood} roughness={0.5} /></mesh>
        {[[-0.3, -0.18], [0.3, -0.18], [-0.3, 0.18], [0.3, 0.18]].map(([lx, lz], i) => <mesh key={i} position={[lx, 0.18, lz]}><boxGeometry args={[0.045, 0.36, 0.045]} /><meshStandardMaterial color={wood} /></mesh>)}
      </group>
    )
  }
  if (item === 'ac') {
    return <mesh position={[x, WALL_H * 0.74, z - l * 0.44]} castShadow><boxGeometry args={[0.55, 0.16, 0.18]} /><meshStandardMaterial color="#f6f7f8" roughness={0.4} /></mesh>
  }
  if (item === 'fan') {
    return (
      <group position={[x, WALL_H * 0.88, z]}>
        <mesh><cylinderGeometry args={[0.06, 0.06, 0.12, 12]} /><meshStandardMaterial color="#87919b" metalness={0.3} /></mesh>
        {[0, 1, 2, 3].map((i) => <mesh key={i} rotation={[0, i * Math.PI / 2, 0]} position={[0.28, 0, 0]}><boxGeometry args={[0.5, 0.025, 0.09]} /><meshStandardMaterial color="#d2d6da" /></mesh>)}
      </group>
    )
  }
  if (item === 'bulb') {
    return <mesh position={[x, WALL_H * 0.82, z]}><sphereGeometry args={[0.075, 14, 10]} /><meshStandardMaterial color="#fff0bd" emissive="#ffe092" emissiveIntensity={1.2} /></mesh>
  }
  if (item === 'lamp') {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
          <meshStandardMaterial color="#3a3f46" />
        </mesh>
        <mesh position={[0, 1.02, 0]}>
          <coneGeometry args={[0.14, 0.2, 12, 1, true]} />
          <meshStandardMaterial color="#f4e3c2" emissive="#f4e3c2" emissiveIntensity={0.5} side={2} />
        </mesh>
      </group>
    )
  }
  return null
}
