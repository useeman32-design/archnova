import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Eye, EyeOff, Loader2, Settings2, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import type { ChatMessage, PlacedItem, Project, Room, Units } from '@/types'
import { DEFAULT_GROQ_MODEL, requestAssistantPlan, testGroqConnection, type AssistantAction, type AssistantPlan } from '@/services/groqAssistant'
import type { ApplyAssistantPlanResult } from '@/lib/applyAssistantPlan'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { storageKeys } from '@/lib/storage'
import { uid } from '@/lib/id'

const GROQ_KEY_STORAGE = 'archnova:groq-api-key'
const GROQ_MODEL_STORAGE = 'archnova:groq-model'

export function AssistantPanel({
  open,
  onClose,
  project,
  rooms,
  placed,
  units,
  onApplyPlan,
}: {
  open: boolean
  onClose: () => void
  project: Project
  rooms: Room[]
  placed: Record<string, PlacedItem[]>
  units: Units
  onApplyPlan: (plan: AssistantPlan, onProgress: (current: number, total: number, label: string) => void) => Promise<ApplyAssistantPlanResult>
}) {
  const chatKey = `${storageKeys.aiChat}:${project.id}`
  const [messages, setMessages, resetChat] = useLocalStorage<ChatMessage[]>(chatKey, [])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [testingKey, setTestingKey] = useState(false)
  const [apiKey, setApiKey] = useState(readSessionValue(GROQ_KEY_STORAGE))
  const [model, setModel] = useState(readSessionValue(GROQ_MODEL_STORAGE) || DEFAULT_GROQ_MODEL)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [showKey, setShowKey] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('')
  const [requestError, setRequestError] = useState('')
  const [applyProgress, setApplyProgress] = useState<{ current: number; total: number; label: string } | null>(null)
  const [pendingPlan, setPendingPlan] = useState<AssistantPlan | null>(null)
  const [applyStatus, setApplyStatus] = useState<{ ok: boolean; message: string; warnings: string[] } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const migratedChat = useRef(false)

  useEffect(() => {
    if (!migratedChat.current) {
      migratedChat.current = true
      const oldDemoNoise = messages.some((message) => message.simulated || message.pending || (message.role === 'assistant' && /(How can I help you design your floor plan|I couldn't reach Groq|Failed to validate JSON)/i.test(message.text)))
      if (oldDemoNoise) resetChat()
    }
  }, [messages, resetChat])

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [messages, open, busy, pendingPlan, applyStatus, applyProgress])

  const updateApiKey = (value: string) => {
    setApiKey(value)
    setConnectionStatus('')
    setRequestError('')
    try {
      if (value.trim()) sessionStorage.setItem(GROQ_KEY_STORAGE, value.trim())
      else sessionStorage.removeItem(GROQ_KEY_STORAGE)
    } catch { /* Browser storage may be disabled; the in-memory key still works. */ }
  }

  const updateModel = (value: string) => {
    setModel(value)
    setConnectionStatus('')
    try {
      if (value.trim()) sessionStorage.setItem(GROQ_MODEL_STORAGE, value.trim())
      else sessionStorage.removeItem(GROQ_MODEL_STORAGE)
    } catch { /* Model remains available for this component session. */ }
  }

  const testKey = async () => {
    if (!apiKey.trim()) {
      setConnectionStatus('Paste a Groq API key first.')
      return
    }
    setTestingKey(true)
    setConnectionStatus('Checking key and model…')
    try {
      const result = await testGroqConnection(apiKey, model)
      setAvailableModels(result.models)
      const previousModel = model.trim() || DEFAULT_GROQ_MODEL
      if (result.selectedModel !== previousModel) updateModel(result.selectedModel)
      setConnectionStatus(result.selectedModel === previousModel
        ? `Key verified — ${result.selectedModel} is available.`
        : `Key verified. Switched to an available model: ${result.selectedModel}.`)
    } catch (error) {
      setConnectionStatus(error instanceof Error ? error.message : 'Could not verify the Groq key.')
    } finally {
      setTestingKey(false)
    }
  }

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    if (!apiKey.trim()) {
      setSettingsOpen(true)
      setRequestError('Paste your Groq API key in Groq settings before sending a prompt.')
      return
    }
    setInput('')
    setBusy(true)
    setRequestError('')
    setApplyProgress(null)
    setPendingPlan(null)
    setApplyStatus(null)
    const pendingId = uid('msg')
    const history = messages
      .filter((message) => !message.pending && !message.simulated)
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.text }))
    setMessages((previous) => [
      ...previous,
      { id: uid('msg'), role: 'user', text, createdAt: Date.now() },
      { id: pendingId, role: 'assistant', text: `Reading the current ${rooms.length}-room plan and plot…`, createdAt: Date.now(), pending: true },
    ])
    try {
      const plan = await requestAssistantPlan({
        apiKey,
        model,
        context: { project, rooms, placed, units },
        history,
        prompt: text,
        onProgress: (report) => {
          setMessages((previous) => previous.map((message) => message.id === pendingId ? { ...message, text: report } : message))
        },
      })
      setPendingPlan(plan.actions.length || plan.project || plan.plot || plan.unsupported?.length ? plan : null)
      setMessages((previous) => previous.map((message) => message.id === pendingId
        ? { ...message, text: plan.reply || 'I have prepared a response.', pending: false }
        : message))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The Groq request failed. Try again.'
      setRequestError('')
      setMessages((previous) => previous.map((item) => item.id === pendingId
        ? { ...item, text: message, pending: false }
        : item))
    } finally {
      setBusy(false)
    }
  }

  const applyPlan = async () => {
    if (!pendingPlan || busy) return
    setBusy(true)
    setApplyStatus(null)
    setRequestError('')
    setApplyProgress({ current: 0, total: 1, label: 'Checking geometry before applying…' })
    try {
      const result = await onApplyPlan(pendingPlan, (current, total, label) => setApplyProgress({ current, total, label }))
      if (!result.ok) {
        setApplyStatus({ ok: false, message: result.errors.join(' '), warnings: [] })
        return
      }
      const message = `Applied ${result.appliedCount} design change${result.appliedCount === 1 ? '' : 's'} and saved the project.`
      setApplyStatus(result.warnings.length ? { ok: true, message: 'Applied with geometry notes:', warnings: result.warnings } : null)
      setMessages((previous) => [...previous, { id: uid('msg'), role: 'assistant', text: message, createdAt: Date.now() }])
      setPendingPlan(null)
    } catch (error) {
      setApplyStatus({ ok: false, message: error instanceof Error ? error.message : 'The design update could not be applied.', warnings: [] })
    } finally {
      setBusy(false)
      setApplyProgress(null)
    }
  }

  const clearConversation = () => {
    resetChat()
    setPendingPlan(null)
    setApplyStatus(null)
    setRequestError('')
    setApplyProgress(null)
    setInput('')
  }

  return (
    <aside
      className={`absolute inset-y-0 right-0 z-40 flex w-full max-w-[27rem] flex-col border-l border-line bg-surface shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0 visible' : 'translate-x-full invisible'}`}
      aria-hidden={!open}
      aria-label="AI assistant"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><Sparkles className="h-4 w-4" /></span>
          <div>
            <p className="text-[14px] font-semibold leading-tight text-ink-text">AI Assistant</p>
            <p className="text-[11px] text-muted">{project.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen} className={`flex h-8 w-8 items-center justify-center rounded-lg ${settingsOpen ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-canvas-soft hover:text-ink-text'}`} aria-label={settingsOpen ? 'Hide Groq settings' : 'Groq settings'} title="Groq settings"><Settings2 className="h-4 w-4" /></button>
          <button type="button" onClick={clearConversation} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas-soft hover:text-ink-text" aria-label="Clear conversation" title="Clear conversation"><Trash2 className="h-4 w-4" /></button>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas-soft hover:text-ink-text" aria-label="Close assistant"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {settingsOpen ? (
        <section className="space-y-2.5 border-b border-line bg-brand-50/60 px-3.5 py-3" aria-label="Groq API settings">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="groq-api-key" className="text-[11px] font-semibold uppercase tracking-wide text-brand-900">Groq API key</label>
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="ml-auto text-[10px] font-medium text-brand-700 underline underline-offset-2">Get a key</a>
            <button type="button" onClick={() => void testKey()} disabled={testingKey || !apiKey.trim()} className="rounded-md border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-medium text-brand-800 disabled:opacity-50">
              {testingKey ? 'Checking…' : 'Check models'}
            </button>
          </div>
          <div className="flex gap-1.5">
            <input id="groq-api-key" type={showKey ? 'text' : 'password'} value={apiKey} onChange={(event) => updateApiKey(event.target.value)} autoComplete="off" spellCheck={false} placeholder="Paste Groq API key" className="min-w-0 flex-1 rounded-lg border border-brand-200 bg-white px-3 py-2 text-[12px] text-ink-text placeholder:text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            <button type="button" onClick={() => setShowKey((visible) => !visible)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-white text-muted" aria-label={showKey ? 'Hide API key' : 'Show API key'}>{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            {apiKey ? <button type="button" onClick={() => updateApiKey('')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-white text-muted" aria-label="Clear API key" title="Clear API key"><X className="h-4 w-4" /></button> : null}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="groq-model" className="shrink-0 text-[11px] font-medium text-brand-900">Model</label>
            <input id="groq-model" list="groq-model-options" value={model} onChange={(event) => updateModel(event.target.value)} placeholder={DEFAULT_GROQ_MODEL} className="min-w-0 flex-1 rounded-md border border-brand-200 bg-white px-2 py-1.5 text-[11px] text-ink-text focus:border-brand-500 focus:outline-none" />
            <datalist id="groq-model-options">{availableModels.map((id) => <option key={id} value={id} />)}</datalist>
          </div>
          <p className="text-[10px] leading-relaxed text-brand-900/75">The key is kept in this tab only. Groq receives your prompt and a summary of this project.</p>
          {connectionStatus ? <p role="status" className={`text-[10.5px] leading-relaxed ${/verified/i.test(connectionStatus) ? 'text-emerald-700' : 'text-brand-900'}`}>{/verified/i.test(connectionStatus) ? <Check className="mr-1 inline h-3 w-3" /> : null}{connectionStatus}</p> : null}
        </section>
      ) : null}

      <div className="flex-1 space-y-4 overflow-y-auto scroll-thin p-4">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-line bg-canvas-soft/60 px-3.5 py-3 text-[12.5px] text-muted">
            <p className="font-medium text-ink-text">What would you like to design or change?</p>
            <p className="mt-1">Describe it below. Proposed edits will appear here for review before they update the project.</p>
          </div>
        ) : messages.map((message) => (
          <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : ''}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${message.role === 'user' ? 'bg-brand-600 text-white' : 'border border-line bg-canvas-soft/70 text-ink-text'}`}>
              {message.pending ? <span className="inline-flex items-center gap-1.5 text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />{message.text || 'Connecting to Groq…'}</span> : message.text}
            </div>
          </div>
        ))}

        {pendingPlan ? <PlanPreview plan={pendingPlan} onApply={() => void applyPlan()} onDiscard={() => { setPendingPlan(null); setApplyStatus(null); setApplyProgress(null) }} busy={busy} progress={applyProgress} /> : null}
        {applyStatus ? <div role={applyStatus.ok ? 'status' : 'alert'} className={`rounded-xl border p-3 text-[12px] leading-relaxed ${applyStatus.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          <p className="font-medium">{applyStatus.message}</p>
          {applyStatus.warnings.map((warning, index) => <p key={index} className="mt-1 text-[11px]">Check: {warning}</p>)}
        </div> : null}
        {requestError ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] leading-relaxed text-red-800">{requestError}</div> : null}
        <div ref={endRef} />
      </div>

      <form className="border-t border-line p-3" onSubmit={(event) => { event.preventDefault(); void send(input) }}>
        <div className="flex items-end gap-2">
          <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(input) } }} rows={2} placeholder="Describe a design change…" className="max-h-32 min-h-[44px] w-full resize-y rounded-xl border border-line bg-canvas-soft/60 px-3 py-2.5 text-[13px] text-ink-text placeholder:text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
          <button type="submit" disabled={busy || !input.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/25 transition-colors hover:bg-brand-700 disabled:opacity-50" aria-label="Send message">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-[10.5px] text-faint">Enter to send · Shift+Enter for a new line · design edits require your approval</p>
      </form>
    </aside>
  )
}

function PlanPreview({ plan, onApply, onDiscard, busy, progress }: { plan: AssistantPlan; onApply: () => void; onDiscard: () => void; busy: boolean; progress: { current: number; total: number; label: string } | null }) {
  const hasApplicableChanges = plan.actions.length > 0 || Boolean(plan.project) || Boolean(plan.plot)
  const hasUnsupported = Boolean(plan.unsupported?.length)
  if (!hasApplicableChanges && !hasUnsupported) return null
  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50/70 p-3" aria-label="Proposed design edits">
      <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-700" /><h3 className="text-[12.5px] font-semibold text-brand-900">Review proposed edits</h3></div>
      <ul className="mt-2 space-y-1.5">
        {plan.actions.map((action, index) => <li key={`${action.type}-${index}`} className="rounded-md bg-white/80 px-2.5 py-1.5 text-[11px] text-ink-text">{describeAction(action)}</li>)}
        {plan.plot ? <li className="rounded-md bg-white/80 px-2.5 py-1.5 text-[11px] text-ink-text">Adjust plot dimensions{plan.plot.width ? ` to ${plan.plot.width}` : ''}{plan.plot.length ? ` × ${plan.plot.length}` : ''}{plan.plot.units ? ` ${plan.plot.units}` : ''}</li> : null}
        {plan.project ? <li className="rounded-md bg-white/80 px-2.5 py-1.5 text-[11px] text-ink-text">Update project details: {Object.keys(plan.project).join(', ')}</li> : null}
      </ul>
      {plan.unsupported?.length ? <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10.5px] text-amber-900"><strong>Not supported yet:</strong> {plan.unsupported.join(' ')}</div> : null}
      <p className="mt-2 text-[10px] leading-relaxed text-brand-900/75">Geometry is checked before applying; this is not building-code or permit validation.</p>
      {progress ? <div role="status" className="mt-2 rounded-md bg-white/80 px-2.5 py-2 text-[10.5px] text-brand-900"><div className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /><span>{progress.total > 1 ? `${Math.min(progress.current, progress.total)} / ${progress.total} · ` : ''}{progress.label}</span></div><div className="mt-1.5 h-1 overflow-hidden rounded bg-brand-100"><div className="h-full rounded bg-brand-600 transition-[width] duration-200" style={{ width: `${Math.max(4, Math.min(100, progress.current / Math.max(progress.total, 1) * 100))}%` }} /></div></div> : null}
      <div className="mt-2.5 flex gap-2">
        {hasApplicableChanges ? <button type="button" onClick={onApply} disabled={busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-[11.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Apply and save</button> : <span className="flex-1 py-2 text-[10.5px] text-amber-900">No supported edits are ready to apply.</span>}
        <button type="button" onClick={onDiscard} disabled={busy} className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-[11.5px] font-medium text-brand-800 disabled:opacity-50">Dismiss</button>
      </div>
    </section>
  )
}

function describeAction(action: AssistantAction): string {
  switch (action.type) {
    case 'create_house': return `${action.replaceExisting === false ? 'Add' : 'Create'} floor plan with ${action.rooms.length} room${action.rooms.length === 1 ? '' : 's'}: ${action.rooms.slice(0, 5).map((room) => room.name).join(', ')}${action.rooms.length > 5 ? ', …' : ''}`
    case 'add_room': return `Add ${action.room.name} (${action.room.width} × ${action.room.length})`
    case 'resize_room': return `Resize ${action.room}${action.width ? ` to ${action.width}` : ''}${action.length ? ` × ${action.length}` : ''}`
    case 'move_room': return `Move ${action.room} to (${action.x}, ${action.y})`
    case 'rename_room': return `Rename ${action.room} to ${action.name}`
    case 'remove_room': return `Remove ${action.room}`
    case 'set_room_shape': return `Change ${action.room} to ${action.shape}-shaped`
    case 'add_opening': return `Add ${action.kind} in ${action.room}${action.width ? ` (${action.width} wide)` : ''}`
    case 'edit_opening': return `Edit ${action.opening} in ${action.room}`
    case 'remove_opening': return `Remove ${action.opening ?? action.kind ?? 'opening'} from ${action.room}`
    case 'add_furniture': return `Place ${action.item} in ${action.room}`
    case 'remove_furniture': return `Remove ${action.item} from ${action.room}`
    case 'set_room_finish': return `Set ${action.room} finish to ${action.finish}`
  }
}

function readSessionValue(key: string): string {
  try { return sessionStorage.getItem(key) ?? '' } catch { return '' }
}
