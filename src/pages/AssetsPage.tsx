import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { AssetsView } from '@/components/assets/AssetsView'
import { useProjects } from '@/hooks/useProjects'
import type { AssetItem } from '@/data/assets'

export function AssetsPage() {
  const navigate = useNavigate()
  const { projects, loading } = useProjects()

  const handleAdd = (asset: AssetItem) => {
    const latest = projects[0]
    if (!latest) {
      navigate('/projects/new')
      return
    }
    // Model IDs arm a placement; material IDs switch the workspace preview finish.
    const query = asset.assetKind === 'material' ? `material=${encodeURIComponent(asset.id)}` : `add=${encodeURIComponent(asset.id)}`
    navigate(`/workspace/${latest.id}?${query}`)
  }

  return (
    <AppShell>
      <PageHeader
        title="Asset library"
        subtitle="3D objects, textures & materials, interior items and landscape for your designs."
      />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {loading ? null : <AssetsView onAdd={handleAdd} />}
      </div>
    </AppShell>
  )
}
