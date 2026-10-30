import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestAssistantPlan, testGroqConnection, DEFAULT_GROQ_MODEL } from '@/services/groqAssistant'
import { createProjectFromForm } from '@/lib/projectFactory'
import { defaultNewProjectForm } from '@/lib/defaultForm'

afterEach(() => vi.unstubAllGlobals())

describe('Groq assistant client', () => {
  it('sends project context to Groq and safely parses the structured action plan', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        reply: 'I will add a study.',
        actions: [{ type: 'add_room', room: { name: 'Study', category: 'study', width: 10, length: 9, x: 2, y: 3 } }],
      }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const project = createProjectFromForm(defaultNewProjectForm())
    const plan = await requestAssistantPlan({
      apiKey: 'gsk-test-user-key', model: DEFAULT_GROQ_MODEL,
      context: { project, rooms: [], placed: {}, units: project.plot.units },
      history: [], prompt: 'Add a study to this project.',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gsk-test-user-key')
    const body = JSON.parse(String(init.body))
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages.some((message: { content: string }) => message.content.includes(project.name))).toBe(true)
    expect(plan.actions).toEqual([{ type: 'add_room', room: { name: 'Study', category: 'study', width: 10, length: 9, x: 2, y: 3 } }])
  })

  it('converts provider auth failures into a useful key error without exposing the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'invalid key text' } }), { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const project = createProjectFromForm(defaultNewProjectForm())
    await expect(requestAssistantPlan({
      apiKey: 'secret-test-key', model: DEFAULT_GROQ_MODEL,
      context: { project, rooms: [], placed: {}, units: project.plot.units }, history: [], prompt: 'Make a plan',
    })).rejects.toThrow(/Groq rejected this API key/)
  })

  it('checks a key and requested model with the provider models endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: DEFAULT_GROQ_MODEL }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(testGroqConnection('key', DEFAULT_GROQ_MODEL)).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0][0]).toContain('/models')
  })
})
