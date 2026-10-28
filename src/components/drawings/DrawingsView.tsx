import { useEffect, useState } from 'react'
import { DraftingCompass, FileText, Home, Layers, Mountain } from 'lucide-react'
import type { ExportFormat, PlanDocument, Project } from '@/types'
import { exportService } from '@/services/exportService'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FloorPlanDiagram } from '@/components/floor-plan/FloorPlanDiagram'
import { HouseIllustration } from '@/components/illustrations/HouseIllustration'

const FORMAT_LABEL: Record<ExportFormat, string> = {
  pdf: 'PDF',
  png: 'PNG',
  svg: 'SVG',
  dwg: 'DWG (CAD)',
}

const TYPE_ICON = {
  'floor-plan': DraftingCompass,
  elevation: Home,
  section: Layers,
  roof: Mountain,
  report: FileText,
} as const

function DocumentThumb({ doc, project }: { doc: PlanDocument; project: Project }) {
  const rooms = project.floors[0]?.rooms ?? []
  if (doc.type === 'floor-plan') {
    return (
      <div className="flex h-full items-center justify-center bg-white p-3">
        <FloorPlanDiagram rooms={rooms} units={project.plot.units} showDimensions className="h-full w-full" />
      </div>
    )
  }
  if (doc.type === 'elevation' || doc.type === 'roof') {
    return (
      <HouseIllustration
        roof={project.roof}
        exterior={project.preferences.exteriorFinish}
        showPool={doc.type === 'roof' && project.preferences.outdoor.includes('pool')}
        showGarage={project.preferences.outdoor.includes('garage')}
        showGarden={false}
        variant={project.thumbnailSeed % 3}
        className="h-full w-full"
      />
    )
  }
  const Icon = TYPE_ICON[doc.type]
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-canvas-soft text-faint">
      <Icon className="h-8 w-8" />
      <span className="text-[11px] font-medium uppercase tracking-wide">
        {doc.status === 'coming-soon' ? 'Coming soon' : 'Preview'}
      </span>
    </div>
  )
}

export function DrawingsView({ project }: { project: Project }) {
  const [documents, setDocuments] = useState<PlanDocument[] | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    void exportService.listDocuments(project.id).then((docs) => {
      if (active) setDocuments(docs)
    })
    return () => {
      active = false
    }
  }, [project.id])

  const docs = documents ?? []

  const requestExport = async (doc: PlanDocument, format: ExportFormat) => {
    const result = await exportService.exportDocument({
      projectId: project.id,
      documentId: doc.id,
      format,
    })
    setMessages((prev) => ({ ...prev, [doc.id]: result.message }))
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {docs.map((doc) => {
        const Icon = TYPE_ICON[doc.type]
        return (
          <article key={doc.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            <div className="h-40 border-b border-line">
              <DocumentThumb doc={doc} project={project} />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-ink-text">
                  <Icon className="h-4 w-4 text-brand-600" />
                  {doc.label}
                </span>
                <Badge tone={doc.status === 'available' ? 'success' : doc.status === 'preview' ? 'brand' : 'neutral'}>
                  {doc.status === 'coming-soon' ? 'Coming soon' : doc.status === 'preview' ? 'Preview' : 'Available'}
                </Badge>
              </div>
              <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-muted">{doc.description}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {doc.formats.map((format) => (
                  <button
                    key={format}
                    type="button"
                    disabled={doc.status === 'coming-soon'}
                    onClick={() => void requestExport(doc, format)}
                    className="rounded-md border border-line bg-canvas-soft px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {FORMAT_LABEL[format]}
                  </button>
                ))}
              </div>

              {messages[doc.id] ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-800">
                  {messages[doc.id]}
                </p>
              ) : null}
            </div>
          </article>
        )
      })}

      {documents ? (
        <div className="md:col-span-2 xl:col-span-3">
          <p className="rounded-xl border border-dashed border-line bg-canvas-soft/50 px-4 py-3 text-[12px] leading-relaxed text-muted">
            Export is disabled in this prototype: buttons report what the finished pipeline will
            produce. PDF, image and CAD exports connect to the export service later.
          </p>
        </div>
      ) : (
        <div className="md:col-span-2 xl:col-span-3">
          <Button variant="subtle" disabled>
            Loading drawing set…
          </Button>
        </div>
      )}
    </div>
  )
}
