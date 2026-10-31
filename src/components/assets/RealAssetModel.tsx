import { Component, Suspense, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import type { GLTF } from 'three-stdlib'
import { ASSET_LOOKUP } from '@/data/toolLibrary'
import { publicAssetUrl } from '@/data/assets'
import { retainAssetModel, releaseAssetModel } from '@/services/threeModelService'

const EMPTY = new Box3()

function getAsset(assetId: string) {
  const asset = ASSET_LOOKUP[assetId]
  return asset?.assetKind === 'model' && asset.modelUrl ? asset : null
}

/** A cache-backed imported GLTF, normalized to the saved footprint and height. */
export function RealAssetModel({ assetId, targetWorldSize, sourceWorldScale }: { assetId: string; targetWorldSize?: [number, number, number]; sourceWorldScale?: number }) {
  const asset = getAsset(assetId)
  if (!asset) return null
  return <Suspense fallback={<Html center><span className="rounded bg-white/90 px-2 py-1 text-[10px] text-slate-600">Loading model…</span></Html>}>
    <AssetErrorBoundary key={assetId}>
      <LoadedAssetModel assetId={assetId} url={publicAssetUrl(asset.modelUrl!)} targetWorldSize={targetWorldSize} sourceWorldScale={sourceWorldScale} />
    </AssetErrorBoundary>
  </Suspense>
}

function LoadedAssetModel({ assetId, url, targetWorldSize, sourceWorldScale }: { assetId: string; url: string; targetWorldSize?: [number, number, number]; sourceWorldScale?: number }) {
  const gltf = useGLTF(url)
  const { scene } = gltf
  useEffect(() => {
    retainAssetModel(assetId, gltf as GLTF, url)
    return () => releaseAssetModel(assetId)
  }, [assetId, gltf, url])
  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.updateMatrixWorld(true)
    const box = new Box3().setFromObject(clone)
    if (box.isEmpty()) return { clone, box: EMPTY.clone(), size: new Vector3(1, 1, 1) }
    const center = box.getCenter(new Vector3())
    clone.position.x -= center.x
    clone.position.y -= box.min.y
    clone.position.z -= center.z
    clone.updateMatrixWorld(true)
    return { clone, box, size: box.getSize(new Vector3()) }
  }, [scene])
  const source = model.size
  const scale: [number, number, number] = targetWorldSize
    ? [targetWorldSize[0] / Math.max(source.x, 1e-6), targetWorldSize[1] / Math.max(source.y, 1e-6), targetWorldSize[2] / Math.max(source.z, 1e-6)]
    : [sourceWorldScale ?? 1, sourceWorldScale ?? 1, sourceWorldScale ?? 1]
  useEffect(() => {
    model.clone.traverse((object) => {
      if ('isMesh' in object && object.isMesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
  }, [model])
  return <group scale={scale} userData={{ archNovaAssetId: assetId }}><primitive object={model.clone} dispose={null} /></group>
}

/** Neutral architectural product-render preview of the actual loaded source model. */
export function RealAssetPreview({ assetId, className = '' }: { assetId: string; className?: string }) {
  const asset = getAsset(assetId)
  if (!asset) return <div className={`flex items-center justify-center bg-slate-100 text-xs text-slate-500 ${className}`}>Model unavailable</div>
  return (
    <div className={`relative overflow-hidden bg-[#eef1f4] ${className}`}>
      <AssetErrorBoundary key={assetId}>
        <Canvas dpr={1} frameloop="demand" camera={{ position: [2.7, 2.1, 3.2], fov: 34 }} gl={{ antialias: true, alpha: false }}>
          <color attach="background" args={['#eef1f4']} />
          <hemisphereLight args={['#ffffff', '#9aa4ae', 1.6]} />
          <directionalLight position={[3, 5, 4]} intensity={2.1} />
          <directionalLight position={[-3, 2, -2]} intensity={0.45} />
          <Suspense fallback={<Html center><span className="rounded bg-white/90 px-2 py-1 text-[11px] text-slate-600">Loading model…</span></Html>}>
            <AssetErrorBoundary fallback={<Html center><span className="rounded bg-white px-2 py-1 text-[11px] font-medium text-red-700">Could not load this model</span></Html>}>
              <PreviewGeometry assetId={assetId} url={publicAssetUrl(asset.modelUrl!)} />
            </AssetErrorBoundary>
          </Suspense>
          <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 3.5} maxPolarAngle={Math.PI / 2.1} />
        </Canvas>
      </AssetErrorBoundary>
    </div>
  )
}

function PreviewGeometry({ assetId, url }: { assetId: string; url: string }) {
  const gltf = useGLTF(url)
  const { scene } = gltf
  useEffect(() => {
    retainAssetModel(assetId, gltf as GLTF, url)
    return () => releaseAssetModel(assetId)
  }, [assetId, gltf, url])
  const preview = useMemo(() => {
    const clone = scene.clone(true)
    clone.updateMatrixWorld(true)
    const box = new Box3().setFromObject(clone)
    if (box.isEmpty()) return { clone, scale: 1 }
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const largest = Math.max(size.x, size.y, size.z, 1e-6)
    clone.position.sub(new Vector3(center.x, center.y, center.z))
    return { clone, scale: 1.45 / largest }
  }, [scene])
  return <group scale={preview.scale}><primitive object={preview.clone} dispose={null} /></group>
}

export class AssetErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* The tile has a local fallback; other assets stay usable. */ }
  render() {
    if (this.state.failed) return this.props.fallback ?? <Html center><span className="rounded bg-white px-2 py-1 text-[11px] font-medium text-red-700">Model failed to load</span></Html>
    return this.props.children
  }
}

/** Avoid creating WebGL contexts and starting network requests for off-screen cards. */
export function LazyAssetPreview({ assetId, className = '' }: { assetId: string; className?: string }) {
  const [visible, setVisible] = useState(false)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!host || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      setVisible(entries.some((entry) => entry.isIntersecting))
    }, { rootMargin: '120px' })
    observer.observe(host)
    return () => observer.disconnect()
  }, [host])
  const asset = getAsset(assetId)
  return <div ref={setHost} role="img" aria-label={`${asset?.name ?? 'Imported asset'} 3D preview`} className={`overflow-hidden bg-[#eef1f4] ${className}`}>
    {visible ? <RealAssetPreview assetId={assetId} className="h-full w-full" /> : <div className="h-full w-full bg-gradient-to-br from-[#f5f7f9] to-[#e3e8ed]" />}
  </div>
}

/** Preload only known catalog IDs; it never accepts arbitrary model paths. */
export function preloadAssetModel(assetId: string): void {
  const asset = getAsset(assetId)
  if (asset) useGLTF.preload(publicAssetUrl(asset.modelUrl!))
}
