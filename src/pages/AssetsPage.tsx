import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { AssetsView } from '@/components/assets/AssetsView'

export function AssetsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Asset library"
        subtitle="3D objects, textures & materials, interior items and landscape for your designs."
      />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <AssetsView />
      </div>
    </AppShell>
  )
}
