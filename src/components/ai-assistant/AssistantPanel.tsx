import { useEffect, useRef, useState } from 'react'
import { AppWindow, ArrowUp, BedDouble, Box, Car, Check, DoorOpen, Eye, EyeOff, Fence, Flower2, Home, Lamp, Loader2, Settings2, ShieldCheck, Sofa, Sparkles, Sprout, TreePalm, Trash2, Trees, X } from 'lucide-react'
import type { ArchitecturalWall, ChatMessage, PlacedItem, Project, Room, RoomCategory, Units } from '@/types'
import { DEFAULT_GROQ_MODEL, localSmallTalkReply, requestAssistantPlan, testGroqConnection, type AssistantAction, type AssistantPlan, type AssistantSiteItem } from '@/services/groqAssistant'
import type { ApplyAssistantPlanResult } from '@/lib/applyAssistantPlan'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { storageKeys } from '@/lib/storage'
import { uid } from '@/lib/id'
import { TOOL_GROUPS, type ToolVariant } from '@/data/toolLibrary'

const GROQ_KEY_STORAGE = 'archnova:groq-api-key'
const GROQ_MODEL_STORAGE = 'archnova:groq-model'

export function AssistantPanel({
  open,
  onClose,
  project,
  rooms,
  placed,
  ornaments,
  wallThicknesses,
  walls,
  units,
  onApplyPlan,
}: {
  open: boolean
  onClose: () => void
  project: Project
  rooms: Room[]
  placed: Record<string, PlacedItem[]>
  ornaments: AssistantSiteItem[]
  wallThicknesses: { exterior: number; interior: number }
  walls: ArchitecturalWall[]
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
    const smallTalk = localSmallTalkReply(text)
    if (smallTalk) {
      setInput('')
      setRequestError('')
      setMessages((previous) => [...previous,
        { id: uid('msg'), role: 'user', text, createdAt: Date.now() },
        { id: uid('msg'), role: 'assistant', text: smallTalk, createdAt: Date.now() },
      ])
      return
    }
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
        context: { project, rooms, placed, ornaments, wallThicknesses, walls, units },
        history,
        prompt: text,
        onProgress: (report) => {
          setMessages((previous) => previous.map((message) => message.id === pendingId ? { ...message, text: report } : message))
        },
      })
      const hasApplicableChanges = plan.actions.length > 0 || Boolean(plan.project) || Boolean(plan.plot) || Boolean(plan.wallThicknesses)
      setPendingPlan(hasApplicableChanges ? plan : null)
      const visibleReply = !hasApplicableChanges && plan.unsupported?.length ? `${plan.reply}\n\n${plan.unsupported.join(' ')}` : plan.reply
      setMessages((previous) => previous.map((message) => message.id === pendingId
        ? { ...message, text: visibleReply || 'I have prepared a response.', pending: false }
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

  const chooseCatalogVariant = (actionIndex: number, variant: ToolVariant) => {
    setPendingPlan((previous) => {
      if (!previous) return previous
      const actions = previous.actions.map((action, index): AssistantAction => {
        if (index !== actionIndex) return action
        if (action.type === 'add_room') {
          const category = roomCategoryFromVariant(variant)
          return { ...action, room: { ...action.room, name: variant.name, category, width: variant.w ?? action.room.width, length: variant.h ?? action.room.length } }
        }
        if (action.type === 'add_opening') {
          const style = action.kind === 'door'
            ? variant.id === 'dr_sliding' ? 'sliding' : 'single-hinged'
            : variant.id === 'wn_bay' ? 'bay' : variant.id === 'wn_casement' ? 'casement' : 'sliding'
          return { ...action, label: variant.label ?? variant.name, width: variant.w ?? action.width, height: variant.h ?? action.height, style }
        }
        if (action.type === 'add_furniture' && variant.item) return { ...action, item: variant.item }
        if (action.type === 'add_site_item' && variant.kind) return { ...action, kind: variant.kind as typeof action.kind, width: variant.w ?? action.width, length: variant.h ?? action.length }
        return action
      })
      return { ...previous, actions }
    })
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

        {pendingPlan ? <PlanPreview plan={pendingPlan} onApply={() => void applyPlan()} onDiscard={() => { setPendingPlan(null); setApplyStatus(null); setApplyProgress(null) }} onChooseVariant={chooseCatalogVariant} busy={busy} progress={applyProgress} units={units} /> : null}
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

function PlanPreview({ plan, onApply, onDiscard, onChooseVariant, busy, progress, units }: { plan: AssistantPlan; onApply: () => void; onDiscard: () => void; onChooseVariant: (actionIndex: number, variant: ToolVariant) => void; busy: boolean; progress: { current: number; total: number; label: string } | null; units: Units }) {
  const hasApplicableChanges = plan.actions.length > 0 || Boolean(plan.project) || Boolean(plan.plot) || Boolean(plan.wallThicknesses)
  const hasUnsupported = Boolean(plan.unsupported?.length)
  if (!hasApplicableChanges && !hasUnsupported) return null
  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50/70 p-3" aria-label="Proposed design edits">
      <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-700" /><h3 className="text-[12.5px] font-semibold text-brand-900">Review proposed edits</h3></div>
      <ul className="mt-2 space-y-1.5">
        {plan.actions.map((action, index) => <li key={`${action.type}-${index}`} className="rounded-md bg-white/80 px-2.5 py-2 text-[11px] text-ink-text">
          <p>{describeAction(action, units)}</p>
          {choiceVariants(action).length ? <div className="mt-2"><p className="mb-1.5 text-[10px] font-semibold text-muted">Choose an item from the library</p><div className="flex gap-2 overflow-x-auto pb-1">{choiceVariants(action).map((variant) => <ChoiceCard key={variant.id} variant={variant} selected={isChoiceSelected(action, variant)} onClick={() => onChooseVariant(index, variant)} />)}</div></div> : null}
        </li>)}
        {plan.plot ? <li className="rounded-md bg-white/80 px-2.5 py-1.5 text-[11px] text-ink-text">{describePlotPatch(plan.plot)}</li> : null}
        {plan.project ? <li className="rounded-md bg-white/80 px-2.5 py-1.5 text-[11px] text-ink-text">{describeProjectPatch(plan.project)}</li> : null}
        {plan.wallThicknesses?.exterior !== undefined ? <li className="rounded-md bg-white/80 px-2.5 py-1.5 text-[11px] text-ink-text">Set exterior wall thickness to {plan.wallThicknesses.exterior} {units}</li> : null}
        {plan.wallThicknesses?.interior !== undefined ? <li className="rounded-md bg-white/80 px-2.5 py-1.5 text-[11px] text-ink-text">Set interior wall thickness to {plan.wallThicknesses.interior} {units}</li> : null}
      </ul>
      {plan.assumptions?.length ? <div className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-2 text-[10.5px] text-sky-900"><strong>Assumptions to review:</strong><ul className="mt-1 list-disc pl-4">{plan.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}
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

function choiceVariants(action: AssistantAction): ToolVariant[] {
  const tool = action.type === 'add_room' ? 'room'
    : action.type === 'add_opening' ? action.kind
      : action.type === 'add_furniture' ? 'interior'
        : action.type === 'add_site_item' ? 'trees' : null
  if (!tool) return []
  const group = TOOL_GROUPS.find((candidate) => candidate.tool === tool)
  if (!group) return []
  return group.categories.filter((category) => {
    if (action.type === 'add_opening' && action.kind === 'door') return category.id === 'doors'
    if (action.type === 'add_opening' && action.kind === 'window') return category.id === 'windows'
    return true
  }).flatMap((category) => category.variants).filter((variant) => {
    if (action.type === 'add_opening' && action.kind === 'window' && variant.id === 'wn_skylight') return false
    return true
  })
}

function isChoiceSelected(action: AssistantAction, variant: ToolVariant): boolean {
  if (action.type === 'add_room') return action.room.name === variant.name
  if (action.type === 'add_opening') return action.label === (variant.label ?? variant.name) && action.width === variant.w
  if (action.type === 'add_furniture') return action.item === variant.item
  if (action.type === 'add_site_item') return action.kind === variant.kind
  return false
}

function roomCategoryFromVariant(variant: ToolVariant): RoomCategory {
  const categories: Record<string, RoomCategory> = {
    rm_master: 'bedroom', rm_bed: 'bedroom', rm_kids: 'bedroom', rm_guest: 'bedroom',
    rm_living: 'living', rm_family: 'living', rm_study: 'study', rm_kitchen: 'kitchen', rm_dining: 'dining', rm_pantry: 'storage',
    rm_bath: 'bathroom', rm_ensuite: 'bathroom', rm_laundry: 'laundry', rm_store: 'storage', rm_garage: 'garage', rm_porch: 'porch', rm_balcony: 'balcony', rm_pool: 'pool',
  }
  return categories[variant.id] ?? 'other'
}

function ChoiceCard({ variant, selected, onClick }: { variant: ToolVariant; selected: boolean; onClick: () => void }) {
  const icon = variant.icon.toLowerCase()
  const Icon = icon.includes('bed') ? BedDouble : icon.includes('sofa') || icon.includes('chair') ? Sofa : icon.includes('door') ? DoorOpen : icon.includes('window') ? AppWindow : icon.includes('car') ? Car : icon.includes('fence') ? Fence : icon.includes('lamp') ? Lamp : icon.includes('flower') ? Flower2 : icon.includes('sprout') ? Sprout : icon.includes('tree') ? icon.includes('palm') ? TreePalm : Trees : icon.includes('home') ? Home : Box
  return <button type="button" onClick={onClick} aria-pressed={selected} className={`flex w-[94px] shrink-0 flex-col items-start rounded-lg border p-2 text-left transition-colors ${selected ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'border-line bg-white text-muted hover:border-brand-300 hover:bg-canvas-soft'}`}>
    <span className="mb-1.5 flex h-11 w-full items-center justify-center rounded-md bg-gradient-to-br from-slate-50 to-slate-200"><Icon className="h-6 w-6 text-brand-700" /></span>
    <span className="line-clamp-2 text-[10px] font-semibold leading-tight">{variant.name}</span>
    {variant.w ? <span className="mt-0.5 text-[9px] text-muted">{variant.w} × {variant.h} size</span> : null}
  </button>
}

function describePlotPatch(plot: NonNullable<AssistantPlan['plot']>): string {
  const changes = [
    plot.width !== undefined ? `width ${plot.width}` : '',
    plot.length !== undefined ? `length ${plot.length}` : '',
    plot.units ? `units ${plot.units}` : '',
    plot.shape ? `plot type ${plot.shape}` : '',
  ].filter(Boolean).join(' · ')
  return `Update plot settings: ${changes}${plot.shape ? ' (plot type is saved as metadata; the drawing boundary remains rectangular)' : ''}`
}

function describeProjectPatch(project: NonNullable<AssistantPlan['project']>): string {
  const details = [
    project.name ? `name “${project.name}”` : '',
    project.location ? `location ${project.location}` : '',
    project.buildingType ? `type ${project.buildingType}` : '',
    project.bedrooms !== undefined ? `${project.bedrooms} bedrooms` : '',
    project.bathrooms !== undefined ? `${project.bathrooms} bathrooms` : '',
    project.style ? `style ${project.style}` : '',
    project.roof ? `roof preview ${project.roof}` : '',
    project.budget ? `budget ${project.budget.amount.toLocaleString()} ${project.budget.currency}` : '',
  ]
  const preferences = project.preferences ? Object.entries(project.preferences).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('; ') : ''
  return `Update project${details.some(Boolean) ? `: ${details.filter(Boolean).join(' · ')}` : ''}${preferences ? ` · preferences: ${preferences}` : ''}`
}

function describeAction(action: AssistantAction, units: Units): string {
  switch (action.type) {
    case 'create_house': return `${action.replaceExisting === false ? 'Add' : 'Create'} floor plan with ${action.rooms.length} room${action.rooms.length === 1 ? '' : 's'}: ${action.rooms.slice(0, 5).map((room) => room.name).join(', ')}${action.rooms.length > 5 ? ', …' : ''}`
    case 'add_room': return `Add ${action.room.name} (${action.room.width} × ${action.room.length} ${units})`
    case 'resize_room': return `Resize ${action.room}${action.width ? ` to ${action.width}` : ''}${action.length ? ` × ${action.length}` : ''}${action.x !== undefined || action.y !== undefined ? ` · position ${action.x ?? 'unchanged'}, ${action.y ?? 'unchanged'}` : ''}`
    case 'move_room': return `Move ${action.room} to (${action.x}, ${action.y})`
    case 'rename_room': return `Rename ${action.room} to ${action.name}`
    case 'remove_room': return `Remove ${action.room}`
    case 'set_room_shape': return action.shape === 'custom' ? `Apply a custom outline to ${action.room} (${action.outline?.length ?? 0} points)` : `Change ${action.room} to ${action.shape}-shaped`
    case 'add_opening': return `Add ${action.kind} in ${action.room}${action.width ? ` · width ${action.width}` : ''}${action.height ? ` · height ${action.height}` : ''}${action.style ? ` · ${action.style}` : ''}${action.wall ? ` · ${action.wall} at ${action.offset ?? 'auto'} from start` : ''}`
    case 'edit_opening': return `Edit ${action.opening} in ${action.room}${action.label ? ` · label ${action.label}` : ''}${action.width ? ` · width ${action.width}` : ''}${action.height ? ` · height ${action.height}` : ''}${action.style ? ` · ${action.style}` : ''}${action.wall ? ` · host ${action.wall}` : ''}${action.offset !== undefined ? ` · offset ${action.offset}` : ''}${action.direction ? ` · ${action.direction} swing` : ''}${action.hingeSide ? ` · ${action.hingeSide} hinge` : ''}`
    case 'remove_opening': return `Remove ${action.opening ?? action.kind ?? 'opening'} from ${action.room}`
    case 'add_furniture': return `Place ${action.item} in ${action.room}${action.width || action.depth ? ` · ${action.width ?? 'default'} × ${action.depth ?? 'default'}` : ''}`
    case 'edit_furniture': return `Adjust ${action.item} in ${action.room}${action.width || action.depth ? ` · ${action.width ?? 'unchanged'} × ${action.depth ?? 'unchanged'}` : ''}${action.x !== undefined || action.z !== undefined ? ` · position ${action.x ?? 'unchanged'}, ${action.z ?? 'unchanged'}` : ''}${action.rotationDegrees !== undefined ? ` · rotation ${action.rotationDegrees}°` : ''}${action.scale !== undefined ? ` · scale ${action.scale}` : ''}${action.color ? ` · color ${action.color}` : ''}`
    case 'remove_furniture': return `Remove ${action.item} from ${action.room}`
    case 'set_room_finish': return `Set ${action.room} finish to ${action.finish}`
    case 'set_wall_thickness': return `Set ${action.kind} wall thickness to ${action.value} ${units}`
    case 'add_site_item': return `Add ${action.kind} to the site at (${action.x}, ${action.y})`
    case 'edit_site_item': return `Adjust site object ${action.site}${action.x !== undefined || action.y !== undefined ? ` · position ${action.x ?? 'unchanged'}, ${action.y ?? 'unchanged'}` : ''}${action.rotationDegrees !== undefined ? ` · rotation ${action.rotationDegrees}°` : ''}${action.scale !== undefined ? ` · scale ${action.scale}` : ''}${action.color ? ` · color ${action.color}` : ''}`
    case 'remove_site_item': return `Remove site object ${action.site}`
  }
}

function readSessionValue(key: string): string {
  try { return sessionStorage.getItem(key) ?? '' } catch { return '' }
}
