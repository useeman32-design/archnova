import { afterEach, describe, expect, it, vi } from 'vitest'
import { localSmallTalkReply, requestAssistantPlan, testGroqConnection, DEFAULT_GROQ_MODEL } from '@/services/groqAssistant'
import { createProjectFromForm } from '@/lib/projectFactory'
import { defaultNewProjectForm } from '@/lib/defaultForm'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('Groq assistant client', () => {
  it('answers simple greetings locally without spending Groq tokens', () => {
    expect(localSmallTalkReply('hello')).toMatch(/Hi!/)
    expect(localSmallTalkReply('Thanks!')).toMatch(/welcome/i)
    expect(localSmallTalkReply('Add a window to the kitchen')).toBeNull()
  })

  it('sends compact project context with a bounded completion budget', async () => {
    const streamedPlan = JSON.stringify({
      reply: 'I will add a study.',
      actions: [{ type: 'add_room', room: { name: 'Study', category: 'study', width: 10, length: 9, x: 2, y: 3 } }],
      unsupported: ['An upper floor needs a separate design workflow.'],
    })
    const chunks = [...streamedPlan].map((token) => `data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n`).join('')
    const fetchMock = vi.fn().mockResolvedValue(new Response(`${chunks}data: [DONE]\n`, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
    vi.stubGlobal('fetch', fetchMock)
    const project = createProjectFromForm(defaultNewProjectForm())
    const progress = vi.fn()
    const plan = await requestAssistantPlan({
      apiKey: 'gsk-test-user-key', model: DEFAULT_GROQ_MODEL,
      context: { project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 }, walls: [], units: project.plot.units },
      history: [], prompt: 'Add a study to this project.', onProgress: progress,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gsk-test-user-key')
    const body = JSON.parse(String(init.body))
    expect(body.stream).toBe(true)
    expect(body.max_completion_tokens).toBe(1400)
    expect(body.response_format).toBeUndefined()
    expect(JSON.stringify(body.messages).length).toBeLessThan(16000)
    expect(body.messages.some((message: { content: string }) => message.content.includes(project.name))).toBe(true)
    expect(body.messages[1].content).toContain('furnitureItems')
    expect(body.messages[1].content).toContain('single-hinged')
    expect(body.messages[1].content).toContain('roofForms')
    expect(plan.actions).toEqual([{ type: 'add_room', room: { name: 'Study', category: 'study', width: 10, length: 9, x: 2, y: 3 } }])
    expect(plan.unsupported).toEqual(['An upper floor needs a separate design workflow.'])
    expect(progress).toHaveBeenCalledWith(expect.stringContaining('Groq is'))
  })

  it('retries a direct edit once when Groq replies conversationally without an operation', async () => {
    const project = createProjectFromForm(defaultNewProjectForm())
    const jsonResponse = (content: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ reply: 'Sure, I can help add that.', actions: [] }))
      .mockResolvedValueOnce(jsonResponse({ reply: 'I prepared the study.', actions: [{ type: 'add_room', room: { name: 'Study', category: 'study', width: 10, length: 10 } }] }))
    vi.stubGlobal('fetch', fetchMock)
    const progress = vi.fn()
    const plan = await requestAssistantPlan({
      apiKey: 'key', model: DEFAULT_GROQ_MODEL,
      context: { project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 }, walls: [], units: project.plot.units },
      history: [], prompt: 'Add a study room.', onProgress: progress,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const recoveryBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))
    expect(recoveryBody.max_completion_tokens).toBe(900)
    expect(recoveryBody.messages.some((message: { content: string }) => message.content.includes('ACTION RECOVERY'))).toBe(true)
    expect(plan.actions).toEqual([{ type: 'add_room', room: { name: 'Study', category: 'study', width: 10, length: 10 } }])
    expect(progress).toHaveBeenCalledWith(expect.stringContaining('Retrying once'))
  })

  it('normalizes a room-by-room create_house response and uses room defaults for omitted dimensions', async () => {
    const project = createProjectFromForm(defaultNewProjectForm())
    const planText = JSON.stringify({
      reply: 'Created your home.',
      plot: { width: 50, length: 50, units: 'ft' },
      actions: [{ type: 'create_house', replaceExisting: true, rooms: [
        { name: 'Bedroom One', category: 'bedroom', width: 12, length: 12 },
        { name: 'Primary Bedroom', type: 'bedroom' },
        { name: 'Kitchen', category: 'kitchen', dimensions: { width: 12, length: 10 } },
      ] }],
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: planText } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const plan = await requestAssistantPlan({
      apiKey: 'key', model: DEFAULT_GROQ_MODEL,
      context: { project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 }, walls: [], units: 'ft' },
      history: [], prompt: 'Create a house with a 50 by 50 plot and at least two bedrooms and one kitchen.',
    })
    expect(plan.actions).toEqual([{
      type: 'create_house', replaceExisting: true, rooms: [
        { name: 'Bedroom One', category: 'bedroom', width: 12, length: 12 },
        { name: 'Primary Bedroom', category: 'bedroom', width: 12, length: 12 },
        { name: 'Kitchen', category: 'kitchen', width: 12, length: 10 },
      ],
    }])
    expect(plan.plot).toEqual({ width: 50, length: 50, units: 'ft' })
    expect(plan.reply).toMatch(/proposal for review/i)
    expect(plan.reply).not.toMatch(/^Created/i)
    expect(plan.assumptions).toContain('Standard room dimensions were used for any room whose size was omitted.')
  })

  it('does not tell the user a house was created when the returned action is invalid', async () => {
    const project = createProjectFromForm(defaultNewProjectForm())
    const planText = JSON.stringify({
      reply: 'Created your home.', plot: { width: 50, length: 50, units: 'ft' },
      actions: [{ type: 'create_house', rooms: [{ name: 'Unknown', category: 'invented-room', width: 12, length: 12 }] }],
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: planText } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const plan = await requestAssistantPlan({
      apiKey: 'key', model: DEFAULT_GROQ_MODEL,
      context: { project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 }, walls: [], units: 'ft' },
      history: [], prompt: 'Create a house on a 50 by 50 plot.',
    })
    expect(plan.actions).toEqual([])
    expect(plan.plot).toBeUndefined()
    expect(plan.reply).toMatch(/not created/i)
    expect(plan.unsupported?.join(' ')).toMatch(/create_house/i)
  })

  it('converts provider auth failures into a useful key error without exposing the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'invalid key text' } }), { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const project = createProjectFromForm(defaultNewProjectForm())
    await expect(requestAssistantPlan({
      apiKey: 'secret-test-key', model: DEFAULT_GROQ_MODEL,
      context: { project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 }, walls: [], units: project.plot.units }, history: [], prompt: 'Make a plan',
    })).rejects.toThrow(/Groq rejected this API key/)
  })

  it('retries token-budget failures once with no history and a smaller project summary', async () => {
    const project = createProjectFromForm(defaultNewProjectForm())
    const success = new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: 'Done.', actions: [] }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    const tooLarge = new Response(JSON.stringify({ error: { message: 'Request too large for model; requested 12406 tokens, TPM limit 8000' } }), { status: 400 })
    const fetchMock = vi.fn().mockResolvedValueOnce(tooLarge).mockResolvedValueOnce(success)
    vi.stubGlobal('fetch', fetchMock)
    await expect(requestAssistantPlan({
      apiKey: 'key', model: DEFAULT_GROQ_MODEL,
      context: { project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 }, walls: [], units: project.plot.units },
      history: [{ role: 'user', content: 'old' }, { role: 'assistant', content: 'old answer' }], prompt: 'Tell me one design tip.'
    })).resolves.toMatchObject({ reply: 'Done.' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const retryBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))
    expect(retryBody.max_completion_tokens).toBe(650)
    expect(retryBody.messages).toHaveLength(3)
  })

  it('retries transient rate limits twice and reports retry progress', async () => {
    vi.useFakeTimers()
    const success = new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: 'Done.', actions: [] }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    const limited = () => new Response(JSON.stringify({ error: { message: 'rate_limit_exceeded' } }), { status: 429, headers: { 'Retry-After': '0.001' } })
    const fetchMock = vi.fn().mockResolvedValueOnce(limited()).mockResolvedValueOnce(limited()).mockResolvedValueOnce(success)
    vi.stubGlobal('fetch', fetchMock)
    const project = createProjectFromForm(defaultNewProjectForm())
    const progress = vi.fn()
    const pending = requestAssistantPlan({
      apiKey: 'key', model: DEFAULT_GROQ_MODEL,
      context: { project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 }, walls: [], units: project.plot.units },
      history: [], prompt: 'Tell me one design tip.', onProgress: progress,
    })
    await vi.advanceTimersByTimeAsync(2)
    await vi.advanceTimersByTimeAsync(2)
    await expect(pending).resolves.toMatchObject({ reply: 'Done.', actions: [] })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(progress.mock.calls.filter(([message]) => String(message).includes('rate-limiting'))).toHaveLength(2)
  })

  it('does not retry quota or billing limit responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Monthly quota exceeded' } }), { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)
    const project = createProjectFromForm(defaultNewProjectForm())
    await expect(requestAssistantPlan({
      apiKey: 'key', model: DEFAULT_GROQ_MODEL,
      context: { project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 }, walls: [], units: project.plot.units }, history: [], prompt: 'Add a tree.',
    })).rejects.toThrow(/quota reached/i)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('checks the key and selects a model available to the account', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'openai/gpt-oss-20b' }, { id: 'whisper-large-v3' }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(testGroqConnection('key', 'llama-3.3-70b-versatile')).resolves.toEqual({
      models: ['openai/gpt-oss-20b', 'whisper-large-v3'], selectedModel: 'openai/gpt-oss-20b',
    })
    expect(fetchMock.mock.calls[0][0]).toContain('/models')
  })

  it('grounds extended operations in the live feature catalog and flags unmappable edits', async () => {
    const planText = JSON.stringify({
      reply: 'I updated the site and project finishes.',
      assumptions: ['The selected wall finish is a visual preview only.'],
      project: { location: 'Lagos', budget: { amount: 60000000, currency: 'NGN' }, preferences: { exteriorFinish: 'paint', outdoor: ['garden'], roofColor: '#33415c' } },
      plot: { shape: 'rectangle', units: 'ft' },
      wallThicknesses: { exterior: 0.75 },
      actions: [
        { type: 'set_wall_thickness', kind: 'interior', value: 0.375 },
        { type: 'add_site_item', kind: 'palm', x: 5, y: 6, rotationDegrees: 45 },
        { type: 'add_furniture', room: 'Living Room', item: 'imaginary-teleporter' },
      ],
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: planText } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const project = createProjectFromForm(defaultNewProjectForm())
    const plan = await requestAssistantPlan({
      apiKey: 'key', model: DEFAULT_GROQ_MODEL,
      context: { project, rooms: [], placed: {}, ornaments: [], wallThicknesses: { exterior: 0.75, interior: 0.375 }, walls: [], units: project.plot.units },
      history: [], prompt: 'Adjust the design controls.',
    })
    expect(plan.actions).toEqual([
      { type: 'set_wall_thickness', kind: 'interior', value: 0.375 },
      { type: 'add_site_item', kind: 'palm', x: 5, y: 6, rotationDegrees: 45 },
    ])
    expect(plan.project?.location).toBe('Lagos')
    expect(plan.project?.preferences?.outdoor).toEqual(['garden'])
    expect(plan.plot?.units).toBe('ft')
    expect(plan.assumptions).toContain('The selected wall finish is a visual preview only.')
    expect(plan.unsupported?.[0]).toContain('did not match a supported')
  })

})
