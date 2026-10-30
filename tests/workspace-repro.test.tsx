/**
 * Headless repro: renders the real App through MemoryRouter the same way the
 * browser does — first the home page (which seeds sample projects into
 * localStorage), then navigates into the workspace of a seeded project.
 * If the top-level error boundary fallback appears, the captured window
 * errors are thrown with full stacks.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, waitFor, cleanup, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'
import { ASSETS } from '@/data/assets'
import { variantFromAsset } from '@/data/toolLibrary'
import { FloorPlanDiagram } from '@/components/floor-plan/FloorPlanDiagram'
import { roomArea } from '@/lib/floorPlan'
import type { Room } from '@/types'

const captured: unknown[] = []

beforeAll(() => {
  // --- jsdom polyfills the real browser provides ---
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }
  if (!(globalThis as any).ResizeObserver) {
    ;(globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function () {}
    Element.prototype.releasePointerCapture = function () {}
    Element.prototype.hasPointerCapture = function () {
      return false
    }
  }
  if (!window.scrollTo) window.scrollTo = (() => {}) as any

  window.addEventListener('error', (event) => {
    captured.push(event.error ?? event.message)
  })
  window.addEventListener('unhandledrejection', (event: any) => {
    captured.push(event.reason)
  })
  const origError = console.error
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    captured.push(args.map(String).join(' '))
    origError(...(args as []))
  })
})

function projectIdsFromStorage(): string[] {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.endsWith('projects')) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? '[]')
        if (Array.isArray(parsed)) return parsed.map((p: any) => p.id)
      } catch {
        /* keep scanning */
      }
    }
  }
  return []
}

function fmt(errs: unknown[]): string {
  return errs
    .map((e) => {
      if (e instanceof Error) return `${e.name}: ${e.message}\n${e.stack ?? ''}`
      return String(e)
    })
    .filter((s) => !s.includes('Not implemented: HTMLFormElement'))
    .join('\n=====\n')
}

describe('custom room outline geometry', () => {
  const room = {
    id: 'outline-test', name: 'Test', category: 'other', width: 4, length: 6, units: 'm',
    rect: { x: 0, y: 0, w: 4, h: 6 }, level: 1, furniture: [], elements: [],
  } as Room

  it('uses polygon area for a concave custom outline', () => {
    expect(roomArea({ ...room, shape: 'custom', outline: [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.75, y: 1 },
      { x: 0.75, y: 0.5 }, { x: 0.25, y: 0.5 }, { x: 0.25, y: 1 }, { x: 0, y: 1 },
    ] })).toBe(18)
  })
})

describe('workspace opens', () => {
  it('renders an empty plot boundary for a start-from-scratch plan', () => {
    render(<FloorPlanDiagram rooms={[]} units="ft" plot={{ width: 40, length: 60 }} showBoundary />)
    expect(document.body.textContent).toContain('Empty plot')
    expect(document.body.textContent).toContain('Choose Rooms')
    cleanup()
  })

  it('home seeds projects, then /workspace/:id renders without the crash fallback', async () => {
    // Pass 1: home page — seeds localStorage via projectService.list()
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(projectIdsFromStorage().length).toBeGreaterThan(0)
    }, { timeout: 5000 })
    const ids = projectIdsFromStorage()
    cleanup()

    // Pass 2: the workspace route the user says crashes
    captured.length = 0
    render(
      <MemoryRouter initialEntries={[`/workspace/${ids[0]}`]}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => {
      const text = document.body.textContent ?? ''
      if (text.includes('Something went wrong rendering ArchNova')) {
        throw new Error(`WORKSPACE CRASH REPRODUCED for ${ids[0]}:\n${fmt(captured)}`)
      }
      // success looks like the project header + plan editor mounted
      expect(text).toMatch(/Floor Plan|Save|Assistant/)
    }, { timeout: 8000 })
    cleanup()
  }, 30000)

  it('workspace sub-routes and asset deep-link render without the crash fallback', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => expect(projectIdsFromStorage().length).toBeGreaterThan(0), { timeout: 5000 })
    const id = projectIdsFromStorage()[0]
    cleanup()

    const placeable = ASSETS.find((a) => variantFromAsset(a))
    const routes = [
      `/workspace/${id}/assets`,
      `/workspace/${id}/drawings`,
      `/workspace/${id}/3d`,
      `/assets`,
    ]
    if (placeable) routes.push(`/workspace/${id}?add=${placeable.id}`)

    for (const route of routes) {
      captured.length = 0
      render(
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>,
      )
      // give lazy/effects a tick
      await new Promise((r) => setTimeout(r, 120))
      const text = document.body.textContent ?? ''
      if (text.includes('Something went wrong rendering ArchNova')) {
        throw new Error(`CRASH at ${route}:\n${fmt(captured)}`)
      }
      cleanup()
    }
  }, 60000)

  it('opens the Groq assistant with an API-key field and actionable error without a key', async () => {
    localStorage.clear()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await waitFor(() => expect(projectIdsFromStorage().length).toBeGreaterThan(0), { timeout: 5000 })
    const id = projectIdsFromStorage()[0]
    localStorage.setItem(`pixelstudios.house.ai-chat:${id}`, JSON.stringify([{ id: 'old-error', role: 'assistant', text: 'Failed to validate JSON', createdAt: Date.now() }]))
    cleanup()
    render(<MemoryRouter initialEntries={[`/workspace/${id}`]}><App /></MemoryRouter>)
    await waitFor(() => expect(document.body.textContent).toMatch(/Floor Plan|Save/), { timeout: 8000 })
    fireEvent.click(screen.getByRole('button', { name: 'Assistant' }))
    expect(screen.queryByLabelText('Groq API key')).toBeNull()
    expect(screen.queryByText('Failed to validate JSON')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Groq settings' }))
    expect(await screen.findByLabelText('Groq API key')).toBeTruthy()
    expect(screen.getByLabelText('Model')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide Groq settings' }))
    expect(screen.queryByLabelText('Groq API key')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Groq settings' }))
    fireEvent.change(screen.getByPlaceholderText('Describe a design change…'), { target: { value: 'Add a study room' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Paste your Groq API key')
    cleanup()
  }, 30000)
})
