import { useState } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, pointerWithin } from '@dnd-kit/core'
import { useGame } from '../../Hooks/UseGame'
import { EnemyData } from '../../Lib/Types/Enemy'
import { DraggableItem, DroppableSlot } from '../Common/DragDropComponents'
import EnemiesData from '../../Lib/Data/Enemies.json'

const enemiesData = EnemiesData as Record<string, EnemyData>

/**
 * デバッグ: 敵の入れ替え/追加/全滅セクション。
 * 下段の敵マスターリストから、場の敵へドラッグで差し替え、追加枠へドラッグで追加。
 * BattleScreenのDndContextと干渉しないよう、独立したDndContextを持つ。
 */
export function DebugEnemyEditor({ onKillAll }: {
  /** 敵全滅ボタン押下時（ウィンドウを閉じて勝利遷移を見せるために親へ通知） */
  onKillAll: () => void
}) {
  const { state, debugReplaceEnemy, debugAddEnemy, debugKillAllEnemies } = useGame()
  const [draggingEnemyName, setDraggingEnemyName] = useState<string | null>(null)

  const battleState = state.battleState
  if (!battleState) {
    return <div className="text-xs text-gray-600">戦闘中のみ利用できます</div>
  }
  const isCommandPhase = battleState.phase === 'command'
  const { enemies } = battleState

  const handleDragStart = (event: DragStartEvent) => {
    const enemyId = event.active.data.current?.enemyId as string | undefined
    setDraggingEnemyName(enemyId ? enemiesData[enemyId]?.name ?? null : null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingEnemyName(null)
    const enemyId = event.active.data.current?.enemyId as string | undefined
    if (!enemyId || !event.over || !isCommandPhase) return

    const overId = String(event.over.id)
    if (overId === 'debug-enemy-add') {
      debugAddEnemy(enemyId)
    } else if (overId.startsWith('debug-enemy-')) {
      const index = Number(overId.replace('debug-enemy-', ''))
      if (!Number.isNaN(index)) debugReplaceEnemy(index, enemyId)
    }
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
      <div className="space-y-3">
        {!isCommandPhase && (
          <div className="text-xs text-red-400">コマンドフェーズ中のみ操作できます</div>
        )}

        {/* 場の敵（ドロップで差し替え） + 追加枠 */}
        <div>
          <div className="text-sm text-gray-400 font-bold mb-1">場の敵（ドロップで差し替え / 右端で追加）</div>
          <div className="flex flex-wrap gap-1">
            {enemies.map((enemy, idx) => (
              <DroppableSlot key={enemy.instanceId} id={`debug-enemy-${idx}`} disabled={!isCommandPhase}>
                <div className={`border border-gray-600 rounded px-2 py-1 text-xs ${enemy.currentHp <= 0 ? 'text-gray-600 bg-gray-800/30' : 'text-gray-200 bg-gray-700/40'}`}>
                  <div className="font-bold truncate max-w-[90px]">{enemy.name}</div>
                  <div className="text-gray-400">{enemy.currentHp}/{enemy.hp}</div>
                </div>
              </DroppableSlot>
            ))}
            <DroppableSlot id="debug-enemy-add" disabled={!isCommandPhase}>
              <div className="border-2 border-dashed border-gray-600 rounded px-2 py-1 text-xs text-gray-500 h-full flex items-center">
                ＋追加
              </div>
            </DroppableSlot>
          </div>
        </div>

        {/* 敵マスターリスト（ドラッグ元） */}
        <div>
          <div className="text-sm text-gray-400 font-bold mb-1">敵マスター（ドラッグして配置）</div>
          <div className="grid grid-cols-3 gap-1">
            {Object.values(enemiesData).map(enemy => (
              <DraggableItem key={enemy.id} id={`debug-master-${enemy.id}`} data={{ enemyId: enemy.id }} disabled={!isCommandPhase}>
                <div className="border border-gray-600 bg-gray-700/40 rounded px-2 py-1 text-xs text-gray-200 hover:bg-gray-600">
                  <div className="font-bold truncate">{enemy.name}</div>
                  <div className="text-gray-400">HP{enemy.hp} 攻{enemy.attack}</div>
                </div>
              </DraggableItem>
            ))}
          </div>
        </div>

        {/* 敵全滅ボタン */}
        <button
          disabled={!isCommandPhase}
          onClick={() => {
            debugKillAllEnemies()
            onKillAll()
          }}
          className={`w-full border rounded-lg p-2 text-sm font-bold ${
            isCommandPhase
              ? 'border-red-500 bg-red-900/50 text-red-300 hover:bg-red-800/60'
              : 'border-gray-700 bg-gray-800/30 text-gray-600 cursor-not-allowed'
          }`}
        >
          💀 敵全員を即時撃破（EXP/ゴールドなし）
        </button>

        <DragOverlay>
          {draggingEnemyName && (
            <div className="bg-gray-800 border border-yellow-400 rounded px-3 py-1 text-sm text-white shadow-lg">
              {draggingEnemyName}
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
