import { useEffect } from 'react'
import { useGame } from '../../Hooks/UseGame'
import { useBattle } from '../../Hooks/UseBattle'
import { Button } from '../Common/Button'
import { PlayerStatus } from './PlayerStatus'
import { EnemyDisplay } from './EnemyDisplay'
import { TurnIndicator } from './TurnIndicator'
import { CommandList } from './CommandList'
import { TargetSelector } from './TargetSelector'
import { DamagePopup } from './DamagePopup'

// 敵ターンをスキップするまでの遅延（ミリ秒）
const ENEMY_TURN_DELAY_MS = 500

export function BattleScreen() {
  const { state, returnToTitle } = useGame()
  const battle = useBattle()
  const { run, battleState } = state

  // バトル状態が無い場合のフォールバック
  if (!run || !battleState || !battle) {
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

  // useBattle Hookから必要な情報を取得
  const {
    explorer,
    isPlayerTurn,
    availableCommands,
    selectedCommand,
    selectedTargetId,
    damagePopups,
    selectCommand,
    cancelCommand,
    selectTarget,
    executeCommand,
    nextActor,
    removePopup,
  } = battle

  // 敵ターンの自動スキップ
  useEffect(() => {
    if (!isPlayerTurn) {
      const timer = setTimeout(() => {
        nextActor()
      }, ENEMY_TURN_DELAY_MS)
      return () => clearTimeout(timer)
    }
  }, [isPlayerTurn, currentActorIndex, nextActor])

  // 全てのコマンド（武器+魔法）
  const allCommands = [...explorer.weapons, ...explorer.spells]

  // 現在のアクターが敵かどうかを判定
  const isEnemyCurrent = (enemy: typeof enemies[0]) => {
    if (currentActor.type !== 'enemy') return false
    return currentActor.instanceId === enemy.instanceId
  }

  // ターゲット選択中かどうか
  const isSelectingTarget = selectedCommand !== null

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
      <div className="flex-1 mb-4 relative">
        <div className="text-xs text-gray-400 mb-2">Enemies</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {enemies.map((enemy) => (
            <EnemyDisplay
              key={enemy.instanceId}
              enemy={enemy}
              isCurrentActor={isEnemyCurrent(enemy)}
            />
          ))}
        </div>

        {/* ダメージポップアップ */}
        {damagePopups.map((popup) => {
          // targetIdから敵のインデックスを取得
          const targetIndex = enemies.findIndex(e => e.instanceId === popup.targetId)
          if (targetIndex === -1) return null

          return (
            <DamagePopup
              key={popup.id}
              damage={popup.damage}
              targetIndex={targetIndex}
              totalTargets={enemies.length}
              onComplete={() => removePopup(popup.id)}
            />
          )
        })}
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

      {/* コマンド選択エリア */}
      <div className="mb-4">
        <CommandList
          commands={allCommands}
          availableCommands={availableCommands}
          selectedCommand={selectedCommand}
          onSelectCommand={selectCommand}
          disabled={!isPlayerTurn}
        />
      </div>

      {/* フッター */}
      <div className="flex justify-center">
        <Button variant="secondary" onClick={returnToTitle}>
          Return to Title
        </Button>
      </div>

      {/* ターゲット選択モーダル */}
      {isSelectingTarget && (
        <TargetSelector
          enemies={enemies}
          selectedTargetId={selectedTargetId}
          targetType={selectedCommand.targetType}
          onSelectTarget={selectTarget}
          onConfirm={executeCommand}
          onCancel={cancelCommand}
        />
      )}
    </div>
  )
}
