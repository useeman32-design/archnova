import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, TransformControls, Edges } from '@react-three/drei'
import { CanvasTexture, DoubleSide, ExtrudeGeometry, RepeatWrapping, SRGBColorSpace, Shape, type Mesh, type Object3D } from 'three'
import type { ArchitecturalWall, Building, FinishOption, LandscapeItem, PlacedItem, Project, Room, SiteBoundary, SiteVertex, WallOpening } from '@/types'
import { getFloorArchitecturalModel, wallLength, wallSolidSections, type WallThicknessSettings } from '@/lib/architecturalModel'
import { canonicalFurnitureKey, getFurnitureDimensions } from '@/lib/furniture'
import { pointInPolygon } from '@/lib/siteGeometry'
import { RealAssetModel } from '@/components/assets/RealAssetModel'
import { PbrSurfaceMaterial, pbrIdForFinish, SITE_PBR_ID } from '@/components/3d-viewer/PbrSurfaceMaterial'
import { REAL_MODELS } from '@/data/realAssets'

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
  tile: '#dad8d0',
  marble: '#e5e1d8',
  concrete: '#aeb1b3',
  carpet: '#8a8790',
  terrazzo: '#d4d0c7',
  metal: '#87929a',
}

export const FLOOR_COLORS: Record<FinishOption, string> = {
  render: '#d9d4c9',
  paint: '#e4ded2',
  brick: '#b98d6f',
  stone: '#cfc8b8',
  wood: '#c9a97f',
  glass: '#d7e2e8',
  tile: '#ddd9cf',
  marble: '#e9e4da',
  concrete: '#bebfbd',
  carpet: '#85818b',
  terrazzo: '#d7d2c8',
  metal: '#b6bdc3',
}

const FLAT_CATEGORIES = new Set(['garden', 'pool', 'circulation'])

export interface MassingCanvasProps {
  project: Project
  mode: 'exterior' | 'interior'
  roofVisible?: boolean
  topDown?: boolean
  selectedId?: string | null
  onSelectRoom?: (id: string | null) => void
  transformMode?: 'translate' | 'scale'
  onMoveLive?: (id: string, x: number, y: number) => void
  onResizeLive?: (id: string, w: number, h: number) => void
  onEditBegin?: () => void
  onEditEnd?: () => void
  ornaments?: LandscapeItem[]
  placed?: Record<string, PlacedItem[]>
  selectedItemId?: string | null
  onSelectItem?: (id: string | null) => void
  onUpdatePlacedItem?: (roomId: string, itemId: string, patch: Partial<PlacedItem>) => void
  selectedSiteId?: string | null
  onSelectSite?: (id: string | null) => void
  onUpdateSiteLive?: (id: string, x: number, y: number, scale: number) => void
  pendingItem?: string | null
  pendingAssetId?: string | null
  onPlaceInterior?: (item: string, assetId?: string) => void
}

export default function MassingCanvas(props: MassingCanvasProps) {
  const orbitRef = useRef<any>(null)
  const meshRefs = useRef(new Map<string, Mesh>())
  const itemRefs = useRef(new Map<string, Object3D>())
  const siteRefs = useRef(new Map<string, Object3D>())
  const [selectedSiteObj, setSelectedSiteObj] = useState<Object3D | null>(null)
  const [selectedObj, setSelectedObj] = useState<Object3D | null>(null)
  const [selectedItemObj, setSelectedItemObj] = useState<Object3D | null>(null)
  const baseSize = useRef<{ w: number; h: number } | null>(null)
  const { project, mode, selectedId, onSelectRoom, transformMode = 'translate' } = props
  const roofVisible = props.roofVisible ?? true
  const topDown = props.topDown ?? false

  useEffect(() => {
    setSelectedObj(selectedId ? (meshRefs.current.get(selectedId) ?? null) : null)
  }, [selectedId])

  const rooms = useMemo(() => project.floors.flatMap((floor) => floor.rooms), [project.floors])
  const siteBounds = useMemo(() => {
    const points: { x: number; y: number }[] = rooms.flatMap((room) => [
      { x: room.rect.x, y: room.rect.y }, { x: room.rect.x + room.rect.w, y: room.rect.y + room.rect.h },
    ])
    for (const building of project.buildings ?? []) if (building.role !== 'primary') points.push(...(building.footprint?.vertices ?? []))
    for (const site of props.ornaments ?? []) {
      const width = (site.width ?? 3) * site.scale, length = (site.length ?? 3) * site.scale
      const halfW = Math.abs(Math.cos(site.rotation)) * width / 2 + Math.abs(Math.sin(site.rotation)) * length / 2
      const halfL = Math.abs(Math.sin(site.rotation)) * width / 2 + Math.abs(Math.cos(site.rotation)) * length / 2
      points.push({ x: site.x - halfW, y: site.y - halfL }, { x: site.x + halfW, y: site.y + halfL })
    }
    if (!points.length) return { minX: 0, minY: 0, maxX: project.plot.width, maxY: project.plot.length }
    return {
      minX: Math.min(0, ...points.map((point) => point.x)), minY: Math.min(0, ...points.map((point) => point.y)),
      maxX: Math.max(project.plot.width, ...points.map((point) => point.x)), maxY: Math.max(project.plot.length, ...points.map((point) => point.y)),
    }
  }, [rooms, project.buildings, project.plot.width, project.plot.length, props.ornaments])
  const sceneTarget = useMemo<[number, number, number]>(() => [
    ((siteBounds.minX + siteBounds.maxX) / 2 - project.plot.width / 2) * S,
    0.6,
    ((siteBounds.minY + siteBounds.maxY) / 2 - project.plot.length / 2) * S,
  ], [siteBounds, project.plot.width, project.plot.length])
  const sceneWidth = Math.max(project.plot.width, siteBounds.maxX - siteBounds.minX)
  const sceneLength = Math.max(project.plot.length, siteBounds.maxY - siteBounds.minY)
  const selectedRoom = rooms.find((r) => r.id === selectedId) ?? null

  useEffect(() => {
    setSelectedItemObj(props.selectedItemId ? (itemRefs.current.get(props.selectedItemId) ?? null) : null)
  }, [props.selectedItemId, props.placed, mode])

  useEffect(() => {
    setSelectedSiteObj(props.selectedSiteId ? (siteRefs.current.get(props.selectedSiteId) ?? null) : null)
  }, [props.selectedSiteId, props.ornaments])

  const handleSiteTransform = () => {
    const obj = selectedSiteObj
    if (!obj || !props.selectedSiteId) return
    props.onUpdateSiteLive?.(
      props.selectedSiteId,
      obj.position.x / S + project.plot.width / 2,
      obj.position.z / S + project.plot.length / 2,
      Math.max(0.35, Math.min(4, obj.scale.x)),
    )
  }

  const handleFurnitureTransform = () => {
    const obj = selectedItemObj
    if (!obj || !selectedRoom || !props.selectedItemId) return
    props.onUpdatePlacedItem?.(selectedRoom.id, props.selectedItemId, {
      x: Math.max(-0.45, Math.min(0.45, obj.position.x / Math.max(selectedRoom.width * S, 0.1))),
      z: Math.max(-0.45, Math.min(0.45, obj.position.z / Math.max(selectedRoom.length * S, 0.1))),
    })
  }

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
      camera={mode === 'interior' ? { position: [0, 0.5, 0.01], fov: 70 } : { position: [sceneTarget[0] + 5.4, 4.2, sceneTarget[2] + 6.4], fov: 42 }}
      onPointerMissed={() => { onSelectRoom?.(null); props.onSelectSite?.(null); props.onSelectItem?.(null) }}
    >
      <CameraController mode={mode} topDown={topDown} target={sceneTarget} plotWidth={sceneWidth} plotLength={sceneLength} orbitRef={orbitRef} />
      {mode === 'interior' ? (
        <InteriorScene
          rooms={rooms}
          selected={selectedRoom}
          floorFinish={project.preferences.interiorFinish}
          wallThicknesses={{
            exterior: project.preferences.exteriorWallThickness ?? (project.plot.units === 'ft' ? 0.75 : 0.23),
            interior: project.preferences.interiorWallThickness ?? (project.plot.units === 'ft' ? 0.375 : 0.12),
          }}
          placed={props.placed ?? {}}
          itemRefs={itemRefs}
          selectedItemId={props.selectedItemId ?? null}
          onSelectItem={props.onSelectItem}
          pendingItem={props.pendingItem ?? null}
          pendingAssetId={props.pendingAssetId ?? null}
          onPlaceInterior={props.onPlaceInterior}
        />
      ) : (
        <ExteriorScene
          project={project}
          selectedId={selectedId ?? null}
          onSelectRoom={onSelectRoom}
          meshRefs={meshRefs}
          itemRefs={itemRefs}
          siteRefs={siteRefs}
          selectedSiteId={props.selectedSiteId ?? null}
          onSelectSite={props.onSelectSite}
          ornaments={props.ornaments ?? []}
          placed={props.placed ?? {}}
          selectedItemId={props.selectedItemId ?? null}
          onSelectItem={props.onSelectItem}
          roofVisible={roofVisible}
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

      {mode === 'exterior' && selectedSiteObj && props.selectedSiteId ? (
        <TransformControls
          object={selectedSiteObj}
          mode={transformMode}
          showY={false}
          size={0.65}
          onMouseDown={() => { if (orbitRef.current) orbitRef.current.enabled = false; props.onEditBegin?.() }}
          onMouseUp={() => { if (orbitRef.current) orbitRef.current.enabled = true; props.onEditEnd?.() }}
          onObjectChange={handleSiteTransform}
        />
      ) : null}

      {(mode === 'interior' || (mode === 'exterior' && topDown)) && selectedItemObj && selectedRoom ? (
        <TransformControls
          object={selectedItemObj}
          mode="translate"
          showY={false}
          size={0.55}
          onMouseDown={() => {
            if (orbitRef.current) orbitRef.current.enabled = false
            props.onEditBegin?.()
          }}
          onMouseUp={() => {
            if (orbitRef.current) orbitRef.current.enabled = true
            props.onEditEnd?.()
          }}
          onObjectChange={handleFurnitureTransform}
        />
      ) : null}

      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={mode === 'interior' ? 0.01 : 2.5}
        maxDistance={mode === 'interior' ? 6 : Math.max(16, Math.max(project.plot.width, project.plot.length) * S * 2)}
        maxPolarAngle={mode === 'interior' ? Math.PI : Math.PI / 2.05}
        target={mode === 'interior' ? [0, 0.5, 0] : sceneTarget}
      />
    </Canvas>
  )
}

/* ------------------------------------------------------------------ */

function CameraController({ mode, topDown, target, plotWidth, plotLength, orbitRef }: { mode: 'exterior' | 'interior'; topDown: boolean; target: [number, number, number]; plotWidth: number; plotLength: number; orbitRef: React.MutableRefObject<any> }) {
  const { camera } = useThree()
  const cameraPose = useRef('')
  useEffect(() => {
    const poseKey = `${mode}:${mode === 'exterior' && topDown ? 'top' : 'normal'}:${plotWidth}:${plotLength}`
    if (cameraPose.current === poseKey) return
    cameraPose.current = poseKey
    if (mode === 'interior') {
      camera.up.set(0, 1, 0)
      camera.position.set(0, 0.5, 0.01)
      camera.lookAt(0, 0.5, 0)
    } else if (topDown) {
      const distance = Math.max(8, Math.min(48, Math.max(plotWidth, plotLength) * S * 1.35))
      camera.up.set(0, 0, -1)
      camera.position.set(target[0], distance, target[2] + 0.01)
      camera.lookAt(target[0], 0, target[2])
    } else {
      camera.up.set(0, 1, 0)
      camera.position.set(target[0] + 5.4, 4.2, target[2] + 6.4)
      camera.lookAt(target[0], 0.6, target[2])
    }
    camera.updateProjectionMatrix()
    if (orbitRef.current) {
      orbitRef.current.target.set(...(mode === 'interior' ? [0, 0.5, 0] : target))
      orbitRef.current.update()
    }
  }, [camera, mode, topDown, target, plotWidth, plotLength, orbitRef])
  return null
}

function ExteriorScene({
  project,
  selectedId,
  onSelectRoom,
  meshRefs,
  itemRefs,
  siteRefs,
  selectedSiteId,
  onSelectSite,
  ornaments,
  placed,
  selectedItemId,
  onSelectItem,
  roofVisible,
}: {
  project: Project
  selectedId: string | null
  onSelectRoom?: (id: string | null) => void
  meshRefs: React.MutableRefObject<Map<string, Mesh>>
  itemRefs: React.MutableRefObject<Map<string, Object3D>>
  siteRefs: React.MutableRefObject<Map<string, Object3D>>
  selectedSiteId: string | null
  onSelectSite?: (id: string | null) => void
  ornaments: LandscapeItem[]
  placed: Record<string, PlacedItem[]>
  selectedItemId: string | null
  onSelectItem?: (id: string | null) => void
  roofVisible: boolean
}) {
  const { width: plotW, length: plotL } = project.plot
  const wallThicknesses = {
    exterior: project.preferences.exteriorWallThickness ?? (project.plot.units === 'ft' ? 0.75 : 0.23),
    interior: project.preferences.interiorWallThickness ?? (project.plot.units === 'ft' ? 0.375 : 0.12),
  }
  const wallTexture = useMemo(() => makeFloorTexture(project.preferences.exteriorFinish, plotW * S, plotL * S), [project.preferences.exteriorFinish, plotW, plotL])
  const boundaryShape = useMemo(() => {
    const vertices = project.site?.boundary?.vertices ?? []
    return project.site?.boundary?.status !== 'unknown' && vertices.length >= 3 ? makeSiteShape(vertices, plotW, plotL, S) : null
  }, [project.site?.boundary?.vertices, project.site?.boundary?.status, plotW, plotL])
  useEffect(() => () => wallTexture.dispose(), [wallTexture])
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
      {boundaryShape ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
          <shapeGeometry args={[boundaryShape]} />
          <meshStandardMaterial color="#e8efd9" roughness={0.98} side={DoubleSide} />
          <Edges color="#0f766e" threshold={1} />
        </mesh>
      ) : null}
      {(project.buildings ?? []).filter((building) => building.role !== 'primary' && (building.footprint?.vertices.length ?? 0) >= 3).map((building) => <SiteBuildingMass key={building.id} building={building} plotWidth={plotW} plotLength={plotL} siteBoundary={project.site?.boundary} />)}

      {project.floors.flatMap((floor) =>
        floor.rooms.map((room) => {
          const flat = FLAT_CATEGORIES.has(room.category)
          const [wx, wz] = toWorld(room.rect.x + room.rect.w / 2, room.rect.y + room.rect.h / 2)
          const floorY = (floor.level - 1) * (WALL_H + SLAB) + 0.012
          const isSelected = room.id === selectedId
          const floorShape = makeRoomShape(room, S)
          const floorColor = room.finishColor ?? (room.category === 'pool' ? '#7fc4e8' : room.category === 'garden' ? '#a9cf94' : '#d8d5cd')
          return (
            <mesh
              key={`room-floor-${room.id}`}
              ref={(mesh) => {
                if (mesh) meshRefs.current.set(room.id, mesh)
                else meshRefs.current.delete(room.id)
              }}
              position={[wx, floorY, wz]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
              onClick={onSelectRoom ? (event: ThreeEvent<MouseEvent>) => {
                event.stopPropagation()
                onSelectRoom(room.id === selectedId ? null : room.id)
              } : undefined}
            >
              <shapeGeometry args={[floorShape]} />
              <meshStandardMaterial color={floorColor} roughness={flat ? 0.92 : 0.78} />
              {isSelected ? <Edges color="#1a56f5" /> : null}
            </mesh>
          )
        }),
      )}

      {project.floors.flatMap((floor) => {
        const model = getFloorArchitecturalModel(floor.rooms, floor.walls, floor.openings, wallThicknesses)
        return model.walls.map((wall) => (
          <ExteriorWall
            key={wall.id}
            wall={wall}
            openings={model.openings.filter((opening) => opening.wallId === wall.id)}
            plotWidth={plotW}
            plotLength={plotL}
            wallTexture={wallTexture}
            wallColor={project.preferences.exteriorColor ?? '#ffffff'}
            exteriorFinish={project.preferences.exteriorFinish}
          />
        ))
      })}

      {project.floors.flatMap((floor) => floor.rooms.filter((room) => !FLAT_CATEGORIES.has(room.category)).map((room) => {
        const items = placed[room.id] ?? room.items ?? []
        const [cx, cz] = toWorld(room.rect.x + room.rect.w / 2, room.rect.y + room.rect.h / 2)
        const floorY = (floor.level - 1) * (WALL_H + SLAB) + 0.03
        return <group key={`top-items-${room.id}`} position={[cx, floorY, cz]}>
          {items.map((item) => {
            const defaults = getFurnitureDimensions(item.item, room.units)
            const height = item.height ?? defaults.height
            const ceilingMounted = REAL_MODELS.some((asset) => asset.id === item.assetId && asset.placement === 'ceiling')
            return <group
              key={item.id}
              ref={(obj) => { if (obj) itemRefs.current.set(item.id, obj); else itemRefs.current.delete(item.id) }}
              position={[item.x * room.rect.w * S, ceilingMounted ? WALL_H - height * S : 0, item.z * room.rect.h * S]}
              rotation={[0, item.rotation, 0]}
              scale={item.scale}
              onClick={(event) => { event.stopPropagation(); onSelectItem?.(item.id) }}
            >
              {item.assetId
                ? <RealAssetModel assetId={item.assetId} targetWorldSize={[(item.width ?? defaults.width) * S, (item.height ?? defaults.height) * S, (item.depth ?? defaults.depth) * S]} />
                : <FurniturePiece item={item.item} width={item.width ?? defaults.width} depth={item.depth ?? defaults.depth} height={item.height ?? defaults.height} color={item.color} />}
              {selectedItemId === item.id ? <Edges color="#1a56f5" /> : null}
            </group>
          })}
        </group>
      }))}

      {ornaments.map((site) => {
        const [sx, sz] = toWorld(site.x, site.y)
        const scaledWidth = (site.width ?? 3) * site.scale, scaledLength = (site.length ?? 3) * site.scale
        const halfW = Math.abs(Math.cos(site.rotation)) * scaledWidth / 2 + Math.abs(Math.sin(site.rotation)) * scaledLength / 2
        const halfL = Math.abs(Math.sin(site.rotation)) * scaledWidth / 2 + Math.abs(Math.cos(site.rotation)) * scaledLength / 2
        const footprintCorners = [{ x: -halfW, y: -halfL }, { x: halfW, y: -halfL }, { x: halfW, y: halfL }, { x: -halfW, y: halfL }].map((point) => ({ x: site.x + point.x, y: site.y + point.y }))
        const boundaryVertices = project.site?.boundary && project.site.boundary.status !== 'unknown' ? project.site.boundary.vertices : []
        const overflow = footprintCorners.some((point) => point.x < 0 || point.y < 0 || point.x > plotW || point.y > plotL)
          || (boundaryVertices.length >= 3 && footprintCorners.some((point) => !pointInPolygon(point, boundaryVertices)))
        return <group key={site.id} ref={(obj) => { if (obj) siteRefs.current.set(site.id, obj); else siteRefs.current.delete(site.id) }} position={[sx, 0, sz]} rotation={[0, site.rotation, 0]} scale={site.scale} onClick={(event) => { event.stopPropagation(); onSelectSite?.(site.id) }}>
          {site.id === selectedSiteId ? <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}><ringGeometry args={[0.28, 0.34, 28]} /><meshBasicMaterial color="#1a56f5" /></mesh> : null}
          <SiteObject kind={site.kind} assetId={site.assetId} sourceWorldScale={S * (project.plot.units === 'ft' ? 3.28084 : 1)} color={site.color} width={(site.width ?? 3) * S} length={(site.length ?? 3) * S} />
          {overflow ? <mesh position={[0, 0.05, 0]}><boxGeometry args={[(site.width ?? 3) * S + 0.12, 0.06, (site.length ?? 3) * S + 0.12]} /><meshBasicMaterial color="#dc2626" transparent opacity={0} /><Edges color="#dc2626" threshold={2} /></mesh> : null}
        </group>
      })}

      {buildingBounds && roofVisible ? (
        <group position={[(buildingBounds.minX + buildingBounds.maxX - plotW) * S / 2, 0, (buildingBounds.minY + buildingBounds.maxY - plotL) * S / 2]}>
          <Roof form={project.roof} y={topLevel * (WALL_H + SLAB) + 0.08} width={(buildingBounds.maxX - buildingBounds.minX) * S * 1.08} length={(buildingBounds.maxY - buildingBounds.minY) * S * 1.08} color={project.preferences.roofColor} />
        </group>
      ) : null}
    </>
  )
}

function SiteBuildingMass({ building, plotWidth, plotLength, siteBoundary }: { building: Building; plotWidth: number; plotLength: number; siteBoundary?: SiteBoundary }) {
  const footprint = building.footprint
  const height = Math.max(1, building.floors.length) * (WALL_H + SLAB)
  const geometry = useMemo(() => {
    const vertices = footprint?.vertices ?? []
    if (vertices.length < 3) return null
    const shape = new Shape()
    vertices.forEach((point, index) => {
      const x = (point.x - plotWidth / 2) * S
      const y = -(point.y - plotLength / 2) * S
      if (index === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
    shape.closePath()
    return new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 })
  }, [footprint, plotWidth, plotLength, height])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  const vertices = footprint?.vertices ?? []
  const boundaryVertices = siteBoundary && siteBoundary.status !== 'unknown' ? siteBoundary.vertices : []
  const overflow = vertices.some((point) => point.x < 0 || point.y < 0 || point.x > plotWidth || point.y > plotLength)
    || (boundaryVertices.length >= 3 && vertices.some((point) => !pointInPolygon(point, boundaryVertices)))
  const color = overflow ? '#fecaca' : building.role === 'service' ? '#e6c59a' : building.role === 'other' ? '#cbd5e1' : '#b8c7e0'
  const edgeColor = overflow ? '#dc2626' : building.role === 'service' ? '#9a5b16' : '#425c82'
  return <mesh geometry={geometry} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
    <meshStandardMaterial color={color} roughness={0.82} />
    <Edges color={edgeColor} threshold={8} />
  </mesh>
}

function ExteriorWall({
  wall,
  openings,
  plotWidth,
  plotLength,
  wallTexture,
  wallColor,
  exteriorFinish,
}: {
  wall: ArchitecturalWall
  openings: WallOpening[]
  plotWidth: number
  plotLength: number
  wallTexture: CanvasTexture
  wallColor: string
  exteriorFinish: FinishOption
}) {
  const length = wallLength(wall)
  if (length <= 0) return null
  const scale = S
  const startX = (wall.start.x - plotWidth / 2) * scale
  const startZ = (wall.start.y - plotLength / 2) * scale
  const endX = (wall.end.x - plotWidth / 2) * scale
  const endZ = (wall.end.y - plotLength / 2) * scale
  const midX = (startX + endX) / 2
  const midZ = (startZ + endZ) / 2
  const angle = -Math.atan2(endZ - startZ, endX - startX)
  const baseY = (wall.level - 1) * (WALL_H + SLAB)
  const height = Math.min(WALL_H, wall.height * scale)
  const thickness = wall.thickness * scale
  const validOpenings = openings
.filter((opening) => opening.offset >= 0 && opening.width > 0 && opening.offset + opening.width <= length && opening.sillHeight >= 0 && opening.sillHeight + opening.height <= height / scale)
    .sort((a, b) => a.offset - b.offset)
  const pbrMaterialId = wall.kind === 'exterior' ? pbrIdForFinish(exteriorFinish) : null
  const sections = wallSolidSections({ ...wall, height: height / scale }, validOpenings)

  return (
    <group position={[midX, baseY, midZ]} rotation={[0, angle, 0]}>
      {sections.map((part, index) => (
        <mesh key={`wall-${wall.id}-${index}`} position={[(part.offsetStart + part.offsetEnd) * scale / 2 - length * scale / 2, (part.elevationStart + part.elevationEnd) * scale / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[(part.offsetEnd - part.offsetStart) * scale, (part.elevationEnd - part.elevationStart) * scale, thickness]} />
          {pbrMaterialId
            ? <PbrSurfaceMaterial materialId={pbrMaterialId} repeat={2.4} color={wallColor} />
            : wall.kind === 'exterior'
              ? <meshStandardMaterial map={wallTexture} color={wallColor} roughness={exteriorFinish === 'metal' ? 0.32 : exteriorFinish === 'glass' ? 0.18 : 0.82} metalness={exteriorFinish === 'metal' ? 0.48 : 0} />
              : <meshStandardMaterial color="#e4e0d6" roughness={0.86} />}
        </mesh>
      ))}
      {validOpenings.map((opening) => (
        <OpeningFixture key={opening.id} opening={opening} wallThickness={thickness} wallLength={length} />
      ))}
    </group>
  )
}

function InteriorArchitecturalWall({ wall, openings, room, color }: { wall: ArchitecturalWall; openings: WallOpening[]; room: Room; color: string }) {
  const length = wallLength(wall)
  if (length <= 0) return null
  const cx = room.rect.x + room.rect.w / 2
  const cy = room.rect.y + room.rect.h / 2
  const ax = (wall.start.x - cx) * S
  const az = (wall.start.y - cy) * S
  const bx = (wall.end.x - cx) * S
  const bz = (wall.end.y - cy) * S
  const midX = (ax + bx) / 2
  const midZ = (az + bz) / 2
  const angle = -Math.atan2(bz - az, bx - ax)
  const height = Math.min(WALL_H, wall.height * S)
  const thickness = Math.max(0.035, wall.thickness * S)
  const validOpenings = openings.filter((opening) => opening.offset >= 0 && opening.width > 0 && opening.offset + opening.width <= length && opening.sillHeight >= 0 && opening.sillHeight + opening.height <= height / S).sort((a, b) => a.offset - b.offset)
  const sections = wallSolidSections({ ...wall, height: height / S }, validOpenings)
  return (
    <group position={[midX, 0, midZ]} rotation={[0, angle, 0]}>
      {sections.map((part, index) => (
        <mesh key={index} position={[(part.offsetStart + part.offsetEnd) * S / 2 - length * S / 2, (part.elevationStart + part.elevationEnd) * S / 2, 0]} receiveShadow>
          <boxGeometry args={[(part.offsetEnd - part.offsetStart) * S, (part.elevationEnd - part.elevationStart) * S, thickness]} />
          <meshStandardMaterial color={color} roughness={0.86} />
        </mesh>
      ))}
      {validOpenings.map((opening) => <OpeningFixture key={opening.id} opening={opening} wallThickness={thickness} wallLength={length} />)}
    </group>
  )
}

function OpeningFixture({ opening, wallThickness, wallLength }: { opening: WallOpening; wallThickness: number; wallLength: number }) {
  const scale = S
  const width = opening.width * scale
  const height = opening.height * scale
  const sill = opening.type === 'door' ? 0 : opening.sillHeight * scale
  if (opening.type === 'door') {
    const split = opening.style === 'double-hinged' || opening.style === 'sliding' || opening.style === 'folding'
    const leafWidth = split ? width / 2 : width
    const leaves = split ? [-1, 1] : [0]
    return (
      <group position={[(opening.offset + opening.width / 2 - wallLength / 2) * scale, height / 2, 0]}>
        {leaves.map((side) => (
          <group key={side} position={[split ? side * width / 4 : 0, 0, opening.style === 'sliding' ? side * wallThickness * 0.2 : 0]}>
            <mesh castShadow>
              <boxGeometry args={[leafWidth - (split ? 0.012 : 0), height, Math.max(0.025, wallThickness * 0.55)]} />
              <meshStandardMaterial color={opening.color ?? '#8a6a48'} roughness={0.62} />
            </mesh>
            {split ? <mesh position={[side * leafWidth * 0.38, 0, wallThickness * 0.3]}><sphereGeometry args={[0.012, 8, 6]} /><meshStandardMaterial color="#d4b46c" metalness={0.65} roughness={0.28} /></mesh> : null}
          </group>
        ))}
      </group>
    )
  }

  const glass = <meshStandardMaterial color={opening.color ?? '#9fd4ee'} transparent opacity={0.76} metalness={0.12} roughness={0.18} />
  const frame = <meshStandardMaterial color="#f5f4ee" />
  if (opening.style === 'bay') {
    const panelWidth = width * 0.38
    return (
      <group position={[(opening.offset + opening.width / 2 - wallLength / 2) * scale, sill + height / 2, 0]}>
        <mesh><boxGeometry args={[panelWidth, height, wallThickness * 0.35]} />{glass}</mesh>
        <mesh position={[-width * 0.32, 0, -wallThickness * 0.25]} rotation={[0, -0.45, 0]}><boxGeometry args={[panelWidth, height, wallThickness * 0.3]} />{glass}</mesh>
        <mesh position={[width * 0.32, 0, -wallThickness * 0.25]} rotation={[0, 0.45, 0]}><boxGeometry args={[panelWidth, height, wallThickness * 0.3]} />{glass}</mesh>
        {[-width * 0.18, width * 0.18].map((x) => <mesh key={x} position={[x, 0, wallThickness * 0.3]}><boxGeometry args={[0.018, height, 0.012]} />{frame}</mesh>)}
      </group>
    )
  }
  return (
    <group position={[(opening.offset + opening.width / 2 - wallLength / 2) * scale, sill + height / 2, 0]}>
      <mesh><boxGeometry args={[width, height, Math.max(0.025, wallThickness * 0.45)]} />{glass}</mesh>
      <mesh position={[0, height / 2, wallThickness * 0.32]}><boxGeometry args={[width, 0.018, 0.012]} />{frame}</mesh>
      <mesh position={[0, -height / 2, wallThickness * 0.32]}><boxGeometry args={[width, 0.018, 0.012]} />{frame}</mesh>
      {opening.style === 'casement' || opening.style === 'sliding' ? <mesh position={[0, 0, wallThickness * 0.32]}><boxGeometry args={[0.018, height, 0.012]} />{frame}</mesh> : null}
    </group>
  )
}

function makeSiteShape(vertices: SiteVertex[], plotWidth: number, plotLength: number, scale: number): Shape {
  const points = vertices.map((vertex) => ({
    x: (vertex.x - plotWidth / 2) * scale,
    y: (plotLength / 2 - vertex.y) * scale,
  }))
  const shape = new Shape()
  shape.moveTo(points[0].x, points[0].y)
  for (const point of points.slice(1)) shape.lineTo(point.x, point.y)
  shape.closePath()
  return shape
}

function makeRoomShape(room: Room, scale: number): Shape {
  const outline = room.outline && room.outline.length >= 3
    ? room.outline
    : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
  const points = outline.map((point) => ({
    x: (point.x - 0.5) * room.rect.w * scale,
    y: (0.5 - point.y) * room.rect.h * scale,
  }))
  const shape = new Shape()
  shape.moveTo(points[0].x, points[0].y)
  for (const point of points.slice(1)) shape.lineTo(point.x, point.y)
  shape.closePath()
  return shape
}

function SiteObject({ kind = 'palm', assetId, sourceWorldScale = 1, color, width, length }: { kind?: string; assetId?: string; sourceWorldScale?: number; color: string; width: number; length: number }) {
  if (assetId) return <RealAssetModel assetId={assetId} sourceWorldScale={sourceWorldScale} />
  if (kind === 'road' || kind === 'path') return <group>
    <mesh position={[0, 0.012, 0]} receiveShadow><boxGeometry args={[width, 0.022, length]} /><PbrSurfaceMaterial materialId={kind === 'road' ? SITE_PBR_ID.asphalt : SITE_PBR_ID.paving} repeat={4} roughness={0.92} color={kind === 'road' ? '#ffffff' : '#e7e4dd'} /></mesh>
    {kind === 'road' ? <mesh position={[0, 0.025, 0]}><boxGeometry args={[0.025, 0.004, length * 0.78]} /><meshStandardMaterial color="#e6d89e" /></mesh> : null}
  </group>
  if (kind === 'fence') {
    const height = 0.85
    const count = Math.max(2, Math.floor(length / 0.45))
    return <group>
      {Array.from({ length: count + 1 }, (_, index) => <mesh key={`post-${index}`} position={[0, height / 2, -length / 2 + length * index / count]} castShadow><boxGeometry args={[Math.max(width, 0.035), height, Math.max(width, 0.035)]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>)}
      {[height * 0.32, height * 0.78].map((y) => <mesh key={y} position={[0, y, 0]} castShadow><boxGeometry args={[Math.max(width, 0.04) * 1.3, 0.07, length]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>)}
    </group>
  }
  if (kind === 'gate') return <group>
    {[-1, 1].map((side) => <mesh key={side} position={[side * width * 0.25, 0.48, 0]} castShadow><boxGeometry args={[width * 0.49, 0.9, Math.max(length, 0.06)]} /><meshStandardMaterial color={color} metalness={0.15} roughness={0.55} /></mesh>)}
    {Array.from({ length: 8 }, (_, index) => <mesh key={`bar-${index}`} position={[-width * 0.48 + width * index / 7, 0.48, 0.01]}><boxGeometry args={[0.025, 0.82, Math.max(length, 0.065)]} /><meshStandardMaterial color="#d8d0c2" metalness={0.45} /></mesh>)}
  </group>
  if (kind === 'street-light') return <group>
    <mesh position={[0, 0.48, 0]} castShadow><cylinderGeometry args={[0.018, 0.035, 0.96, 8]} /><meshStandardMaterial color="#4c5561" metalness={0.65} roughness={0.35} /></mesh>
    <mesh position={[width * 0.6, 0.96, 0]} rotation={[0, 0, -0.5]}><boxGeometry args={[width * 1.5, 0.035, 0.04]} /><meshStandardMaterial color="#59636f" metalness={0.55} /></mesh>
    <mesh position={[width * 1.25, 0.91, 0]}><sphereGeometry args={[0.055, 10, 8]} /><meshStandardMaterial color="#fff0a3" emissive="#ffcf56" emissiveIntensity={0.7} /></mesh>
  </group>
  if (kind === 'car') return <group>
    <mesh position={[0, 0.14, 0]} castShadow><boxGeometry args={[width, 0.26, length]} /><meshStandardMaterial color={color} metalness={0.18} roughness={0.45} /></mesh>
    <mesh position={[0, 0.29, -length * 0.03]} castShadow><boxGeometry args={[width * 0.72, 0.19, length * 0.43]} /><meshStandardMaterial color="#8eb4c8" roughness={0.25} /></mesh>
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * width * 0.48, 0.08, z * length * 0.32]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.055, 0.055, 0.04, 12]} /><meshStandardMaterial color="#20252b" /></mesh>))}
  </group>
  return <Tree position={[0, 0, 0]} kind={kind} color={color} />
}

function Tree({ position, kind = 'palm', color = '#4f8a3f' }: { position: [number, number, number]; kind?: string; color?: string }) {
  if (kind === 'car') {
    return (
      <group position={position}>
        <mesh position={[0, 0.16, 0]} castShadow><boxGeometry args={[0.52, 0.18, 0.28]} /><meshStandardMaterial color={color} metalness={0.18} roughness={0.45} /></mesh>
        <mesh position={[0, 0.27, -0.01]} castShadow><boxGeometry args={[0.28, 0.16, 0.24]} /><meshStandardMaterial color="#8eb4c8" roughness={0.25} /></mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * 0.17, 0.07, z * 0.12]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.055, 0.055, 0.035, 12]} /><meshStandardMaterial color="#20252b" /></mesh>))}
      </group>
    )
  }
  if (kind === 'person') {
    return (
      <group position={position}>
        <mesh position={[0, 0.24, 0]} castShadow><capsuleGeometry args={[0.055, 0.25, 4, 8]} /><meshStandardMaterial color={color} /></mesh>
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
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      ) : kind === 'shrub' || kind === 'flower' ? (
        <mesh position={[0, trunkH + 0.08, 0]} castShadow>
          <sphereGeometry args={[0.14, 12, 10]} />
          <meshStandardMaterial color={color} roughness={0.9} />
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

function Roof({ form, y, width, length, color = '#33415c' }: { form: string; y: number; width: number; length: number; color?: string }) {
  const rise = Math.min(width, length) * 0.32

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
      <mesh position={[0, y + rise / 2 + 0.08, 0]} rotation={[0, Math.PI / 4, 0]} scale={[width * 0.72, 1, length * 0.72]} castShadow>
        <coneGeometry args={[1, rise, 4]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    )
  }
  if (form === 'shed') {
    return (
      <mesh position={[0, y + Math.sin(0.28) * length / 2 + 0.08, 0]} rotation={[0.28, 0, 0]} castShadow>
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
  wallThicknesses,
  placed,
  itemRefs,
  selectedItemId,
  onSelectItem,
  pendingItem,
  pendingAssetId,
  onPlaceInterior,
}: {
  rooms: Room[]
  selected: Room | null
  floorFinish: FinishOption
  wallThicknesses: WallThicknessSettings
  placed: Record<string, PlacedItem[]>
  itemRefs: React.MutableRefObject<Map<string, Object3D>>
  selectedItemId: string | null
  onSelectItem?: (id: string | null) => void
  pendingItem: string | null
  pendingAssetId: string | null
  onPlaceInterior?: (item: string, assetId?: string) => void
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
  const roomModel = useMemo(() => getFloorArchitecturalModel(rooms, undefined, undefined, wallThicknesses), [rooms, wallThicknesses])
  const roomWalls = room ? roomModel.walls.filter((wall) => wall.roomIds.includes(room.id)) : []
  const roomFloorShape = useMemo(() => room ? makeRoomShape(room, S) : null, [room?.id, room?.rect.w, room?.rect.h, room?.outline])
  const floorTexture = useMemo(() => room ? makeFloorTexture(finish, w, l) : null, [room?.id, finish, w, l])
  useEffect(() => () => floorTexture?.dispose(), [floorTexture])

  if (!room || !roomFloorShape) return null
  const items = placed[room.id] ?? room.items ?? []
  const hasCeilingFixture = items.some((item) => REAL_MODELS.some((asset) => asset.id === item.assetId && asset.placement === 'ceiling'))

  return (
    <>
      <color attach="background" args={['#eef0f3']} />
      <hemisphereLight args={['#ffffff', '#c9ccd2', 0.9]} />
      <pointLight position={[0, WALL_H * 0.82, 0]} intensity={1.5} distance={7} color="#fff4e0" />
      <directionalLight position={[2, 3, 2]} intensity={0.5} />

      {/* Floor is lifted a hair above the datum; walls are separate meshes, so no coplanar shell can flicker through it. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.004, 0]}
        receiveShadow
        onClick={(event) => {
          if (!pendingItem) return
          event.stopPropagation()
          onPlaceInterior?.(pendingItem, pendingAssetId ?? undefined)
        }}
      >
        <shapeGeometry args={[roomFloorShape]} />
        {pbrIdForFinish(finish)
          ? <PbrSurfaceMaterial materialId={pbrIdForFinish(finish)!} repeat={2.2} color={room.finishColor ?? '#ffffff'} />
          : <meshStandardMaterial map={floorTexture ?? undefined} color={room.finishColor ?? '#ffffff'} roughness={finish === 'marble' || finish === 'glass' ? 0.18 : finish === 'tile' ? 0.28 : finish === 'carpet' ? 0.96 : 0.72} metalness={finish === 'metal' ? 0.45 : 0} />}
      </mesh>
      {!hasCeilingFixture ? <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H + 0.006, 0]}>
        <shapeGeometry args={[roomFloorShape]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.9} side={2} />
      </mesh> : null}

      {/* The room cutaway uses the same wall/opening graph as the 2D plan and exterior model. */}
      {roomWalls.map((wall) => (
        <InteriorArchitecturalWall
          key={wall.id}
          wall={wall}
          openings={roomModel.openings.filter((opening) => opening.wallId === wall.id)}
          room={room}
          color={room.finishColor ?? '#efece4'}
        />
      ))}

      {/* Skirting remains clear of the floor face. */}
      <mesh position={[0, 0.035, -l / 2 + 0.053]}><boxGeometry args={[w - 0.1, 0.045, 0.025]} /><meshStandardMaterial color="#ffffff" /></mesh>

      {items.map((placedItem) => {
        const defaults = getFurnitureDimensions(placedItem.item, room.units)
        return (
          <group
            key={placedItem.id}
            ref={(obj) => {
              if (obj) itemRefs.current.set(placedItem.id, obj)
              else itemRefs.current.delete(placedItem.id)
            }}
            position={[placedItem.x * w, 0, placedItem.z * l]}
            rotation={[0, placedItem.rotation, 0]}
            scale={placedItem.scale}
            onClick={(event) => { event.stopPropagation(); onSelectItem?.(placedItem.id) }}
          >
            <FurniturePiece item={placedItem.item} width={placedItem.width ?? defaults.width} depth={placedItem.depth ?? defaults.depth} height={placedItem.height ?? defaults.height} color={placedItem.color} />
            {selectedItemId === placedItem.id ? <Edges color="#1a56f5" /> : null}
          </group>
        )
      })}
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
  } else if (finish === 'stone' || finish === 'glass' || finish === 'tile' || finish === 'metal') {
    ctx.strokeStyle = finish === 'glass' ? 'rgba(81,126,151,.28)' : 'rgba(92,99,105,.24)'
    ctx.lineWidth = 2
    for (let y = 0; y <= 256; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke() }
    for (let x = 0; x <= 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke() }
    if (finish === 'glass') {
      ctx.fillStyle = 'rgba(255,255,255,.18)'
      ctx.fillRect(8, 8, 42, 42)
    }
  } else if (finish === 'marble') {
    ctx.strokeStyle = 'rgba(104,117,128,.25)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(10, 38); ctx.bezierCurveTo(70, 72, 110, 15, 246, 65); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(8, 190); ctx.bezierCurveTo(90, 130, 150, 230, 250, 175); ctx.stroke()
  } else if (finish === 'terrazzo') {
    for (let i = 0; i < 90; i++) {
      const x = (i * 73) % 256, y = (i * 127) % 256
      ctx.fillStyle = ['#aeb3b1', '#c98f73', '#697985', '#e6c796'][i % 4]
      ctx.fillRect(x, y, 3 + (i % 4), 2 + (i % 3))
    }
  } else if (finish === 'carpet') {
    for (let i = 0; i < 256; i += 3) {
      ctx.strokeStyle = `rgba(255,255,255,${(i % 7) / 70})`
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke()
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

function FurniturePiece({ item, width, depth, height, color = '#a9805a' }: { item: string; width: number; depth: number; height: number; color?: string }) {
  const key = canonicalFurnitureKey(item)
  const w = Math.max(0.08, width * S)
  const d = Math.max(0.08, depth * S)
  const h = Math.max(0.08, height * S)
  const leg = Math.max(0.025, Math.min(w, d) * 0.08)
  const topThickness = Math.max(0.035, h * 0.08)
  const wood = color
  const fabric = color

  if (key === 'bed' || key === 'king-bed') return (
    <group>
      <mesh position={[0, h * 0.23, 0]} castShadow><boxGeometry args={[w, h * 0.28, d]} /><meshStandardMaterial color="#e8e2d6" roughness={0.82} /></mesh>
      <mesh position={[0, h * 0.48, -d * 0.47]} castShadow><boxGeometry args={[w, h * 0.78, h * 0.08]} /><meshStandardMaterial color={wood} roughness={0.65} /></mesh>
      {[-0.24, 0.24].map((x) => <mesh key={x} position={[w * x, h * 0.42, -d * 0.29]}><boxGeometry args={[w * 0.38, h * 0.16, d * 0.22]} /><meshStandardMaterial color="#fff" roughness={0.95} /></mesh>)}
    </group>
  )
  if (key === 'sofa' || key === 'armchair') return (
    <group>
      <mesh position={[0, h * 0.28, d * 0.05]} castShadow><boxGeometry args={[w, h * 0.48, d * 0.68]} /><meshStandardMaterial color={fabric} roughness={0.9} /></mesh>
      <mesh position={[0, h * 0.62, -d * 0.28]} castShadow><boxGeometry args={[w * 0.92, h * 0.55, d * 0.18]} /><meshStandardMaterial color={fabric} roughness={0.92} /></mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * w * 0.45, h * 0.38, d * 0.02]} castShadow><boxGeometry args={[w * 0.1, h * 0.42, d * 0.72]} /><meshStandardMaterial color={fabric} roughness={0.9} /></mesh>)}
    </group>
  )
  if (key === 'dining' || key === 'table' || key === 'coffee-table' || key === 'desk' || key === 'sideboard') return (
    <group>
      <mesh position={[0, h * 0.72, 0]} castShadow><boxGeometry args={[w, topThickness, d]} /><meshStandardMaterial color={wood} roughness={0.55} /></mesh>
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}:${z}`} position={[x * (w / 2 - leg), h * 0.36, z * (d / 2 - leg)]} castShadow><boxGeometry args={[leg, h * 0.72, leg]} /><meshStandardMaterial color={wood} /></mesh>))}
    </group>
  )
  if (key === 'chair') return (
    <group>
      <mesh position={[0, h * 0.42, 0]} castShadow><boxGeometry args={[w, h * 0.1, d]} /><meshStandardMaterial color={wood} /></mesh>
      <mesh position={[0, h * 0.72, -d * 0.43]} castShadow><boxGeometry args={[w, h * 0.55, leg * 1.4]} /><meshStandardMaterial color={wood} /></mesh>
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}:${z}`} position={[x * w * 0.4, h * 0.2, z * d * 0.4]}><boxGeometry args={[leg, h * 0.4, leg]} /><meshStandardMaterial color={wood} /></mesh>))}
    </group>
  )
  if (key === 'fridge') return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial color={color === '#a9805a' ? '#c9ced4' : color} metalness={0.18} roughness={0.36} /></mesh>
      <mesh position={[w * 0.33, h * 0.55, d / 2 + 0.006]}><boxGeometry args={[leg * 0.35, h * 0.45, 0.012]} /><meshStandardMaterial color="#67717b" metalness={0.5} /></mesh>
      <mesh position={[0, h * 0.38, d / 2 + 0.008]}><boxGeometry args={[w * 0.98, 0.018, 0.012]} /><meshStandardMaterial color="#87919a" /></mesh>
    </group>
  )
  if (key === 'wardrobe' || key === 'kitchen' || key === 'cabinets' || key === 'bookshelf' || key === 'storage-rack') return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial color={wood} roughness={0.65} /></mesh>
      {[0.25, 0.5, 0.75].map((fraction) => <mesh key={fraction} position={[0, h * fraction, 0]}><boxGeometry args={[w * 0.94, 0.025, d * 0.96]} /><meshStandardMaterial color="#d7c8b5" /></mesh>)}
      <mesh position={[0, h / 2, d / 2 + 0.006]}><boxGeometry args={[0.018, h * 0.9, 0.012]} /><meshStandardMaterial color="#6f5a43" /></mesh>
    </group>
  )
  if (key === 'sink' || key === 'washbasin') return (
    <group>
      <mesh position={[0, h * 0.32, 0]} castShadow><boxGeometry args={[w, h * 0.12, d]} /><meshStandardMaterial color="#f8f8f4" roughness={0.28} /></mesh>
      <mesh position={[0, h * 0.44, 0]}><boxGeometry args={[w * 0.72, h * 0.08, d * 0.66]} /><meshStandardMaterial color="#fff" roughness={0.25} /></mesh>
      <mesh position={[0, h * 0.48, 0]}><cylinderGeometry args={[Math.min(w, d) * 0.05, Math.min(w, d) * 0.05, h * 0.12, 10]} /><meshStandardMaterial color="#8798a3" metalness={0.55} roughness={0.25} /></mesh>
    </group>
  )
  if (key === 'cooker') return (
    <group>
      <mesh position={[0, h * 0.45, 0]} castShadow><boxGeometry args={[w, h * 0.9, d]} /><meshStandardMaterial color="#c9ced4" metalness={0.2} roughness={0.34} /></mesh>
      {[[-0.23, -0.22], [0.23, -0.22], [-0.23, 0.22], [0.23, 0.22]].map(([x, z], index) => <mesh key={index} position={[w * x, h * 0.91, d * z]}><cylinderGeometry args={[Math.min(w, d) * 0.13, Math.min(w, d) * 0.13, 0.018, 16]} /><meshStandardMaterial color="#33383e" /></mesh>)}
    </group>
  )
  if (key === 'toilet') return (
    <group>
      <mesh position={[0, h * 0.28, d * 0.08]} castShadow scale={[1, 0.75, 1]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#fafaf6" roughness={0.25} /></mesh>
      <mesh position={[0, h * 0.67, -d * 0.32]} castShadow><boxGeometry args={[w * 0.76, h * 0.48, d * 0.32]} /><meshStandardMaterial color="#fff" roughness={0.25} /></mesh>
      <mesh position={[0, h * 0.51, d * 0.08]}><torusGeometry args={[Math.min(w, d) * 0.29, Math.min(w, d) * 0.035, 8, 20]} /><meshStandardMaterial color="#dfe3e5" /></mesh>
    </group>
  )
  if (key === 'shower') return (
    <group>
      <mesh position={[0, h * 0.04, 0]}><boxGeometry args={[w, h * 0.08, d]} /><meshStandardMaterial color="#e8edf0" /></mesh>
      <mesh position={[-w * 0.45, h * 0.5, 0]}><boxGeometry args={[0.018, h, d]} /><meshStandardMaterial color="#c4dbe6" transparent opacity={0.38} /></mesh>
      <mesh position={[0, h * 0.92, -d * 0.35]}><cylinderGeometry args={[0.025, 0.025, d * 0.25, 8]} /><meshStandardMaterial color="#8997a1" metalness={0.55} /></mesh>
    </group>
  )
  if (key === 'bath') return (
    <group>
      <mesh position={[0, h * 0.28, 0]} castShadow><boxGeometry args={[w, h * 0.52, d]} /><meshStandardMaterial color="#f8f8f4" roughness={0.25} /></mesh>
      <mesh position={[0, h * 0.55, 0]}><boxGeometry args={[w * 0.78, h * 0.04, d * 0.72]} /><meshStandardMaterial color="#dceef4" /></mesh>
    </group>
  )
  if (key === 'tv-unit' || key === 'tv') return (
    <group>
      <mesh position={[0, h * 0.18, 0]} castShadow><boxGeometry args={[w, h * 0.36, d]} /><meshStandardMaterial color={wood} roughness={0.64} /></mesh>
      <mesh position={[0, h * 0.76, 0]}><boxGeometry args={[w * 0.9, h * 0.48, Math.max(0.025, d * 0.06)]} /><meshStandardMaterial color="#151a21" roughness={0.3} /></mesh>
    </group>
  )
  if (key === 'washer' || key === 'dryer') return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial color="#d9dfe3" metalness={0.12} roughness={0.35} /></mesh>
      <mesh position={[0, h * 0.44, d / 2 + 0.006]}><cylinderGeometry args={[Math.min(w, d) * 0.27, Math.min(w, d) * 0.27, 0.015, 24]} /><meshStandardMaterial color="#53616d" metalness={0.18} roughness={0.25} /></mesh>
    </group>
  )
  return (
    <mesh position={[0, h / 2, 0]} castShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={wood} roughness={0.7} />
    </mesh>
  )
}
