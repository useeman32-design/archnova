import { useNavigate, useParams } from 'react-router-dom'
import type { AssetItem } from '@/data/assets'
import { variantFromAsset } from '@/data/toolLibrary'
import { AssetsView } from '@/components/assets/AssetsView'
import { useWorkspace } from './WorkspaceLayout'

/** Assets inside the workspace: model placement is armed; material application previews until Save. */
export function WorkspaceAssetsPage() {
  const { setPending, setTool, setPreviewExt, setPreviewInt } = useWorkspace()
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const handleAdd = (asset: AssetItem) => {
    if (asset.assetKind === 'material') {
      switch (asset.sourceAssetId) {
        case 'brushed_concrete': setPreviewExt('concrete'); break
        case 'brick_pavement': setPreviewExt('brick'); break
        case 'american_walnut_veneer': setPreviewInt('wood'); break
        case 'stone_pavers': setPreviewExt('stone'); break
        // Road and path materials are automatically bound to their dimension-driven site systems.
        default: break
      }
      return
    }
    const arm = variantFromAsset(asset)
    if (!arm) return
    setPending(arm)
    setTool(arm.tool)
    navigate(`/workspace/${id}`)
  }

  return <AssetsView onAdd={handleAdd} />
}
