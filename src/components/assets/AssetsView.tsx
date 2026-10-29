import { useMemo, useState } from 'react'
import {
  Armchair,
  Bath,
  BedDouble,
  Box,
  Car,
  Fence,
  Flower2,
  Frame,
  Grid,
  Grid3x3,
  Home,
  Lamp,
  Layers,
  Laptop,
  Monitor,
  Mountain,
  Package,
  Plane,
  Refrigerator,
  Search,
  Sofa,
  Sprout,
  Square,
  TreePalm,
  TreePine,
  Trees,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { ASSETS, ASSET_CATEGORIES, type AssetCategory } from '@/data/assets'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/Feedback'

const ICONS: Record<string, LucideIcon> = {
  Frame,
  Grid3x3,
  Layers,
  Home,
  Car,
  Fence,
  Square,
  Mountain,
  Plane,
  Grid,
  Sofa,
  Armchair,
  BedDouble,
  Utensils,
  Box,
  Monitor,
  Laptop,
  UtensilsCrossed,
  Refrigerator,
  Lamp,
  Bath,
  TreePalm,
  TreePine,
  Sprout,
  Flower2,
  Trees,
}

function AssetTile({ icon, swatch }: { icon: string; swatch?: string }) {
  const Icon = ICONS[icon] ?? Package
  return (
    <div
      className="relative flex h-24 items-center justify-center rounded-lg border border-line-soft"
      style={{
        background: swatch
          ? `linear-gradient(135deg, ${swatch} 0%, ${swatch}cc 55%, #ffffff 130%)`
          : 'linear-gradient(160deg, #f6f8fb 0%, #eef1f6 100%)',
      }}
    >
      <Icon className={`h-8 w-8 ${swatch ? 'text-white/90 drop-shadow' : 'text-ink-500'}`} strokeWidth={1.6} />
    </div>
  )
}

export function AssetsView() {
  const [category, setCategory] = useState<AssetCategory | 'all'>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ASSETS.filter((asset) => {
      const inCategory = category === 'all' || asset.category === category
      const inQuery =
        !q ||
        asset.name.toLowerCase().includes(q) ||
        asset.tags.some((tag) => tag.toLowerCase().includes(q))
      return inCategory && inQuery
    })
  }, [category, query])

  const activeBlurb = ASSET_CATEGORIES.find((c) => c.value === category)?.blurb

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-1.5">
          {ASSET_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                category === cat.value
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                  : 'bg-surface text-muted ring-1 ring-line hover:text-ink-text'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="relative md:ml-auto md:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search assets…"
            className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-[13px] text-ink-text placeholder:text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            aria-label="Search assets"
          />
        </div>
      </div>

      <p className="mb-4 text-[12.5px] text-muted">{activeBlurb}</p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="No assets match"
          description="Try another category or clear the search."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((asset) => (
            <article
              key={asset.id}
              className="group overflow-hidden rounded-xl border border-line bg-surface p-2.5 shadow-sm transition-shadow hover:shadow-md"
            >
              <AssetTile icon={asset.icon} swatch={asset.swatch} />
              <div className="mt-2.5 flex items-start justify-between gap-2 px-0.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink-text">{asset.name}</p>
                  <p className="truncate text-[11px] text-faint">{asset.tags.join(' · ')}</p>
                </div>
                <Badge tone="neutral">Preview</Badge>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mt-5 rounded-xl border border-dashed border-line bg-canvas-soft/50 px-4 py-3 text-[12px] leading-relaxed text-muted">
        The asset library is a catalogue preview in this prototype. 3D models (GLTF) and texture
        files attach to these records when the 3D model service is connected — placements made in
        the properties panel already reference the same categories.
      </p>
    </div>
  )
}
