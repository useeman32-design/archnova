import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FloorPlanDiagram } from '@/components/floor-plan/FloorPlanDiagram'
import { TOOL_GROUPS } from '@/data/toolLibrary'
import type { SiteBoundary } from '@/types'

if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

describe('separate site building footprints', () => {
  it('offers a unit-aware conceptual parking bay in the site palette', () => {
    const bay = TOOL_GROUPS.find((group) => group.tool === 'trees')?.categories.flatMap((category) => category.variants).find((variant) => variant.kind === 'parking-bay')
    expect(bay).toMatchObject({ id: 'site_parking_bay', name: 'Conceptual Parking Bay', kind: 'parking-bay' })
    expect(bay?.w).toBeUndefined()
    expect(bay?.h).toBeUndefined()
  })

  it('renders a conceptual parking bay in the 2D site view', () => {
    const markup = renderToStaticMarkup(<FloorPlanDiagram rooms={[]} units="ft" plot={{ width: 40, length: 30 }} trees={[{ id: 'parking-1', kind: 'parking-bay', x: 12, y: 14, width: 9, length: 18, rotation: 0, scale: 1, color: '#59616a' }]} />)
    expect(markup).toContain('Select parking-bay')
    expect(markup).toContain('fill="#59616a"')
    expect(markup).toContain('>P</text>')
  })

  it('renders user-designated vehicle access on the matching boundary edge', () => {
    const boundary: SiteBoundary = {
      id: 'plot-boundary', shape: 'rectangle', units: 'ft', status: 'defined', source: 'user-drawn',
      vertices: [
        { id: 'v1', x: 0, y: 0 }, { id: 'v2', x: 40, y: 0 },
        { id: 'v3', x: 40, y: 30 }, { id: 'v4', x: 0, y: 30 },
      ], assumptions: [],
    }
    const markup = renderToStaticMarkup(<FloorPlanDiagram rooms={[]} units="ft" plot={{ width: 40, length: 30 }} siteBoundary={boundary} siteAccessPoints={[{ id: 'access-1', fromVertexId: 'v1', toVertexId: 'v2', fraction: 0.25, type: 'vehicle' }]} siteRoutes={[{ id: 'route-1', kind: 'path', width: 4, points: [{ x: 10, y: 0 }, { x: 20, y: 12 }, { x: 22, y: 18 }] }]} />)
    expect(markup).toContain('path route')
    expect(markup).toContain('User-connected conceptual path')
    expect(markup).toContain('User-designated site access points')
    expect(markup).toContain('Vehicle access point, designated by user')
    expect(markup).toContain('>V</text>')
  })

  it('renders each building independently and expands the 2D view to show red overflow', () => {
    const boundary: SiteBoundary = {
      id: 'plot-boundary', shape: 'rectangle', units: 'ft', status: 'defined', source: 'user-drawn',
      vertices: [
        { id: 'v1', x: 0, y: 0 }, { id: 'v2', x: 50, y: 0 },
        { id: 'v3', x: 50, y: 50 }, { id: 'v4', x: 0, y: 50 },
      ], assumptions: [],
    }
    const markup = renderToStaticMarkup(<FloorPlanDiagram
      rooms={[]}
      units="ft"
      plot={{ width: 50, length: 50 }}
      siteBoundary={boundary}
      buildingFootprints={[
        { id: 'building-a', name: 'Emergency Block', role: 'secondary', footprint: { ...boundary, id: 'footprint-a', vertices: [
          { id: 'a1', x: 6, y: 6 }, { id: 'a2', x: 26, y: 6 }, { id: 'a3', x: 26, y: 20 }, { id: 'a4', x: 6, y: 20 },
        ] }, entrances: [{ id: 'main-entry', fromVertexId: 'a1', toVertexId: 'a2', fraction: 0.5, type: 'main' }] },
        { id: 'building-b', name: 'Overflow Ward', role: 'service', footprint: { ...boundary, id: 'footprint-b', vertices: [
          { id: 'b1', x: 48, y: 30 }, { id: 'b2', x: 62, y: 30 }, { id: 'b3', x: 62, y: 42 }, { id: 'b4', x: 48, y: 42 },
        ] } },
      ]}
      trees={[{ id: 'road-outside', kind: 'road', x: 58, y: 14, width: 8, length: 12, rotation: 0, scale: 1, color: '#51565d' }]}
    />)
    expect(markup).toContain('Emergency Block')
    expect(markup).toContain('Main building entrance, designated by user')
    expect(markup).toContain('>E</text>')
    expect(markup).toContain('Overflow Ward · OUTSIDE')
    expect(markup).toContain('OUTSIDE PLOT')
    expect(markup).toContain('stroke="#dc2626"')
    expect(markup).toContain('viewBox="-12 -20 86 90"')
  })

  it('renders the selected block floor rooms as a site-plan overlay', () => {
    const markup = renderToStaticMarkup(<FloorPlanDiagram
      rooms={[]}
      units="ft"
      plot={{ width: 40, length: 30 }}
      buildingInterior={{
        buildingId: 'block-a', buildingName: 'Block A', floorLevel: 2, floorName: 'Level 2',
        rooms: [{
          id: 'bedroom-2', name: 'Bedroom 2', category: 'bedroom', width: 10, length: 10, units: 'ft',
          rect: { x: 8, y: 8, w: 10, h: 10 }, level: 2, furniture: [], elements: [],
        }],
      }}
    />)
    expect(markup).toContain('Block A · Level 2 interior rooms')
    expect(markup).toContain('Block A · Level 2 · Bedroom 2')
    expect(markup).toContain('fill="#e9eef9"')
  })

  it('lets the select tool drag a conceptual building footprint and reports its plan-unit offset', () => {
    const onMoveBuilding = vi.fn()
    const onSelectBuilding = vi.fn()
    const boundary: SiteBoundary = {
      id: 'plot-boundary', shape: 'rectangle', units: 'ft', status: 'defined', source: 'user-drawn',
      vertices: [
        { id: 'v1', x: 0, y: 0 }, { id: 'v2', x: 50, y: 0 },
        { id: 'v3', x: 50, y: 50 }, { id: 'v4', x: 0, y: 50 },
      ], assumptions: [],
    }
    const { getByRole } = render(<FloorPlanDiagram
      rooms={[]}
      units="ft"
      plot={{ width: 50, length: 50 }}
      dragEnabled
      onMoveBuilding={onMoveBuilding}
      onSelectBuilding={onSelectBuilding}
      buildingFootprints={[{ id: 'building-a', name: 'Block A', role: 'secondary', footprint: { ...boundary, id: 'footprint-a', vertices: [
        { id: 'a1', x: 6, y: 6 }, { id: 'a2', x: 26, y: 6 }, { id: 'a3', x: 26, y: 20 }, { id: 'a4', x: 6, y: 20 },
      ] }, entrances: [{ id: 'entry-a', fromVertexId: 'a1', toVertexId: 'a2', fraction: 0.5, type: 'main' }] }]}
    />)
    const block = getByRole('button', { name: 'Block A conceptual building footprint, drag to move' })
    fireEvent.pointerDown(block, { pointerId: 1, clientX: 10, clientY: 20 })
    fireEvent.pointerMove(block, { pointerId: 1, clientX: 22, clientY: 26 })
    fireEvent.pointerUp(block, { pointerId: 1, clientX: 22, clientY: 26 })
    expect(onSelectBuilding).toHaveBeenCalledWith('building-a')
    expect(onMoveBuilding).toHaveBeenCalledWith('building-a', 2, 1)
  })
})
