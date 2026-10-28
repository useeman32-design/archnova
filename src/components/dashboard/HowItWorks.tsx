import { MessageSquareText, Wand2, ScanSearch, FileDown } from 'lucide-react'

const STEPS = [
  {
    icon: MessageSquareText,
    title: 'Describe your brief',
    text: 'Name the project, tell us the plot size and pick your style. No architectural knowledge needed.',
  },
  {
    icon: Wand2,
    title: 'AI drafts a layout',
    text: 'The assistant proposes room positions, outdoor features and a first pass at finishes.',
  },
  {
    icon: ScanSearch,
    title: 'Review and refine',
    text: 'Walk the plan in 2D, drop in furniture, and talk to the assistant to iterate quickly.',
  },
  {
    icon: FileDown,
    title: 'Export the drawings',
    text: 'Take out floor plans, elevations, sections and a project report when you are ready.',
  },
]

export function HowItWorks() {
  return (
    <section>
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold text-ink-text">How it works</h3>
        <p className="mt-0.5 text-[13px] text-muted">
          Four steps from an idea to a drawing set you can hand to a contractor.
        </p>
      </div>

      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="relative rounded-xl border border-line bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <step.icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-bold text-faint">Step {index + 1}</span>
            </div>
            <h4 className="mt-4 text-[14px] font-semibold text-ink-text">{step.title}</h4>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
