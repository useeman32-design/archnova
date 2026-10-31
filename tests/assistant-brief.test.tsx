import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AssistantPanel } from '@/components/ai-assistant/AssistantPanel'
import { createProjectFromForm } from '@/lib/projectFactory'
import { defaultNewProjectForm } from '@/lib/defaultForm'

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('large project clarification flow', () => {
  it('collects building, storey, site-element and plot choices before requesting a proposal', async () => {
    sessionStorage.setItem('archnova:groq-api-key', 'test-key')
    const project = createProjectFromForm(defaultNewProjectForm())
    const responseContent = JSON.stringify({
      reply: 'I prepared the separate-block proposal.',
      actions: [{ type: 'add_building', name: 'Surgery Block', purpose: { category: 'institutional', use: 'hospital surgery' }, role: 'secondary', width: 20, length: 16, floorCount: 2 }],
    })
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: responseContent } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AssistantPanel
      open
      onClose={vi.fn()}
      project={project}
      rooms={[]}
      placed={{}}
      ornaments={[]}
      wallThicknesses={{ exterior: 0.75, interior: 0.375 }}
      walls={[]}
      units="ft"
      onApplyPlan={vi.fn()}
    />)

    fireEvent.change(screen.getByPlaceholderText('Describe a design change…'), { target: { value: 'Build a complete hospital on a random plot.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByLabelText('Large project clarification')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '2–3' }))
    fireEvent.change(screen.getByPlaceholderText(/Main hospital, surgery block/), { target: { value: 'Main hospital, surgery block, wards, administration' } })
    fireEvent.click(screen.getByRole('button', { name: '2 storeys' }))
    fireEvent.click(screen.getByLabelText('Parking'))
    fireEvent.click(screen.getByLabelText('Access roads'))
    fireEvent.click(screen.getByRole('button', { name: /Use current plot/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue to proposal' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    const submittedPrompt = body.messages.at(-1).content as string
    expect(submittedPrompt).toContain('[CONFIRMED PROJECT BRIEF]')
    expect(submittedPrompt).toContain('Main hospital, surgery block, wards, administration')
    expect(submittedPrompt).toContain('parking: include')
    expect(submittedPrompt).toContain('roads: include')
    expect(submittedPrompt).toContain('Use the current plot dimensions 50 × 50 ft')
    expect(await screen.findByText(/Review proposed edits/)).toBeTruthy()
    expect(screen.getByText(/Add separate secondary building “Surgery Block”/)).toBeTruthy()
  })
})
