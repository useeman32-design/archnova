import { useMemo, useState } from 'react'
import {
  Armchair, Bath, BedDouble, Box, Car, CookingPot, Fence, Flower2, Frame, Grid, Grid3x3, Home,
  Lamp, Laptop, Layers, Monitor, Mountain, Package, Plane, Refrigerator, Search, Sofa, Sprout,
  Square, TreePalm, TreePine, Trees, Utensils, UtensilsCrossed, X, Plus, type LucideIcon,
} from 'lucide-react'
import { ASSETS, ASSET_CATEGORIES, publicAssetUrl, type AssetCategory, type AssetItem } from '@/data/assets'
import { variantFromAsset } from '@/data/toolLibrary'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/Feedback'
import { LazyAssetPreview, RealAssetPreview } from './RealAssetModel'

const ICONS: Record<string, LucideIcon> = {
  Frame, Grid3x3, Layers, Home, Car, Fence, Square, Mountain, Plane, Grid, Sofa, Armchair, BedDouble,
  Utensils, Box, Monitor, Laptop, UtensilsCrossed, Refrigerator, Lamp, Bath, TreePalm, TreePine,
  Sprout, Flower2, Trees, CookingPot,
}

function AssetTile({ asset }: { asset: AssetItem }) {
  if (asset.assetKind === 'model') return <LazyAssetPreview assetId={asset.id} className="h-28 w-full rounded-lg" />
  if (asset.assetKind === 'material' && asset.materialMaps?.color) {
    return <div className="relative h-28 overflow-hidden rounded-lg border border-line-soft bg-[#edf0f2]">
      <img src={publicAssetUrl(asset.materialMaps.color)} alt={`${asset.name} PBR color map`} className="h-full w-full object-cover" loading="lazy" />
      <span className="absolute bottom-1.5 left-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">PBR maps</span>
    </div>
  }
  const Icon = ICONS[asset.icon] ?? Package
  return <div className="flex h-28 items-center justify-center rounded-lg border border-line-soft bg-gradient-to-br from-[#f6f8fb] to-[#e8edf2]"><Icon className="h-8 w-8 text-ink-500" strokeWidth={1.6} /></div>
}

export function AssetsView({ onAdd }: { onAdd?: (asset: AssetItem) => void }) {
  const [category, setCategory] = useState<AssetCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ASSETS.filter((asset) => {
      const inCategory = category === 'all' || asset.category === category
      const inQuery = !q || `${asset.name} ${asset.tags.join(' ')} ${asset.author ?? ''} ${asset.sourceAssetId ?? ''}`.toLowerCase().includes(q)
      return inCategory && inQuery
    })
  }, [category, query])
  const activeBlurb = ASSET_CATEGORIES.find((c) => c.value === category)?.blurb

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-1.5">
          {ASSET_CATEGORIES.map((cat) => <button key={cat.value} onClick={() => setCategory(cat.value)} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${category === cat.value ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25' : 'bg-surface text-muted ring-1 ring-line hover:text-ink-text'}`}>{cat.label}</button>)}
        </div>
        <div className="relative md:ml-auto md:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets…" className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-[13px] text-ink-text placeholder:text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" aria-label="Search assets" />
        </div>
      </div>

      <p className="mb-4 text-[12.5px] text-muted">{activeBlurb}</p>
      {filtered.length === 0 ? <EmptyState icon={<Package className="h-5 w-5" />} title="No assets match" description="Try another category or clear the search." /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((asset) => {
            const placeable = Boolean(variantFromAsset(asset))
            return <article key={asset.id} className="group overflow-hidden rounded-xl border border-line bg-surface p-2.5 shadow-sm transition-shadow hover:shadow-md">
              <button type="button" className="block w-full text-left" onClick={() => setPreviewAsset(asset)} aria-label={`Preview ${asset.name}`}>
                <AssetTile asset={asset} />
                <div className="mt-2.5 flex items-start justify-between gap-2 px-0.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink-text">{asset.name}</p>
                    <p className="truncate text-[10.5px] text-faint">{asset.assetKind === 'model' ? `${asset.polycount?.toLocaleString() ?? 'GLTF'} triangles · ${asset.author ?? 'Poly Haven'}` : asset.assetKind === 'material' ? `${asset.tags[0]} · PBR · CC0` : 'Editable parametric system'}</p>
                  </div>
                  <Badge tone={asset.assetKind === 'model' ? 'brand' : asset.assetKind === 'material' ? 'success' : 'neutral'}>{asset.assetKind === 'model' ? '3D' : asset.assetKind === 'material' ? 'PBR' : 'Parametric'}</Badge>
                </div>
              </button>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-line-soft px-0.5 pt-2">
                <p className="truncate text-[10px] text-faint">{asset.tags.slice(0, 3).join(' · ')}</p>
                {onAdd && (placeable || asset.assetKind === 'material') ? <button onClick={() => onAdd(asset)} title={asset.assetKind === 'material' ? 'Apply material to the design preview' : 'Place in project'} aria-label={`${asset.assetKind === 'material' ? 'Apply' : 'Place'} ${asset.name}`} className="flex h-7 shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2 text-[11px] font-medium text-white shadow-sm hover:bg-brand-700"><Plus className="h-3.5 w-3.5" />{asset.assetKind === 'material' ? 'Apply' : 'Place'}</button> : <Badge tone="neutral">Preview</Badge>}
              </div>
            </article>
          })}
        </div>
      )}

      <div className="mt-5 space-y-2 rounded-xl border border-dashed border-line bg-canvas-soft/50 px-4 py-3 text-[12px] leading-relaxed text-muted">
        <p><strong className="text-ink-text">Starter library:</strong> {ASSETS.filter((asset) => asset.assetKind === 'model').length} locally bundled, MD5-verified CC0 glTF models and {ASSETS.filter((asset) => asset.assetKind === 'material').length} PBR material sets. Model previews render the actual local GLTF files in a consistent neutral product stage.</p>
        <p><strong className="text-ink-text">Coverage gaps:</strong> the library still lacks a contemporary full-size bed and wardrobe, refrigerator, sink/toilet fixtures, a sedan/SUV, and a palm or mature species-diverse tree set. The imported day bed and dining table have vintage/worn styling, so they are not presented as contemporary options.</p>
        <p>Imported assets are courtesy credited as <strong className="text-ink-text">Powered by Poly Haven</strong>. Per-asset source, author, license, dimensions and checksum are recorded in the local manifest.</p>
      </div>

      {previewAsset ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label={`${previewAsset.name} preview`} onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewAsset(null) }}>
        <section className="grid max-h-[min(88vh,820px)] w-full max-w-4xl grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)] md:grid-rows-[1fr_auto]">
          <div className="relative min-h-[300px] bg-[#eef1f4] md:row-span-2 md:min-h-[480px]">
            <button onClick={() => setPreviewAsset(null)} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow" aria-label="Close preview"><X className="h-4 w-4" /></button>
            {previewAsset.assetKind === 'model' ? <RealAssetPreview assetId={previewAsset.id} className="h-full min-h-[300px] w-full md:min-h-[480px]" /> : previewAsset.assetKind === 'material' && previewAsset.materialMaps?.color ? <img src={publicAssetUrl(previewAsset.materialMaps.color)} className="h-full min-h-[300px] w-full object-cover md:min-h-[480px]" alt={`${previewAsset.name} color map`} /> : <div className="flex h-full min-h-[300px] items-center justify-center text-slate-500">Editable parametric system</div>}
          </div>
          <div className="overflow-y-auto p-5">
            <div className="mb-2 flex flex-wrap gap-1.5"><Badge tone="brand">{previewAsset.assetKind === 'model' ? 'Imported 3D model' : previewAsset.assetKind === 'material' ? 'Imported PBR material' : 'Parametric editor system'}</Badge>{previewAsset.license ? <Badge tone="success">{previewAsset.license}</Badge> : null}</div>
            <h2 className="text-lg font-semibold text-ink-text">{previewAsset.name}</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">{previewAsset.author ? `Author: ${previewAsset.author}. ` : ''}{previewAsset.source ? `Source: ${previewAsset.source}. ` : ''}{previewAsset.sourceAssetId ? `Source ID: ${previewAsset.sourceAssetId}.` : ''}</p>
            {previewAsset.dimensionsM ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-[12px] text-slate-700">Source dimensions (approx.): {previewAsset.dimensionsM.map((n) => `${n.toFixed(2)} m`).join(' × ')}</p> : null}
            {previewAsset.modelUrl ? <p className="mt-3 break-all text-[10.5px] text-slate-500">Local model: {publicAssetUrl(previewAsset.modelUrl)}</p> : null}
            {previewAsset.materialMaps ? <div className="mt-3 text-[11px] text-slate-600">Maps: {Object.keys(previewAsset.materialMaps).join(', ')}</div> : null}
            {previewAsset.sourceUrl ? <a className="mt-3 inline-block text-[12px] font-medium text-blue-700 underline" href={previewAsset.sourceUrl} target="_blank" rel="noreferrer">Open source record</a> : null}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4 md:col-start-2">
            <button onClick={() => setPreviewAsset(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-[12px] font-medium text-slate-700">Close</button>
            {onAdd && (variantFromAsset(previewAsset) || previewAsset.assetKind === 'material') ? <button onClick={() => { onAdd(previewAsset); setPreviewAsset(null) }} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-[12px] font-medium text-white hover:bg-brand-700"><Plus className="h-4 w-4" />{previewAsset.assetKind === 'material' ? 'Apply material' : 'Place model'}</button> : null}
          </div>
        </section>
      </div> : null}
    </div>
  )
}
