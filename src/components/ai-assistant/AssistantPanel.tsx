import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowUp, Info, Sparkles, Trash2, X } from 'lucide-react'
import type { ChatMessage, InterpretationResult, Project } from '@/types'
import { aiService, getExamplePrompts } from '@/services/aiService'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { storageKeys } from '@/lib/storage'
import { uid } from '@/lib/id'
import { Badge } from '@/components/ui/Badge'

const TONE_STYLES: Record<string, string> = {
  improve: 'bg-brand-50 text-brand-700',
  add: 'bg-emerald-50 text-emerald-700',
  reduce: 'bg-amber-50 text-amber-700',
  style: 'bg-violet-50 text-violet-700',
}

export function AssistantPanel({
  open,
  onClose,
  project,
}: {
  open: boolean
  onClose: () => void
  project: Project
}) {
  const chatKey = `${storageKeys.aiChat}:${project.id}`
  const [messages, setMessages, resetChat] = useLocalStorage<ChatMessage[]>(chatKey, [])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<InterpretationResult | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, open])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)
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

  return (
    <aside
      className={`absolute inset-y-0 right-0 z-40 flex w-full max-w-[26rem] flex-col border-l border-line bg-surface shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
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
          demonstrations — no design is generated and no AI service is called in this prototype.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto scroll-thin p-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-canvas-soft/60 p-3.5">
              <p className="text-[13px] leading-relaxed text-muted">
                Describe what you want in plain language. Try one of these:
              </p>
            </div>
            {getExamplePrompts().map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void send(prompt)}
                className="block w-full rounded-xl border border-line bg-surface p-3 text-left text-[12.5px] leading-relaxed text-ink-text transition-colors hover:border-brand-300 hover:bg-brand-50/50"
              >
                {prompt}
              </button>
            ))}
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
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send(input)
              }
            }}
            rows={2}
            placeholder="Describe a change, e.g. add a study next to the living room…"
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
        <p className="mt-2 text-[11px] text-faint">
          Enter to send · Shift+Enter for a new line
        </p>
      </form>
    </aside>
  )
}
