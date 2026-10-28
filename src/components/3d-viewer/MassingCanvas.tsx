import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { BackSide } from 'three'
import type { FinishOption, Project, Room } from '@/types'

/**
 * React Three Fiber scene for the massing preview.
 *
 * Split into its own module so the (large) three.js bundle is only loaded when
 * a 3D surface is actually mounted. Swap this scene for a GLTF-loaded model
 * when `@/services/threeModelService` gets a real implementation.
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

const FLAT_CATEGORIES = new Set(['garden', 'pool', 'circulation'])

export default function MassingCanvas({
  project,
  mode,
}: {
  project: Project
  mode: 'exterior' | 'interior'
}) {
  if (mode === 'interior') {
    return (
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 0.5, 0.01], fov: 70 }}>
        <InteriorScene rooms={project.floors.flatMap((floor) => floor.rooms)} />
        <OrbitControls enablePan={false} minDistance={0.01} maxDistance={6} />
      </Canvas>
    )
  }
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [5.4, 4.2, 6.4], fov: 42 }}>
      <ExteriorScene project={project} />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={2.5}
        maxDistance={16}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0.6, 0]}
      />
    </Canvas>
  )
}

function ExteriorScene({ project }: { project: Project }) {
  const { width: plotW, length: plotL } = project.plot
  const wallColor = WALL_COLORS[project.preferences.exteriorFinish] ?? WALL_COLORS.render
  const levels = project.floors.map((floor) => floor.level)
  const topLevel = Math.max(...levels, 1)

  const boxes = useMemo(
    () =>
      project.floors.flatMap((floor) =>
        floor.rooms.map((room) => {
          const flat = FLAT_CATEGORIES.has(room.category)
          const h = flat ? 0.05 : WALL_H
          return {
            key: room.id,
            position: [
              (room.rect.x + room.rect.w / 2 - plotW / 2) * S,
              (floor.level - 1) * (WALL_H + SLAB) + h / 2,
              (room.rect.y + room.rect.h / 2 - plotL / 2) * S,
            ] as [number, number, number],
            size: [room.rect.w * S, h, room.rect.h * S] as [number, number, number],
            color: flat
              ? room.category === 'pool'
                ? '#7fc4e8'
                : room.category === 'garden'
                  ? '#a9cf94'
                  : '#d8d5cd'
              : wallColor,
            flat,
          }
        }),
      ),
    [project.floors, plotW, plotL, wallColor],
  )

  const roofY = topLevel * (WALL_H + SLAB)
  const footW = plotW * S * 0.86
  const footL = plotL * S * 0.86

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

      {boxes.map((box) => (
        <mesh key={box.key} position={box.position} castShadow={!box.flat} receiveShadow>
          <boxGeometry args={box.size} />
          <meshStandardMaterial color={box.color} roughness={0.85} />
        </mesh>
      ))}

      <Roof form={project.roof} y={roofY} width={footW} length={footL} />
    </>
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

function InteriorScene({ rooms }: { rooms: Room[] }) {
  const room = useMemo(() => {
    const candidates = rooms.filter((r) => r.category === 'living' || r.category === 'bedroom')
    const pool = candidates.length > 0 ? candidates : rooms
    return pool.reduce<Room | null>(
      (best, r) => (!best || r.width * r.length > best.width * best.length ? r : best),
      null,
    )
  }, [rooms])

  if (!room) return null
  const w = room.width * S
  const l = room.length * S

  return (
    <>
      <color attach="background" args={['#f2f4f7']} />
      <hemisphereLight args={['#ffffff', '#c9ccd2', 1.1]} />
      <pointLight position={[0, WALL_H * 0.7, 0]} intensity={1.4} distance={6} />
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, l]} />
        <meshStandardMaterial color="#c9a97f" roughness={0.6} />
      </mesh>
      <mesh position={[0, WALL_H / 2, 0]}>
        <boxGeometry args={[w, WALL_H, l]} />
        <meshStandardMaterial color="#efece4" side={BackSide} />
      </mesh>
    </>
  )
}
