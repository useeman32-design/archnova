/** Prompt starters shared by the Groq-powered design assistant. */
const EXAMPLE_PROMPTS = [
  'Create a modern three-bedroom bungalow on my 50 × 50 ft plot, with a car park and a small swimming pool.',
  'Open up the living room and add a bigger kitchen with an island.',
  'Add a master bedroom with an en-suite and a walk-in wardrobe.',
  'Make the house brighter with larger windows and suggest a natural-material finish.',
]

export function getExamplePrompts(): string[] {
  return [...EXAMPLE_PROMPTS]
}
