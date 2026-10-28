import type { FeasibilityWarning, InterpretationResult, Suggestion } from '@/types'
import { uid } from '@/lib/id'

/**
 * AI interpretation contract.
 *
 * `simulateInterpretation` is a *frontend demonstration only*. It recognises a
 * handful of keywords and returns canned, clearly-labelled suggestions. It
 * does not generate designs, measurements or feasibility verdicts.
 *
 * The real implementation will be a thin client for the Pixel Studios design
 * API, e.g.:
 *
 *   async interpret(prompt, project) {
 *     const res = await fetch('/api/ai/interpret', { ... })
 *     return res.json()
 *   }
 */
export interface AIInterpretationService {
  interpret(prompt: string, project?: { plot: { width: number; length: number; units: string } }): Promise<InterpretationResult>
}

const EXAMPLE_PROMPTS = [
  'Create a modern three-bedroom bungalow on my 50 × 50 ft plot, with a car park and a small swimming pool.',
  'Open up the living room and add a bigger kitchen with an island.',
  'Add a master bedroom with an en-suite and a walk-in wardrobe.',
  'Make the house more energy efficient with natural light.',
]

export function getExamplePrompts(): string[] {
  return [...EXAMPLE_PROMPTS]
}

export function createSimulatedAIService(): AIInterpretationService {
  return {
    async interpret(prompt) {
      const text = prompt.toLowerCase()
      const suggestions: Suggestion[] = []
      const warnings: FeasibilityWarning[] = []

      if (/(bedroom|master|en-suite)/.test(text)) {
        suggestions.push({
          id: uid('sug'),
          title: 'Reposition the master suite',
          detail: 'Move the master bedroom to the quietest side of the plot with a private bathroom and walk-in wardrobe.',
          tone: 'improve',
        })
      }
      if (/(kitchen|island|open)/.test(text)) {
        suggestions.push({
          id: uid('sug'),
          title: 'Combine dining and kitchen',
          detail: 'An open-plan kitchen with a peninsula island keeps the cooking area connected to the living space.',
          tone: 'add',
        })
      }
      if (/(pool|swimming)/.test(text)) {
        suggestions.push({
          id: uid('sug'),
          title: 'Place the pool away from the structure',
          detail: 'Set the pool towards the rear with a 2 ft deck spacing from the building line to avoid structure conflicts.',
          tone: 'add',
        })
        warnings.push({
          id: uid('warn'),
          level: 'info',
          text: 'Pool geometry is illustrative — structural and mechanical sizing happens in the generation engine.',
        })
      }
      if (/(car park|garage|parking)/.test(text)) {
        suggestions.push({
          id: uid('sug'),
          title: 'Covered car port option',
          detail: 'A single-span car port keeps the footprint compact while leaving the front garden visible.',
          tone: 'add',
        })
      }
      if (/(energy|light|natural|efficien)/.test(text)) {
        suggestions.push({
          id: uid('sug'),
          title: 'Improve daylight to north-facing rooms',
          detail: 'Widening glazing on the principal façade raises daylight without changing the roof line.',
          tone: 'style',
        })
      }
      if (/(reduce|cheap|budget|afford|smaller)/.test(text)) {
        suggestions.push({
          id: uid('sug'),
          title: 'Trim the footprint',
          detail: 'Reducing the circulation area and merging the store into the kitchen block lowers cost per square foot.',
          tone: 'reduce',
        })
      }

      if (suggestions.length === 0) {
        suggestions.push(
          {
            id: uid('sug'),
            title: 'Add a front veranda',
            detail: 'A covered veranda extends the living space outward and shelters the entrance from sun and rain.',
            tone: 'add',
          },
          {
            id: uid('sug'),
            title: 'Review the room proportions',
            detail: 'Balancing bedroom and living widths usually improves circulation more than adding rooms.',
            tone: 'improve',
          },
        )
      }

      return {
        summary:
          'I have drafted a starting layout from your description. This is a frontend preview — the actual geometry, dimensions and feasibility checks are produced by the generation engine once it is connected.',
        suggestions: suggestions.slice(0, 4),
        warnings,
        simulated: true,
      }
    },
  }
}

export const aiService: AIInterpretationService = createSimulatedAIService()
