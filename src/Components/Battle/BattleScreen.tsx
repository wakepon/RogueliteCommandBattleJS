import { useEffect, useState, useCallback } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core'
import { useGame } from '../../Hooks/UseGame'
import { useBattle } from '../../Hooks/UseBattle'
import { checkBattleResult, calculateTargetRates } from '../../Lib/Core'
import { calculateCumulativeDamagePreview } from '../../Lib/Utils/DamagePredictor'
import { isPotion } from '../../Lib/Core/CommandValidator'
import { BattleCommand } from '../../Lib/Types/Battle'
import { Button } from '../Common/Button'
import { PlayerStatus } from './PlayerStatus'
import { EnemyDisplay } from './EnemyDisplay'
import { CommandList } from './CommandList'
import { TargetSelector, getTargetSelectionState } from './TargetSelector'
import { DamagePopup } from './DamagePopup'
import { LevelUpModal } from './LevelUpModal'
import { DraggableCommand } from './DraggableCommand'
import { DroppableTarget } from './DroppableTarget'
import { ActionOrderSlots } from './ActionOrderSlots'
import { getItemTooltip } from '../../Lib/Utils/ItemDescription'
import { NextStagePreview } from './NextStagePreview'

// フェーズ間遅延（ミリ秒）
const ACTION_DELAY_MS = 500
const ENEMY_TURN_DELAY_MS = 600
const TURN_END_DELAY_MS = 300
const MESSAGE_DISPLAY_MS = 1500

export function BattleScreen() {
  const { state, returnToTitle, endBattle } = useGame()
  const battle = useBattle()
  const { run, battleState } = state

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
  const { turn, turnLimit, enemies, phase, commandSlots } = battleState

  const {
    activeExplorer,
    allSlotsSet,
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
    changeActiveExplorer,
    startExecution,
    executePartyAction,
    advancePartyAction,
    enemyAction,
    advanceEnemyAction,
    processTurnEnd,
    startNewTurn,
    removePopup,
    removePlayerPopup,
    removeLevelUpPopup,
    executeCommand,
  } = battle

  // メッセージバナー
  const [visibleMessage, setVisibleMessage] = useState<string | null>(null)
  const [messageVisible, setMessageVisible] = useState(false)

  useEffect(() => {
    if (battleState.battleMessage) {
      setVisibleMessage(battleState.battleMessage)
      setMessageVisible(true)
      const timer = setTimeout(() => setMessageVisible(false), MESSAGE_DISPLAY_MS)
      return () => clearTimeout(timer)
    }
  }, [battleState.battleMessageId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [expAnimating] = useState(false)

  // D&D: ドラッグ中のコマンド情報
  const [draggingCommand, setDraggingCommand] = useState<BattleCommand | null>(null)
  const [draggingExplorerId, setDraggingExplorerId] = useState<string | null>(null)

  // === フェーズ自動処理 ===
  useEffect(() => {
    if (phase !== 'partyAction') return
    const timers: ReturnType<typeof setTimeout>[] = []
    const t1 = setTimeout(() => {
      executePartyAction()
      const t2 = setTimeout(() => advancePartyAction(), ACTION_DELAY_MS / 2)
      timers.push(t2)
    }, ACTION_DELAY_MS)
    timers.push(t1)
    return () => timers.forEach(t => clearTimeout(t))
  }, [phase, battleState.currentCommandIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'enemyAction') return
    const aliveEnemies = enemies.filter(e => e.currentHp > 0)
    if (battleState.currentEnemyIndex >= aliveEnemies.length) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const t1 = setTimeout(() => {
      enemyAction(battleState.currentEnemyIndex)
      const t2 = setTimeout(() => advanceEnemyAction(), ENEMY_TURN_DELAY_MS / 2)
      timers.push(t2)
    }, ENEMY_TURN_DELAY_MS)
    timers.push(t1)
    return () => timers.forEach(t => clearTimeout(t))
  }, [phase, battleState.currentEnemyIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'turnEnd') return
    const timers: ReturnType<typeof setTimeout>[] = []
    const t1 = setTimeout(() => {
      processTurnEnd()
      const t2 = setTimeout(() => startNewTurn(), TURN_END_DELAY_MS)
      timers.push(t2)
    }, ACTION_DELAY_MS)
    timers.push(t1)
    return () => timers.forEach(t => clearTimeout(t))
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const result = checkBattleResult(enemies, party)
    if (result !== 'ongoing') endBattle(result)
  }, [enemies, party, endBattle])

  const isCommandPhase = phase === 'command'
  const isSelectingTarget = selectedCommand !== null && isCommandPhase

  // アクティブキャラのコマンド一覧
  const uniquePotions = potions.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
  const allCommands = [...activeExplorer.weapons, ...activeExplorer.spells, ...uniquePotions]

  // === D&D ハンドラ ===
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { command, explorerId } = event.active.data.current as { command: BattleCommand; explorerId: string }
    setDraggingCommand(command)
    setDraggingExplorerId(explorerId)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingCommand(null)
    setDraggingExplorerId(null)

    if (!event.over || !isCommandPhase) return

    const { command, explorerId } = event.active.data.current as { command: BattleCommand; explorerId: string }
    const dropId = event.over.id as string

    // そのキャラのスロットをアクティブにする
    const slotIndex = commandSlots.findIndex(s => s.explorerId === explorerId)
    if (slotIndex >= 0) {
      changeActiveExplorer(slotIndex)
    }

    // コマンドを選択してターゲットをセット
    selectCommand(command)

    // ポーションは味方にドロップ
    if (isPotion(command) && dropId.startsWith('ally-')) {
      selectTarget(dropId.replace('ally-', ''))
      // 次のtickでexecuteCommand
      setTimeout(() => executeCommand(), 0)
      return
    }

    // 敵にドロップ
    if (dropId.startsWith('enemy-')) {
      selectTarget(dropId.replace('enemy-', ''))
      setTimeout(() => executeCommand(), 0)
      return
    }

    // 味方にドロップ（ヒール/祈り/精密等）
    if (dropId.startsWith('ally-')) {
      selectTarget(dropId.replace('ally-', ''))
      setTimeout(() => executeCommand(), 0)
      return
    }
  }, [isCommandPhase, commandSlots, changeActiveExplorer, selectCommand, selectTarget, executeCommand])

  const handleDragCancel = useCallback(() => {
    setDraggingCommand(null)
    setDraggingExplorerId(null)
  }, [])

  // スロットの表示テキスト
  const getSlotSummary = (slot: typeof commandSlots[0]) => {
    if (!slot.command) return '未設定'
    return `${slot.command.name}`
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className="min-h-screen bg-gray-800 p-3 flex flex-col">
        {/* 1. ステージ情報 */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg mb-3">
          <div className="flex justify-between items-center text-white text-sm">
            <span className="font-bold">Stage {run.currentStage}</span>
            <div className="flex gap-3">
              <span className="text-gray-400 text-xs">
                {phase === 'command' && 'コマンド選択'}
                {phase === 'partyAction' && 'パーティー行動中...'}
                {phase === 'enemyAction' && '敵行動中...'}
                {phase === 'turnEnd' && 'ターン終了'}
              </span>
              <span className="text-yellow-400">Turn {turn} / {turnLimit}</span>
            </div>
          </div>
        </div>

        {/* 2. 敵エリア（ドロップゾーン） */}
        <div className="flex-1 bg-gray-900 border border-gray-600 p-3 rounded-lg mb-3 relative min-h-[160px] flex flex-col">
          <div className="text-xs text-gray-400 mb-2">enemies</div>

          <div className="absolute top-2 right-2 z-[5] flex gap-1">
            <NextStagePreview seed={run.seed} currentStage={run.currentStage} />
            <NextStagePreview seed={run.seed} currentStage={run.currentStage} offset={2} label="Next+" />
          </div>

          {visibleMessage && (
            <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-gray-800 border border-gray-500 px-4 py-1.5 rounded-lg text-white text-sm font-bold shadow-lg transition-opacity duration-300 ${messageVisible ? 'opacity-100' : 'opacity-0'}`}>
              {visibleMessage}
            </div>
          )}

          <div className="flex-1 flex flex-wrap justify-center items-center content-center gap-3">
            {enemies.map((enemy) => {
              const isAllyTarget = selectedCommand?.targetType === 'allySingle' || draggingCommand?.targetType === 'allySingle'
              const { isSelected, isHighlighted } = isSelectingTarget && selectedCommand && !isAllyTarget
                ? getTargetSelectionState(enemy, selectedTargetId, selectedCommand.targetType)
                : { isSelected: false, isHighlighted: false }

              const damagePreview = isCommandPhase
                ? calculateCumulativeDamagePreview(
                    commandSlots, enemy.instanceId, party,
                    { relics: run.relics, killStreakActive: battleState.relicState.killStreakActive, includeConditionalRelics: true }
                  )
                : null

              return (
                <DroppableTarget key={enemy.instanceId} id={`enemy-${enemy.instanceId}`} disabled={!isCommandPhase || enemy.currentHp <= 0}>
                  <EnemyDisplay
                    enemy={enemy}
                    isCurrentActor={false}
                    isTargetSelected={isSelected}
                    isTargetHighlighted={isHighlighted}
                    onSelect={isSelectingTarget && enemy.currentHp > 0 ? () => selectTarget(enemy.instanceId) : undefined}
                    damagePreview={damagePreview}
                    intent={battleState.enemyIntents.find(i => i.enemyInstanceId === enemy.instanceId)}
                  />
                </DroppableTarget>
              )
            })}
          </div>

          {damagePopups.map((popup) => {
            const targetIndex = enemies.findIndex(e => e.instanceId === popup.targetId)
            if (targetIndex === -1) return null
            return (
              <DamagePopup key={popup.id} damage={popup.damage} targetIndex={targetIndex} totalTargets={enemies.length} onComplete={() => removePopup(popup.id)} />
            )
          })}
        </div>

        {/* 3. 行動順 + 実行ボタン | レリック */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
            <div className="flex gap-1 mb-2">
              {commandSlots.map((slot, index) => {
                const member = party.find(m => m.id === slot.explorerId)
                const isActive = index === battleState.activeExplorerIndex && isCommandPhase
                const isDead = member && member.hp <= 0
                return (
                  <button
                    key={slot.explorerId}
                    onClick={() => isCommandPhase && !isDead && changeActiveExplorer(index)}
                    className={`flex-1 text-xs p-1.5 rounded border transition-colors ${
                      isDead ? 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'
                      : isActive ? 'bg-gray-700 border-yellow-400 text-yellow-300'
                      : slot.command ? 'bg-gray-700 border-green-500 text-green-300 hover:border-yellow-400'
                      : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-yellow-400'
                    }`}
                    disabled={!isCommandPhase || !!isDead}
                  >
                    <div className="font-bold truncate">{member?.name ?? '?'}</div>
                    <div className="truncate">{isDead ? '戦闘不能' : getSlotSummary(slot)}</div>
                  </button>
                )
              })}
            </div>
            <ActionOrderSlots commandSlots={commandSlots} party={party} />
            {isCommandPhase && (
              <Button variant="primary" onClick={startExecution} disabled={!allSlotsSet} className="w-full text-sm mt-2">
                {allSlotsSet ? '実行' : 'コマンドを選択してください'}
              </Button>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">relics</div>
            <div className="flex gap-1 flex-wrap">
              {run.relics.length === 0 ? (
                <span className="text-gray-500 text-xs">No relics</span>
              ) : (
                run.relics.map((relic, index) => (
                  <div key={`relic-${index}`} className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-xs text-white" title={getItemTooltip(relic)}>?</div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 4. キャラコマンド（D&Dドラッグ元）| パーティーステータス（ドロップゾーン） */}
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          {/* コマンド一覧（ドラッグ元 + クリック操作） */}
          <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">
              {isCommandPhase ? `${activeExplorer.name} のコマンド` : 'command'}
            </div>
            {isCommandPhase ? (
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {allCommands.map((cmd) => {
                  const isAvail = availableCommands.some(ac => ac.id === cmd.id)
                  return (
                    <div key={cmd.id} onClick={() => isAvail && selectCommand(cmd)}>
                      <DraggableCommand
                        command={cmd}
                        explorerId={activeExplorer.id}
                        disabled={!isCommandPhase}
                        isAvailable={isAvail}
                      />
                    </div>
                  )
                })}
              </div>
            ) : (
              <CommandList
                commands={allCommands}
                availableCommands={availableCommands}
                selectedCommand={selectedCommand}
                onSelectCommand={selectCommand}
                disabled={true}
                potions={potions}
                explorer={activeExplorer}
                relics={run.relics}
                killStreakActive={battleState.relicState.killStreakActive}
              />
            )}
          </div>

          {/* パーティーステータス（味方ドロップゾーン） */}
          <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg relative">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-gray-400">party status</div>
              <div className="text-xs text-yellow-400">Gold: {gold}G</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(() => {
                const targetRates = calculateTargetRates(party)
                return party.map((member) => {
                  const isActive = commandSlots[battleState.activeExplorerIndex]?.explorerId === member.id && isCommandPhase
                  const isDead = member.hp <= 0
                  const rate = targetRates.find(r => r.explorerId === member.id)?.rate
                  return (
                    <DroppableTarget key={member.id} id={`ally-${member.id}`} disabled={!isCommandPhase}>
                      <div
                        className={`p-1 rounded ${
                          isDead ? 'opacity-40 bg-gray-800'
                          : isActive ? 'ring-1 ring-yellow-400'
                          : ''
                        }`}
                        onClick={() => {
                          // クリックでターゲット選択（味方対象コマンド選択中の場合）
                          if (isSelectingTarget && selectedCommand?.targetType === 'allySingle') {
                            selectTarget(member.id)
                            setTimeout(() => executeCommand(), 0)
                          }
                        }}
                      >
                        <PlayerStatus
                          explorer={member}
                          gold={0}
                          levelUpPopupCount={0}
                          isTargeted={
                            (isSelectingTarget && selectedCommand?.targetType === 'allySingle' && member.id === selectedTargetId)
                            || (draggingCommand?.targetType === 'allySingle' && draggingExplorerId !== null)
                          }
                          targetRate={isDead ? undefined : rate}
                        />
                        {isDead && (
                          <div className="text-center text-red-400 text-xs font-bold mt-1">戦闘不能</div>
                        )}
                      </div>
                    </DroppableTarget>
                  )
                })
              })()}
            </div>

            {playerDamagePopups.map((popup) => (
              <DamagePopup key={popup.id} damage={popup.damage} targetIndex={0} totalTargets={1} onComplete={() => removePlayerPopup(popup.id)} isPlayerDamage={true} />
            ))}
          </div>
        </div>

        {/* クリック操作のターゲット選択（D&D未使用時のフォールバック） */}
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

        {!expAnimating && levelUpPopups.length > 0 && (
          <LevelUpModal
            levelUpInfo={levelUpPopups[0].levelUpInfo}
            onComplete={() => removeLevelUpPopup(levelUpPopups[0].id)}
          />
        )}

        {/* D&D ドラッグオーバーレイ */}
        <DragOverlay>
          {draggingCommand && (
            <div className="bg-gray-800 border border-yellow-400 rounded px-3 py-1 text-sm text-white shadow-lg">
              {draggingCommand.name}
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
