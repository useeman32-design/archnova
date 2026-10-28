import type { PlanDocument } from '@/types'

export const PLAN_DOCUMENTS: PlanDocument[] = [
  {
    id: 'doc_floor_plan',
    type: 'floor-plan',
    label: 'Floor plans',
    description: 'Scaled plan drawings for each level with room sizes and door openings.',
    status: 'preview',
    formats: ['pdf', 'png', 'svg', 'dwg'],
  },
  {
    id: 'doc_elevation',
    type: 'elevation',
    label: 'Exterior elevations',
    description: 'Front, side and rear elevations showing the façade treatment.',
    status: 'preview',
    formats: ['pdf', 'png', 'svg'],
  },
  {
    id: 'doc_section',
    type: 'section',
    label: 'Building sections',
    description: 'Cut-through drawings showing levels, structure and headroom.',
    status: 'coming-soon',
    formats: ['pdf', 'dwg'],
  },
  {
    id: 'doc_roof',
    type: 'roof',
    label: 'Roof plan',
    description: 'Roof geometry, gutter runs and drainage direction.',
    status: 'coming-soon',
    formats: ['pdf', 'png', 'svg'],
  },
  {
    id: 'doc_report',
    type: 'report',
    label: 'Project report',
    description: 'Area schedule, budget estimate and specification summary.',
    status: 'preview',
    formats: ['pdf'],
  },
]
