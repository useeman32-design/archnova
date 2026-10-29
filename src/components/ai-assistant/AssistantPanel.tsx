import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowUp, Info, Sparkles, Trash2, Wand2, X } from 'lucide-react'
import type { ChatMessage, InterpretationResult, Project } from '@/types'
import { aiService, getExamplePrompts } from '@/services/aiService'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useProjects } from '@/hooks/useProjects'
import { storageKeys } from '@/lib/storage'
import { uid } from '@/lib/id'
import { parseBrief, type ParsedBrief } from '@/lib/briefParser'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LogoMark } from '@/components/layout/Logo'
import { formatDimensions } from '@/lib/format'

const TONE_STYLES: Record<string, string> = {
  improve: 'bg-brand-50 text-brand-700',
  add: 'bg-emerald-50 text-emerald-700',
  reduce: 'bg-amber-50 text-amber-700',
  style: 'bg-violet-50 text-violet-700',
}

const CREATE_VERBS = /(build|create|make|design|draft|plan|generate)/

export function AssistantPanel({
  open,
  onClose,
  project,
}: {
  open: boolean
  onClose: () => void
  project: Project
}) {
  const navigate = useNavigate()
  const { createProject } = useProjects()
  const chatKey = `${storageKeys.aiChat}:${project.id}`
  const [messages, setMessages, resetChat] = useLocalStorage<ChatMessage[]>(chatKey, [])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<InterpretationResult | null>(null)
  const [brief, setBrief] = useState<ParsedBrief | null>(null)
  const [bootStage, setBootStage] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const started = project.floors.some((floor) => floor.rooms.length > 0)

  /* Boot sequence: plays each time the panel opens on an empty conversation. */
  useEffect(() => {
    if (!open) {
      setBootStage(0)
      return
    }
    if (messages.length > 0) {
      setBootStage(3)
      return
    }
    setBootStage(1)
    const t1 = window.setTimeout(() => setBootStage(2), 700)
    const t2 = window.setTimeout(() => setBootStage(3), 1500)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [open, messages.length])

  useEffect(() => {
    /* Only auto-scroll while the panel is actually open — scrolling a closed
       (off-screen) panel into view would drag the workspace sideways. */
    if (!open) return
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, open, bootStage])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)
    const parsed = parseBrief(text, project.location)
    const wantsCreate = CREATE_VERBS.test(text.toLowerCase())
    setBrief(wantsCreate && parsed.confident ? parsed : null)
    const pendingId = uid('msg')
    setMessages((prev) => [
      ...prev,
      { id: uid('msg'), role: 'user', text, createdAt: Date.now() },
      { id: pendingId, role: 'assistant', text: '', createdAt: Date.now(), pending: true },
    ])
    const interpretation = await aiService.interpret(text, { plot: project.plot })
    setMessages((prev) =>
      prev.map((message) =>
        message.id === pendingId
          ? { ...message, text: interpretation.summary, pending: false, simulated: true }
          : message,
      ),
    )
    setResult(interpretation)
    setBusy(false)
  }

  const createFromBrief = async () => {
    if (!brief) return
    const created = await createProject(brief.form)
    setMessages((prev) => [
      ...prev,
      {
        id: uid('msg'),
        role: 'assistant',
        text: `Project "${created.name}" created from your brief and opened in the workspace. Dimensions and layout are demonstration values until the generation engine is connected.`,
        createdAt: Date.now(),
        simulated: true,
      },
    ])
    setBrief(null)
    onClose()
    navigate(`/workspace/${created.id}`)
  }

  return (
    <aside
      className={`absolute inset-y-0 right-0 z-40 flex w-full max-w-[26rem] flex-col border-l border-line bg-surface shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0 visible' : 'translate-x-full invisible'
      }`}
      aria-hidden={!open}
      aria-label="AI assistant"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[14px] font-semibold leading-tight text-ink-text">AI Assistant</p>
            <p className="text-[11px] text-muted">Design copilot for {project.name}</p>
          </div>
          <Badge tone="violet">Beta</Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              resetChat()
              setResult(null)
              setBrief(null)
              setBootStage(1)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas-soft hover:text-ink-text"
            aria-label="Clear conversation"
            title="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas-soft hover:text-ink-text"
            aria-label="Close assistant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-line-soft bg-brand-50/60 px-4 py-2.5">
        <p className="text-[11.5px] leading-relaxed text-brand-800">
          <span className="font-semibold">Simulated assistant.</span> Replies are canned frontend
          demonstrations; brief parsing runs on-device. No design is generated and no AI service is
          called in this prototype.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto scroll-thin p-4">
        {bootStage < 3 ? (
          <div className="flex flex-col items-center gap-4 pt-10 text-center animate-fade-in">
            <span className={bootStage >= 1 ? 'animate-pulse' : ''}>
              <LogoMark size={52} />
            </span>
            <p className="text-[13px] font-medium text-ink-text">Starting assistant…</p>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-brand-500"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-2xl rounded-tl-sm border border-line bg-canvas-soft/70 p-4">
              <p className="text-[14px] font-semibold text-ink-text">
                What would you like to build?
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                {started
                  ? `I see you've started: a ${project.bedrooms}-bedroom ${project.buildingType} on a ${formatDimensions(
                      project.plot.width,
                      project.plot.length,
                      project.plot.units,
                    )} plot${project.location ? ` in ${project.location}` : ''}. I can help refine it — or describe something completely new and I'll draft the brief.`
                  : 'Describe your house in plain language and I’ll draft a project brief you can create in one click — or open the questionnaire and build it manually step by step.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => inputRef.current?.focus()}
                  className="rounded-full bg-brand-600 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700"
                >
                  Describe a new build
                </button>
                {started ? (
                  <button
                    onClick={() => void send('Suggest improvements for my current design')}
                    className="rounded-full bg-surface px-3 py-1.5 text-[12px] font-medium text-brand-700 ring-1 ring-line hover:bg-brand-50"
                  >
                    Help with my current design
                  </button>
                ) : null}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Example prompts
              </p>
              {getExamplePrompts().map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void send(prompt)}
                  className="mb-2 block w-full rounded-xl border border-line bg-surface p-3 text-left text-[12.5px] leading-relaxed text-ink-text transition-colors hover:border-brand-300 hover:bg-brand-50/50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : ''}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-brand-600 text-white'
                    : 'border border-line bg-canvas-soft/70 text-ink-text'
                }`}
              >
                {message.pending ? (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                    Thinking…
                  </span>
                ) : (
                  message.text
                )}
                {message.simulated ? (
                  <span className="mt-1.5 block text-[10.5px] font-medium uppercase tracking-wide text-faint">
                    Simulated response
                  </span>
                ) : null}
              </div>
            </div>
          ))
        )}

        {brief ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-brand-700" />
              <p className="text-[13px] font-semibold text-brand-800">Brief understood</p>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-brand-800/90">{brief.summary}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-medium text-ink-text ring-1 ring-brand-200">
                {brief.form.bedrooms} bed · {brief.form.bathrooms} bath
              </span>
              <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-medium text-ink-text ring-1 ring-brand-200">
                {formatDimensions(brief.form.plotWidth, brief.form.plotLength, brief.form.units)}
              </span>
              <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-medium capitalize text-ink-text ring-1 ring-brand-200">
                {brief.form.buildingType}
              </span>
            </div>
            <Button variant="primary" size="sm" className="mt-3" onClick={() => void createFromBrief()}>
              Create project from this brief
            </Button>
            <p className="mt-2 text-[10.5px] leading-relaxed text-brand-800/70">
              Parsed on-device from your sentence — a demo of the future AI brief interpreter. You
              can also build manually via New Project → questionnaire.
            </p>
          </div>
        ) : null}

        {result ? (
          <div className="space-y-3">
            {result.warnings.length > 0 ? (
              <div className="space-y-2">
                {result.warnings.map((warning) => (
                  <div
                    key={warning.id}
                    className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
                  >
                    {warning.level === 'info' ? (
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    )}
                    <p className="text-[12px] leading-relaxed text-amber-800">{warning.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-line px-3 py-2.5">
                <p className="text-[11.5px] text-faint">
                  Feasibility warnings will appear here once the geometry engine is connected.
                </p>
              </div>
            )}

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Suggestions
              </p>
              <div className="space-y-2">
                {result.suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${TONE_STYLES[suggestion.tone] ?? 'bg-canvas-soft text-muted'}`}
                      >
                        {suggestion.tone}
                      </span>
                      <span className="text-[13px] font-medium text-ink-text">{suggestion.title}</span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{suggestion.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void send(input)
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send(input)
              }
            }}
            rows={2}
            placeholder="e.g. Build a 4-bedroom duplex on a 60 × 80 ft plot with a pool…"
            className="max-h-32 min-h-[44px] w-full resize-y rounded-xl border border-line bg-canvas-soft/60 px-3 py-2.5 text-[13px] text-ink-text placeholder:text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/25 transition-colors hover:bg-brand-700 disabled:opacity-50"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-faint">Enter to send · Shift+Enter for a new line</p>
      </form>
    </aside>
  )
}
