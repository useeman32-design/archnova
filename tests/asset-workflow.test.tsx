import { beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'
import { createLocalProjectService } from '@/services/projectService'

beforeAll(() => {
  if (!window.matchMedia) Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {} }) })
  if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  if (!globalThis.DOMPoint) globalThis.DOMPoint = class { constructor(public x = 0, public y = 0) {} matrixTransform() { return this } } as unknown as typeof DOMPoint
  if (SVGSVGElement.prototype.getScreenCTM === undefined) Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', { value: () => ({ inverse: () => ({}) }) })
})

describe('real GLTF project workflow', () => {
  it('places a catalog model from Assets into a room and persists the exact ID on Save/reload', async () => {
    localStorage.clear()
    const service = createLocalProjectService()
    const project = (await service.list())[0]
    const room = project.floors.flatMap((floor) => floor.rooms).find((candidate) => candidate.category === 'living')
    expect(room).toBeTruthy()
    render(<MemoryRouter initialEntries={[`/workspace/${project.id}/assets`]}><App /></MemoryRouter>)

    const add = await screen.findByRole('button', { name: 'Place Modern Arm Chair 01' })
    fireEvent.click(add)
    await screen.findByText(/Placing: Modern Arm Chair 01/)
    fireEvent.click(screen.getByRole('button', { name: `Select ${room!.name}` }), { clientX: room!.rect.x + room!.rect.w / 2, clientY: room!.rect.y + room!.rect.h / 2 })
    await screen.findByText(/Modern Arm Chair 01/)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      const reloaded = await createLocalProjectService().get(project.id)
      const saved = reloaded?.floors.flatMap((floor) => floor.rooms).find((candidate) => candidate.id === room!.id)
      expect(saved?.items?.some((item) => item.assetId === 'ph_model_modern_arm_chair_01')).toBe(true)
    })
    cleanup()
  }, 20000)
})
