import type { Project } from '@/types'
import { formatArea } from '@/lib/format'

/**
 * Cost estimation contract.
 *
 * The heuristic below is a *demonstration placeholder* — a naive area × rate
 * calculation. It is labelled as such everywhere it is shown and must not be
 * read as a quotation. The real service will price finishes, structure,
 * services and site works from the generated geometry.
 */
export interface BudgetEstimate {
  project: string
  footprint: number
  footprintUnits: string
  unitCost: number
  currency: string
  low: number
  high: number
  disclaimer: string
}

export interface CostEstimationService {
  estimate(project: Project): Promise<BudgetEstimate>
}

const RATE_BY_FINISH: Record<string, number> = {
  render: 8200,
  paint: 7400,
  brick: 9400,
  stone: 12600,
  wood: 11200,
  glass: 15800,
}

export function createPlaceholderCostService(): CostEstimationService {
  return {
    async estimate(project) {
      const room = project.floors[0]?.rooms ?? []
      const footprint = room.reduce((sum, r) => sum + r.width * r.length, 0)
      const rate = RATE_BY_FINISH[project.preferences.exteriorFinish] ?? 8200
      const unitCost = project.plot.units === 'ft' ? rate : Math.round(rate / 10.764)
      const low = Math.round((footprint * unitCost) * 0.82)
      const high = Math.round((footprint * unitCost) * 1.18)
      return {
        project: project.name,
        footprint: Math.round(footprint),
        footprintUnits: project.plot.units === 'ft' ? 'ft²' : 'm²',
        unitCost,
        currency: project.budget.currency,
        low,
        high,
        disclaimer:
          'Indicative frontend estimate only — based on a simple area × rate calculation. Not a quotation or a feasibility verdict.',
      }
    },
  }
}

export const costService: CostEstimationService = createPlaceholderCostService()

export function formatFootprint(footprint: number, units: 'ft' | 'm'): string {
  return formatArea(footprint, 1, units)
}
