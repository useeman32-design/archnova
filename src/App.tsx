import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ThreeErrorBoundary } from '@/components/3d-viewer/MassingViewer'
import { HomePage } from '@/pages/HomePage'
import { NewProjectPage } from '@/pages/NewProjectPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { AssetsPage } from '@/pages/AssetsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { WorkspaceLayout } from '@/pages/workspace/WorkspaceLayout'
import { WorkspaceOverview } from '@/pages/workspace/WorkspaceOverview'
import { ThreeDPage } from '@/pages/workspace/ThreeDPage'
import { WorkspaceAssetsPage } from '@/pages/workspace/WorkspaceAssetsPage'

export default function App() {
  return (
    <ThreeErrorBoundary
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas p-6 text-center">
          <p className="text-[16px] font-semibold text-ink-text">Something went wrong rendering ArchNova</p>
          <p className="max-w-md text-[13px] text-muted">
            An unexpected error occurred while rendering this view. Reload the app to continue —
            your projects are stored safely in this browser.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Reload ArchNova
          </button>
        </div>
      }
    >
      <Routes>
      <Route
        path="/"
        element={
          <AppShell>
            <HomePage />
          </AppShell>
        }
      />
      {/* These pages render their own <AppShell> — do not wrap them again. */}
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/new" element={<AppShell><NewProjectPage /></AppShell>} />
      <Route path="/drawings" element={<Navigate to="/" replace />} />
      <Route path="/assets" element={<AssetsPage />} />
      <Route path="/settings" element={<SettingsPage />} />

      <Route path="/workspace/:id" element={<WorkspaceLayout />}>
        <Route index element={<WorkspaceOverview />} />
        {/* The focused editor now lives inside the canvas's 2D tab. */}
        <Route path="floor-plan" element={<Navigate to="." replace />} />
        <Route path="3d" element={<ThreeDPage />} />
        <Route path="drawings" element={<Navigate to="." replace />} />
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
    </ThreeErrorBoundary>
  )
}
