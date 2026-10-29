import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { NewProjectPage } from '@/pages/NewProjectPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { DrawingsPage } from '@/pages/DrawingsPage'
import { AssetsPage } from '@/pages/AssetsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { WorkspaceLayout } from '@/pages/workspace/WorkspaceLayout'
import { WorkspaceOverview } from '@/pages/workspace/WorkspaceOverview'
import { ThreeDPage } from '@/pages/workspace/ThreeDPage'
import { WorkspaceDrawingsPage } from '@/pages/workspace/WorkspaceDrawingsPage'
import { WorkspaceAssetsPage } from '@/pages/workspace/WorkspaceAssetsPage'

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppShell>
            <HomePage />
          </AppShell>
        }
      />
      <Route
        path="/projects"
        element={
          <AppShell>
            <ProjectsPage />
          </AppShell>
        }
      />
      <Route
        path="/projects/new"
        element={
          <AppShell>
            <NewProjectPage />
          </AppShell>
        }
      />
      <Route
        path="/drawings"
        element={
          <AppShell>
            <DrawingsPage />
          </AppShell>
        }
      />
      <Route
        path="/assets"
        element={
          <AppShell>
            <AssetsPage />
          </AppShell>
        }
      />
      <Route
        path="/settings"
        element={
          <AppShell>
            <SettingsPage />
          </AppShell>
        }
      />

      <Route path="/workspace/:id" element={<WorkspaceLayout />}>
        <Route index element={<WorkspaceOverview />} />
        {/* The focused editor now lives inside the canvas's 2D tab. */}
        <Route path="floor-plan" element={<Navigate to="." replace />} />
        <Route path="3d" element={<ThreeDPage />} />
        <Route path="drawings" element={<WorkspaceDrawingsPage />} />
        <Route path="assets" element={<WorkspaceAssetsPage />} />
      </Route>

      <Route
        path="*"
        element={
          <AppShell>
            <NotFoundPage />
          </AppShell>
        }
      />
    </Routes>
  )
}
