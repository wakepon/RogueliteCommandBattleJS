import { MapContent } from '../Common/MapContent'
import { MapNode } from '../../Lib/Types/Game'
import { Button } from '../Common/Button'
import { TOTAL_STAGES } from '../../Lib/Core/StageManager'

interface MapOverlayProps {
  nodes: MapNode[]
  currentStage: number
  onClose: () => void
}

export function MapOverlay({ nodes, currentStage, onClose }: MapOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex flex-col">
      {/* ヘッダー */}
      <div className="p-4 text-center border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">マップ</h1>
        <p className="text-sm text-gray-400 mt-1">
          ステージ {currentStage} / {TOTAL_STAGES}
        </p>
      </div>

      {/* マップ内容 */}
      <MapContent nodes={nodes} currentStage={currentStage} />

      {/* 閉じるボタン */}
      <div className="p-4 flex justify-center">
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      </div>
    </div>
  )
}
