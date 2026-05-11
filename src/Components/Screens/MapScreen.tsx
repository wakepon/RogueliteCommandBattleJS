import { useGame } from '../../Hooks/UseGame'
import { Button } from '../Common/Button'
import { MapContent } from '../Common/MapContent'
import { TOTAL_STAGES } from '../../Lib/Core/StageManager'

export function MapScreen() {
  const { state, advanceFromMap } = useGame()

  const mapState = state.mapState
  if (!mapState) return null

  const { nodes, currentStage } = mapState

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* ヘッダー */}
      <div className="p-4 text-center border-b border-gray-700">
        <h1 className="text-xl font-bold">マップ</h1>
        <p className="text-sm text-gray-400 mt-1">
          ステージ {currentStage} / {TOTAL_STAGES}
        </p>
      </div>

      {/* マップ横スクロール領域 */}
      <MapContent nodes={nodes} currentStage={currentStage} />

      {/* 進むボタン */}
      <div className="p-4 flex justify-center">
        <Button variant="primary" size="lg" onClick={advanceFromMap}>
          進む
        </Button>
      </div>
    </div>
  )
}
