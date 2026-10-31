import { useGLTF } from '@react-three/drei'
import { GLTFLoader, type GLTF } from 'three-stdlib'
import type { Project } from '@/types'
import { ASSET_LOOKUP } from '@/data/toolLibrary'
import { publicAssetUrl } from '@/data/assets'

export interface ThreeModelService {
  isReady(): boolean
  /** Validate/load every distinct catalog GLTF referenced by a project. */
  loadModel(project: Project): Promise<boolean>
  /** Explicit release for projects/assets that are no longer in use. */
  release(assetId: string): void
  describe(): string
}

const loader = new GLTFLoader()
type LoadedModel = { url: string; promise: Promise<GLTF>; gltf?: GLTF; refs: number; disposeTimer?: ReturnType<typeof setTimeout> }
const loaded = new Map<string, LoadedModel>()

export function retainAssetModel(assetId: string, gltf: GLTF, url: string): void {
  const current = loaded.get(assetId)
  if (current?.disposeTimer) clearTimeout(current.disposeTimer)
  loaded.set(assetId, { url, promise: current?.promise ?? Promise.resolve(gltf), gltf, refs: (current?.refs ?? 0) + 1 })
}

function disposeGltf(gltf: GLTF): void {
  const disposed = new Set<unknown>()
  gltf.scene.traverse((object) => {
    if (!('isMesh' in object) || !object.isMesh) return
    const mesh = object as typeof object & { geometry?: { dispose: () => void }; material?: unknown }
    if (mesh.geometry && !disposed.has(mesh.geometry)) { mesh.geometry.dispose(); disposed.add(mesh.geometry) }
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const material of materials) {
      if (!material || typeof material !== 'object' || disposed.has(material)) continue
      const record = material as Record<string, unknown> & { dispose?: () => void }
      for (const [key, value] of Object.entries(record)) {
        if (value && typeof value === 'object' && 'isTexture' in value) {
          const texture = value as { dispose?: () => void }
          if (!disposed.has(texture)) { texture.dispose?.(); disposed.add(texture) }
        }
        void key
      }
      record.dispose?.()
      disposed.add(material)
    }
  })
}

function scheduleDisposal(assetId: string, record: LoadedModel): void {
  if (record.refs > 0) return
  if (record.disposeTimer) clearTimeout(record.disposeTimer)
  record.disposeTimer = setTimeout(() => {
    const latest = loaded.get(assetId)
    if (!latest || latest.refs > 0) return
    if (latest.gltf) disposeGltf(latest.gltf)
    // threeModelService and Drei's useGLTF have independent loader caches. Release
    // any preflight GLTF too, but never dispose the same scene/resources twice.
    void latest.promise.then((cached) => {
      if (cached !== latest.gltf) disposeGltf(cached)
    }).catch(() => { /* failed loads have no GPU resources to release */ })
    useGLTF.clear(latest.url)
    loaded.delete(assetId)
  }, 30_000)
}

export function releaseAssetModel(assetId: string): void {
  const current = loaded.get(assetId)
  if (!current) return
  current.refs = Math.max(0, current.refs - 1)
  scheduleDisposal(assetId, current)
}

async function loadAsset(assetId: string): Promise<GLTF> {
  const asset = ASSET_LOOKUP[assetId]
  if (!asset || asset.assetKind !== 'model' || !asset.modelUrl) throw new Error(`Unknown imported model ID: ${assetId}`)
  const url = publicAssetUrl(asset.modelUrl)
  const existing = loaded.get(assetId)
  if (existing) return existing.promise
  const promise = loader.loadAsync(url)
  loaded.set(assetId, { url, promise, refs: 0 })
  try {
    const gltf = await promise
    const record = loaded.get(assetId)
    if (record) scheduleDisposal(assetId, record)
    else disposeGltf(gltf)
    return gltf
  } catch (error) {
    loaded.delete(assetId)
    throw error
  }
}

function projectAssetIds(project: Project): string[] {
  const ids = new Set<string>()
  for (const floor of project.floors ?? []) for (const room of floor.rooms ?? []) for (const item of room.items ?? []) if (item.assetId) ids.add(item.assetId)
  for (const item of project.landscape ?? []) if (item.assetId) ids.add(item.assetId)
  return [...ids]
}

export const threeModelService: ThreeModelService = {
  isReady: () => true,
  async loadModel(project) {
    const ids = projectAssetIds(project)
    if (!ids.length) return false
    const results = await Promise.allSettled(ids.map(loadAsset))
    return results.some((result) => result.status === 'fulfilled')
  },
  release: releaseAssetModel,
  describe() {
    return 'Local GLTF catalog active: GLTFLoader, stable asset IDs, cached previews/placements, and deferred resource disposal.'
  },
}
