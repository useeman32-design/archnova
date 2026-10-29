import { useNavigate } from 'react-router-dom'
import type { AssetItem } from '@/data/assets'
import { variantFromAsset } from '@/data/toolLibrary'
import { AssetsView } from '@/components/assets/AssetsView'
import { useWorkspace } from './WorkspaceLayout'

/** Assets inside the workspace: clicking + arms the matching tool and jumps to the 2D plan. */
export function WorkspaceAssetsPage() {
  const { setPending, setTool } = useWorkspace()
  const navigate = useNavigate()

  const handleAdd = (asset: AssetItem) => {
    const arm = variantFromAsset(asset)
    if (!arm) return
    setPending(arm)
    setTool(arm.tool)
    navigate('')
  }

  return <AssetsView onAdd={handleAdd} />
}
