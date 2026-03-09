import { useRef, useEffect } from 'react'
import { MapNode, EnemyPreview } from '../../Lib/Types/Game'
import { EnemyType } from '../../Lib/Types/Enemy'

/** 敵タイプに応じたドットの色 */
function getEnemyDotColor(type: EnemyType): string {
  switch (type) {
    case 'normal':
      return 'bg-green-500'
    case 'elite':
      return 'bg-purple-500'
    case 'boss':
      return 'bg-red-500'
  }
}

/** バトルカード: 敵のドットを表示 */
function BattleCard({ node, isCompleted, isNext }: { node: MapNode; isCompleted: boolean; isNext: boolean }) {
  return (
    <div
      className={`w-36 h-48 flex-shrink-0 rounded-lg border-2 bg-gray-800 flex flex-col items-center justify-center gap-2 ${
        isNext ? 'ring-2 ring-yellow-400 border-yellow-400' : 'border-gray-600'
      } ${isCompleted ? 'opacity-40' : ''}`}
    >
      <div className="text-xs text-gray-400">
        {node.nodeType === 'boss' ? 'BOSS' : `Stage ${node.stage}`}
      </div>
      {isNext && (
        <div className="text-xs text-yellow-400 font-bold">Next</div>
      )}
      <div className="flex flex-wrap gap-2 justify-center px-2">
        {node.enemies.map((enemy: EnemyPreview, i: number) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full ${getEnemyDotColor(enemy.type)}`}
            title={enemy.enemyId}
          />
        ))}
      </div>
    </div>
  )
}

/** イベントカード: 3分割で選択肢を表示 */
function EventCard({ isCompleted, isNext }: { isCompleted: boolean; isNext: boolean }) {
  return (
    <div
      className={`w-36 h-48 flex-shrink-0 rounded-lg border-2 bg-gray-800 flex flex-col items-center justify-center ${
        isNext ? 'ring-2 ring-yellow-400 border-yellow-400' : 'border-gray-600'
      } ${isCompleted ? 'opacity-40' : ''}`}
    >
      <div className="text-xs text-gray-400 mb-1">Event</div>
      {isNext && (
        <div className="text-xs text-yellow-400 font-bold mb-1">Next</div>
      )}
      <div className="flex flex-col gap-1 w-full px-2">
        <div className="text-center text-lg border-b border-gray-700 pb-1">📦</div>
        <div className="text-center text-lg border-b border-gray-700 pb-1">💤</div>
        <div className="text-center text-lg">🔧</div>
      </div>
    </div>
  )
}

/** カード間の接続線 */
function Connector() {
  return <div className="w-6 h-0.5 bg-gray-600 flex-shrink-0 self-center" />
}

interface MapContentProps {
  nodes: MapNode[]
  currentStage: number
}

export function MapContent({ nodes, currentStage }: MapContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentCardRef = useRef<HTMLDivElement>(null)

  // 初期スクロール位置を終了済みカード（currentStage - 1）の左端に設定
  useEffect(() => {
    if (currentCardRef.current && scrollRef.current) {
      const container = scrollRef.current
      const card = currentCardRef.current
      const scrollLeft = card.offsetLeft - 16
      container.scrollLeft = scrollLeft
    }
  }, [])

  return (
    <div className="flex-1 flex items-center">
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto px-4 py-6"
      >
        <div className="flex items-center gap-0 w-max">
          {nodes.map((node: MapNode, index: number) => {
            const diff = node.stage - currentStage
            const isCompleted = node.stage < currentStage
            const isNext = node.stage === currentStage

            // currentStage - 3 以前: 非表示
            if (diff < -2) return null

            // currentStage - 2: 見切れ表示 + グレーアウト
            const isClipped = diff === -2

            return (
              <div key={node.stage} className="flex items-center">
                {index > 0 && diff >= -2 && <Connector />}

                <div
                  ref={diff === -1 ? currentCardRef : undefined}
                  className={
                    isClipped
                      ? 'opacity-40 -ml-14 overflow-hidden w-22'
                      : ''
                  }
                >
                  {node.nodeType === 'event' ? (
                    <EventCard isCompleted={isCompleted} isNext={isNext} />
                  ) : (
                    <BattleCard node={node} isCompleted={isCompleted} isNext={isNext} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
