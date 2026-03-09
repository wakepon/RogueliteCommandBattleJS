import { useEffect, useState, useCallback, useRef } from 'react'
import { useGame } from '../../Hooks/UseGame'
import { useBattle } from '../../Hooks/UseBattle'
import { checkBattleResult } from '../../Lib/Core'
import { Button } from '../Common/Button'
import { PlayerStatus } from './PlayerStatus'
import { EnemyDisplay } from './EnemyDisplay'
import { TurnIndicator } from './TurnIndicator'
import { CommandList } from './CommandList'
import { TargetSelector, getTargetSelectionState } from './TargetSelector'
import { DamagePopup } from './DamagePopup'
import { LevelUpModal } from './LevelUpModal'

// 敵ターンをスキップするまでの遅延（ミリ秒）
const ENEMY_TURN_DELAY_MS = 500

export function BattleScreen() {
  const { state, returnToTitle, endBattle } = useGame()
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
    playerDamagePopups,
    levelUpPopups,
    potions,
    selectCommand,
    cancelCommand,
    selectTarget,
    executeCommand,
    enemyAction,
    removePopup,
    removePlayerPopup,
    removeLevelUpPopup,
  } = battle

  // 経験値アニメーション状態
  const [expAnimating, setExpAnimating] = useState(false)
  const prevLevelRef = useRef(explorer.level)

  // レベル変化を検知してexpAnimatingをセット
  useEffect(() => {
    if (explorer.level > prevLevelRef.current) {
      setExpAnimating(true)
    }
    prevLevelRef.current = explorer.level
  }, [explorer.level])

  const handleExpFillComplete = useCallback(() => {
    setExpAnimating(false)
  }, [])

  // 敵ターンの自動処理
  useEffect(() => {
    if (!isPlayerTurn && currentActor?.type === 'enemy') {
      // 死亡した敵はスキップして次のアクターへ
      const enemy = enemies.find(e => e.instanceId === currentActor.instanceId)
      if (!enemy || enemy.currentHp <= 0) {
        battle.nextActor()
        return
      }
      const timer = setTimeout(() => {
        enemyAction(currentActor.instanceId)
      }, ENEMY_TURN_DELAY_MS)
      return () => clearTimeout(timer)
    }
  }, [isPlayerTurn, currentActor, enemyAction, enemies, battle])

  // 勝敗判定
  useEffect(() => {
    const result = checkBattleResult(enemies, explorer)
    if (result !== 'ongoing') {
      endBattle(result)
    }
  }, [enemies, explorer, endBattle])

  // 同名ポーションを重複排除
  const uniquePotions = potions.filter((potion, index, arr) =>
    arr.findIndex(p => p.id === potion.id) === index
  )

  // 全てのコマンド（武器+魔法+ポーション）
  const allCommands = [...explorer.weapons, ...explorer.spells, ...uniquePotions]

  // 現在のアクターが敵かどうかを判定
  const isEnemyCurrent = (enemy: typeof enemies[0]) => {
    if (currentActor.type !== 'enemy') return false
    return currentActor.instanceId === enemy.instanceId
  }

  // ターゲット選択中かどうか
  const isSelectingTarget = selectedCommand !== null

  return (
    <div className="min-h-screen bg-gray-800 p-3 flex flex-col">
      {/* 1. ステージ情報（上部バー） */}
      <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg mb-3">
        <div className="flex justify-between items-center text-white text-sm">
          <span className="font-bold">Stage {run.currentStage}</span>
          <span className="text-yellow-400">
            Turn {turn} / {turnLimit}
          </span>
        </div>
      </div>

      {/* 2. 敵エリア（大きなメインエリア） */}
      <div className="flex-1 bg-gray-900 border border-gray-600 p-3 rounded-lg mb-3 relative min-h-[160px] flex flex-col">
        <div className="text-xs text-gray-400 mb-2">enemies</div>
        <div className="flex-1 flex flex-wrap justify-center items-center content-center gap-3">
          {enemies.map((enemy) => {
            // ターゲット選択中かつ敵ターゲットの場合のみ選択状態を取得
            const isAllyTarget = selectedCommand?.targetType === 'allySingle'
            const { isSelected, isHighlighted } = isSelectingTarget && selectedCommand && !isAllyTarget
              ? getTargetSelectionState(enemy, selectedTargetId, selectedCommand.targetType)
              : { isSelected: false, isHighlighted: false }

            return (
              <EnemyDisplay
                key={enemy.instanceId}
                enemy={enemy}
                isCurrentActor={isEnemyCurrent(enemy)}
                isTargetSelected={isSelected}
                isTargetHighlighted={isHighlighted}
                onSelect={isSelectingTarget && enemy.currentHp > 0 ? () => selectTarget(enemy.instanceId) : undefined}
              />
            )
          })}
        </div>

        {/* ダメージポップアップ */}
        {damagePopups.map((popup) => {
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

      {/* 3. 行動順 | レリック（横並び） */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* 行動順 */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">action order</div>
          <TurnIndicator
            actionQueue={actionQueue}
            currentActorIndex={currentActorIndex}
            party={party}
            enemies={enemies}
            hoveredTargetId={isSelectingTarget ? selectedTargetId : null}
            targetType={isSelectingTarget && selectedCommand ? selectedCommand.targetType : undefined}
          />
        </div>

        {/* レリック（プレースホルダー - Slice 6で実装） */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">relics</div>
          <div className="flex gap-1 flex-wrap">
            {run.relics.length === 0 ? (
              <span className="text-gray-500 text-xs">No relics</span>
            ) : (
              run.relics.map((relic, index) => (
                <div
                  key={`relic-${index}`}
                  className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-xs text-white"
                  title={relic.name}
                >
                  ?
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. コマンド | 探索者ステータス（横並び） */}
      <div className="grid grid-cols-2 gap-3">
        {/* コマンド選択 */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">command</div>
          <CommandList
            commands={allCommands}
            availableCommands={availableCommands}
            selectedCommand={selectedCommand}
            onSelectCommand={selectCommand}
            disabled={!isPlayerTurn}
            potions={potions}
          />
        </div>

        {/* 探索者ステータス */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg relative">
          <div className="text-xs text-gray-400 mb-1">explorer status</div>
          <PlayerStatus
            explorer={explorer}
            gold={gold}
            levelUpPopupCount={levelUpPopups.length}
            onExpFillComplete={handleExpFillComplete}
            isTargeted={selectedCommand?.targetType === 'allySingle'}
          />

          {/* プレイヤーダメージポップアップ */}
          {playerDamagePopups.map((popup) => (
            <DamagePopup
              key={popup.id}
              damage={popup.damage}
              targetIndex={0}
              totalTargets={1}
              onComplete={() => removePlayerPopup(popup.id)}
              isPlayerDamage={true}
            />
          ))}
        </div>
      </div>

      {/* ターゲット選択ロジック（UIなし） */}
      {isSelectingTarget && selectedCommand && (
        <TargetSelector
          enemies={enemies}
          selectedTargetId={selectedTargetId}
          targetType={selectedCommand.targetType}
          columns={2}
          party={party}
          onSelectTarget={selectTarget}
          onConfirm={executeCommand}
          onCancel={cancelCommand}
        />
      )}

      {/* レベルアップモーダル（アニメーション完了後に表示） */}
      {!expAnimating && levelUpPopups.length > 0 && (
        <LevelUpModal
          levelUpInfo={levelUpPopups[0].levelUpInfo}
          onComplete={() => removeLevelUpPopup(levelUpPopups[0].id)}
        />
      )}
    </div>
  )
}
