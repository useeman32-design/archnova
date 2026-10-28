import type { ExportRequest, ExportResult, PlanDocument } from '@/types'
import { PLAN_DOCUMENTS } from '@/data/documents'

/**
 * Export contract.
 *
 * Document listings are real (they describe what a finished project will
 * ship). Actual file export is intentionally *not* implemented — the buttons
 * surface a clearly-labelled "preview only" state until the export pipeline
 * exists.
 */
export interface ExportService {
  listDocuments(projectId: string): Promise<PlanDocument[]>
  exportDocument(request: ExportRequest): Promise<ExportResult>
  isExportReady(): boolean
}

export function createPlaceholderExportService(): ExportService {
  return {
    isExportReady() {
      return false
    },
    async listDocuments() {
      return [...PLAN_DOCUMENTS]
    },
    async exportDocument({ documentId, format }) {
      const doc = PLAN_DOCUMENTS.find((d) => d.id === documentId)
      const supported = doc?.formats ?? []
      if (!supported.includes(format)) {
        return {
          ok: false,
          message: `${doc?.label ?? 'Document'} does not support ${format.toUpperCase()} yet.`,
          simulated: true,
        }
      }
      if (doc?.status === 'coming-soon') {
        return {
          ok: false,
          message: `${doc.label} export is coming soon and is not generated in this prototype.`,
          simulated: true,
        }
      }
      return {
        ok: false,
        message: `${doc?.label} is shown as a preview only — real ${format.toUpperCase()} export is not implemented yet.`,
        simulated: true,
      }
    },
  }
}

export const exportService: ExportService = createPlaceholderExportService()
