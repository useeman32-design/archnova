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
    // Deep-link into the workspace with the asset armed as a pending placement.
    navigate(`/workspace/${latest.id}?add=${asset.id}`)
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
