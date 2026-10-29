import { PlanEditor } from '@/components/editor/PlanEditor'

/**
 * Screen C/E — the Floor Plan view: a pure 2D editing canvas.
 * The 3D lives on its own "3D View" tab, as in dedicated design software.
 */
export function WorkspaceOverview() {
  return <PlanEditor />
}
