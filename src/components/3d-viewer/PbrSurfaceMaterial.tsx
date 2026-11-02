import { Suspense, useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { REAL_MATERIALS } from '@/data/realAssets'
import { publicAssetUrl } from '@/data/assets'
import type { FinishOption } from '@/types'

const MATERIAL_ID_BY_FINISH: Partial<Record<FinishOption, string>> = {
  render: 'ph_material_plaster_grey_04',
  paint: 'ph_material_plaster_grey_04',
  concrete: 'ph_material_brushed_concrete',
  brick: 'ph_material_red_brick',
  wood: 'ph_material_american_walnut_veneer',
  stone: 'ph_material_stone_pavers',
  metal: 'ph_material_corrugated_iron',
}

export const SITE_PBR_ID = {
  asphalt: 'ph_material_asphalt_01',
  paving: 'ph_material_interlocking_concrete_pavers',
  grass: 'ph_material_grass_ground',
  grassPavers: 'ph_material_grass_concrete_pavement',
}

export function pbrIdForRoof(form: string): string {
  if (form === 'shed') return 'ph_material_corrugated_iron'
  if (form === 'pitched-gable' || form === 'hip' || form === 'mansard') return 'ph_material_roof_tiles'
  return 'ph_material_brushed_concrete'
}

export function pbrIdForFinish(finish: FinishOption): string | null {
  return MATERIAL_ID_BY_FINISH[finish] ?? null
}

/** Real local PBR maps, cloned per surface so UV repetition and disposal are isolated. */
export function PbrSurfaceMaterial({ materialId, repeat = 2, roughness = 0.88, metalness = 0, color = '#ffffff' }: {
  materialId: string
  repeat?: number
  roughness?: number
  metalness?: number
  color?: string
}) {
  const asset = REAL_MATERIALS.find((candidate) => candidate.id === materialId)
  const paths = asset?.materialMaps
  if (!paths?.color) return <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
  return <Suspense fallback={<meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />}><LoadedPbrMaterial colorPath={publicAssetUrl(paths.color)} normalPath={paths.normal ? publicAssetUrl(paths.normal) : undefined} roughnessPath={paths.roughness ? publicAssetUrl(paths.roughness) : undefined} metalnessPath={paths.metalness ? publicAssetUrl(paths.metalness) : undefined} repeat={repeat} roughness={roughness} metalness={metalness} color={color} /></Suspense>
}

function LoadedPbrMaterial({ colorPath, normalPath, roughnessPath, metalnessPath, repeat, roughness, metalness, color }: {
  colorPath: string
  normalPath?: string
  roughnessPath?: string
  metalnessPath?: string
  repeat: number
  roughness: number
  metalness: number
  color: string
}) {
  const loaded = useTexture([colorPath, normalPath ?? colorPath, roughnessPath ?? colorPath, metalnessPath ?? colorPath]) as Texture[]
  const maps = useMemo(() => loaded.map((texture) => texture.clone()), [loaded])
  useEffect(() => {
    maps[0].colorSpace = SRGBColorSpace
    maps[1].colorSpace = 'srgb-linear'
    maps[2].colorSpace = 'srgb-linear'
    maps[3].colorSpace = 'srgb-linear'
    for (const texture of maps) {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(repeat, repeat)
      texture.needsUpdate = true
    }
    return () => maps.forEach((texture) => texture.dispose())
  }, [maps, repeat])
  return <meshStandardMaterial map={maps[0]} normalMap={normalPath ? maps[1] : null} roughnessMap={roughnessPath ? maps[2] : null} metalnessMap={metalnessPath ? maps[3] : null} color={color} roughness={roughness} metalness={metalnessPath ? 0.6 : metalness} />
}
