import { describe, expect, it } from 'vitest'
import type { SiteVertex } from '@/types'
import { classifyBoundaryShape, pointInPolygon, polygonArea, validateSiteBoundary } from '@/lib/siteGeometry'

const polygon = (...points: [number, number][]): SiteVertex[] => points.map(([x, y], index) => ({ id: `v${index + 1}`, x, y }))

describe('site boundary geometry', () => {
  it('calculates polygon area for a concave L-shaped site', () => {
    const outline = polygon([0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10])
    expect(polygonArea(outline)).toBe(64)
    expect(pointInPolygon({ x: 2, y: 8 }, outline)).toBe(true)
    expect(pointInPolygon({ x: 8, y: 8 }, outline)).toBe(false)
  })

  it('classifies only axis-aligned four-corner outlines as square or rectangle', () => {
    expect(classifyBoundaryShape(polygon([0, 0], [20, 0], [20, 20], [0, 20]))).toBe('square')
    expect(classifyBoundaryShape(polygon([0, 0], [30, 0], [30, 20], [0, 20]))).toBe('rectangle')
    expect(classifyBoundaryShape(polygon([0, 0], [30, 0], [30, 20], [12, 20], [12, 8], [0, 8]))).toBe('irregular')
  })

  it('rejects self-crossing, duplicated, zero-area and out-of-envelope boundaries', () => {
    const bowtie = polygon([0, 0], [10, 10], [0, 10], [10, 0])
    const bowtieIssues = validateSiteBoundary(bowtie, { width: 10, length: 10 })
    expect(bowtieIssues.some((issue) => issue.code === 'self-intersection')).toBe(true)
    expect(bowtieIssues.some((issue) => issue.code === 'zero-area')).toBe(true)

    const outside = polygon([0, 0], [12, 0], [12, 10], [0, 10])
    expect(validateSiteBoundary(outside, { width: 10, length: 10 }).some((issue) => issue.code === 'outside-envelope')).toBe(true)

    const duplicated = polygon([0, 0], [10, 0], [10, 0], [0, 10])
    expect(validateSiteBoundary(duplicated).some((issue) => issue.code === 'duplicate-vertex')).toBe(true)
  })

  it('requires at least three points and treats boundary points as inside', () => {
    expect(validateSiteBoundary(polygon([0, 0], [1, 0])).map((issue) => issue.code)).toContain('too-few-vertices')
    const rect = polygon([0, 0], [10, 0], [10, 8], [0, 8])
    expect(pointInPolygon({ x: 10, y: 3 }, rect)).toBe(true)
    expect(validateSiteBoundary(rect, { width: 10, length: 8 })).toEqual([])
  })
})
