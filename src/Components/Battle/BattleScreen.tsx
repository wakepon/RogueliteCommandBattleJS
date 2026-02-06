import { useGame } from '../../Hooks/UseGame'
import { Button } from '../Common/Button'
import { PlayerStatus } from './PlayerStatus'
import { EnemyDisplay } from './EnemyDisplay'
import { TurnIndicator } from './TurnIndicator'

export function BattleScreen() {
  const { state, returnToTitle } = useGame()
  const { run, battleState } = state

  // バトル状態が無い場合のフォールバック
  if (!run || !battleState) {
    return (
      <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center">
        <p className="text-white mb-4">Loading battle...</p>
        <Button variant="secondary" onClick={returnToTitle}>
          Return to Title
        </Button>
      </div>
    )
  }

  const { party, gold } = run
  const { turn, turnLimit, enemies, actionQueue, currentActorIndex } = battleState
  const currentActor = actionQueue[currentActorIndex]

  // 現在のアクターが敵かどうかを判定
  const isEnemyCurrent = (enemy: typeof enemies[0]) => {
    if (currentActor.type !== 'enemy') return false
    return currentActor.instanceId === enemy.instanceId
  }

  return (
    <div className="min-h-screen bg-gray-800 p-4 flex flex-col">
      {/* ヘッダー: ステージ情報 */}
      <div className="bg-gray-900 p-3 rounded-lg mb-4">
        <div className="flex justify-between items-center text-white">
          <span className="font-bold">Stage {run.currentStage}</span>
          <span className="text-yellow-400">
            Turn {turn} / {turnLimit}
          </span>
        </div>
      </div>

      {/* 行動順表示 */}
      <div className="mb-4">
        <TurnIndicator
          actionQueue={actionQueue}
          currentActorIndex={currentActorIndex}
          party={party}
          enemies={enemies}
        />
      </div>

      {/* 敵エリア */}
      <div className="flex-1 mb-4">
        <div className="text-xs text-gray-400 mb-2">Enemies</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {enemies.map(enemy => (
            <EnemyDisplay
              key={enemy.instanceId}
              enemy={enemy}
              isCurrentActor={isEnemyCurrent(enemy)}
            />
          ))}
        </div>
      </div>

      {/* プレイヤーステータス */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2">Party</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {party.map(explorer => (
            <PlayerStatus
              key={explorer.id}
              explorer={explorer}
              gold={gold}
            />
          ))}
        </div>
      </div>

      {/* アクションエリア（プレースホルダー） */}
      <div className="bg-gray-900 p-4 rounded-lg mb-4">
        <div className="text-gray-400 text-center text-sm">
          Command selection coming in Slice 3...
        </div>
      </div>

      {/* フッター */}
      <div className="flex justify-center">
        <Button variant="secondary" onClick={returnToTitle}>
          Return to Title
        </Button>
      </div>
    </div>
  )
}
