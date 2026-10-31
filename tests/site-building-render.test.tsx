import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FloorPlanDiagram } from '@/components/floor-plan/FloorPlanDiagram'
import type { SiteBoundary } from '@/types'

describe('separate site building footprints', () => {
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
        ] } },
        { id: 'building-b', name: 'Overflow Ward', role: 'service', footprint: { ...boundary, id: 'footprint-b', vertices: [
          { id: 'b1', x: 48, y: 30 }, { id: 'b2', x: 62, y: 30 }, { id: 'b3', x: 62, y: 42 }, { id: 'b4', x: 48, y: 42 },
        ] } },
      ]}
      trees={[{ id: 'road-outside', kind: 'road', x: 58, y: 14, width: 8, length: 12, rotation: 0, scale: 1, color: '#51565d' }]}
    />)
    expect(markup).toContain('Emergency Block')
    expect(markup).toContain('Overflow Ward · OUTSIDE')
    expect(markup).toContain('OUTSIDE PLOT')
    expect(markup).toContain('stroke="#dc2626"')
    expect(markup).toContain('viewBox="-12 -20 86 90"')
  })
})
