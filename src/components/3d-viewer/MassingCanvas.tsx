import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, TransformControls, Edges } from '@react-three/drei'
import { BackSide, type Mesh, type Object3D } from 'three'
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
            </mesh>
          )
        }),
      )}

      {ornaments.map((tree, index) => {
        const [tx, tz] = toWorld(tree.x, tree.y)
        return <Tree key={`t${index}`} position={[tx, 0, tz]} kind={tree.kind} />
      })}

      <Roof
        form={project.roof}
        y={topLevel * (WALL_H + SLAB)}
        width={plotW * S * 0.86}
        length={plotL * S * 0.86}
      />
    </>
  )
}

function Tree({ position, kind = 'palm' }: { position: [number, number, number]; kind?: string }) {
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
}: {
  rooms: Room[]
  selected: Room | null
  floorFinish: FinishOption
  placed: Record<string, string[]>
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

  if (!room) return null
  const w = room.width * S
  const l = room.length * S
  const items = placed[room.id] ?? []
  const effective = items.length > 0 ? items : defaultItemsFor(room.category)

  return (
    <>
      <color attach="background" args={['#eef0f3']} />
      <hemisphereLight args={['#ffffff', '#c9ccd2', 0.9]} />
      <pointLight position={[0, WALL_H * 0.82, 0]} intensity={1.5} distance={7} color="#fff4e0" />
      <directionalLight position={[2, 3, 2]} intensity={0.5} />

      {/* floor + ceiling */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, l]} />
        <meshStandardMaterial color={FLOOR_COLORS[floorFinish] ?? FLOOR_COLORS.wood} roughness={0.5} />
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
