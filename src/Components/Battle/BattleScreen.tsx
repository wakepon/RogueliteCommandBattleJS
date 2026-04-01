import { useEffect, useState, useCallback } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverEvent, DragOverlay, pointerWithin, closestCenter, CollisionDetection } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useGame } from '../../Hooks/UseGame'
import { useBattle } from '../../Hooks/UseBattle'
import { checkBattleResult, calculateTargetRates, getAvailableCommands, getRequiredKillsForNextLevel } from '../../Lib/Core'
import { calculateCumulativeDamagePreview, TentativeCommand } from '../../Lib/Utils/DamagePredictor'
import { BattleCommand } from '../../Lib/Types/Battle'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { Button } from '../Common/Button'
import { ResourceBar } from '../Common'
import { EnemyDisplay } from './EnemyDisplay'
import { TargetSelector, getTargetSelectionState } from './TargetSelector'
import { DamagePopup } from './DamagePopup'
import { LevelUpModal } from './LevelUpModal'
import { DraggableCommand } from './DraggableCommand'
import { DroppableTarget } from './DroppableTarget'
import { ActionOrderSlots } from './ActionOrderSlots'
import { getItemTooltip } from '../../Lib/Utils/ItemDescription'
import { NextStagePreview } from './NextStagePreview'

const ACTION_DELAY_MS = 500
const ENEMY_TURN_DELAY_MS = 600
const TURN_END_DELAY_MS = 300
const MESSAGE_DISPLAY_MS = 1500

/** キャラ欄: ステータスバー + コマンド一覧 */
function CharacterPanel({
  member,
  isCommandPhase,
  availableCommands,
  targetRate,
  isSelectingTarget,
  selectedTargetId,
  draggingAllyTarget,
  draggingEnemyTarget,
  onAllyClick,
}: {
  member: ExplorerState
  isCommandPhase: boolean
  availableCommands: BattleCommand[]
  targetRate: number | undefined
  isSelectingTarget: boolean
  selectedTargetId: string | null
  draggingAllyTarget: boolean
  draggingEnemyTarget: boolean
  onAllyClick: () => void
}) {
  const isDead = member.hp <= 0
  const positionLabel = member.position === 'front' ? '前衛' : '後衛'
  const positionColor = member.position === 'front' ? 'text-orange-400' : 'text-cyan-400'
  const commands = [...member.weapons, ...member.spells]

  // EXP/レベルアップ進捗
  const requiredKills = getRequiredKillsForNextLevel(member.level)
  const expProgress = requiredKills > 0 ? member.exp : 0

  return (
    <DroppableTarget id={`ally-${member.id}`} disabled={!isCommandPhase || draggingEnemyTarget}>
      <div
        className={`relative h-full flex flex-col rounded p-1.5 ${isDead ? 'opacity-40 bg-gray-800' : 'bg-gray-800/50'}`}
        onClick={onAllyClick}
      >
        {/* ヘッダー: 名前 + レベル */}
        <div className="flex justify-between items-center mb-1">
          <span className="text-white font-bold text-xs">{member.name}</span>
          <span className="text-yellow-400 text-[10px]">Lv.{member.level}</span>
        </div>

        {/* HP バー */}
        <div className="mb-0.5">
          <div className="flex justify-between text-[9px] text-gray-400">
            <span className="text-red-400">HP</span>
            <span>{member.hp}/{member.maxHp}</span>
          </div>
          <ResourceBar current={member.hp} max={member.maxHp} color="red" showText={false} size="sm" />
        </div>

        {/* MP バー */}
        <div className="mb-0.5">
          <div className="flex justify-between text-[9px] text-gray-400">
            <span className="text-blue-400">MP</span>
            <span>{member.mp}/{member.maxMp}</span>
          </div>
          <ResourceBar current={member.mp} max={member.maxMp} color="blue" showText={false} size="sm" />
        </div>

        {/* EXP バー */}
        <div className="mb-1">
          <div className="flex justify-between text-[9px] text-gray-400">
            <span className="text-yellow-400">EXP</span>
            <span>{expProgress}/{requiredKills}</span>
          </div>
          <ResourceBar current={expProgress} max={requiredKills} color="yellow" showText={false} size="sm" />
        </div>

        {/* 前衛/後衛 + 被弾率 */}
        {targetRate !== undefined && !isDead && (
          <div className="text-[9px] text-gray-400 mb-1">
            <span className={positionColor}>{positionLabel}</span>
            <span className="mx-1">被弾:</span>
            <span className={targetRate >= 0.5 ? 'text-red-400 font-bold' : 'text-gray-300'}>{Math.round(targetRate * 100)}%</span>
          </div>
        )}

        {/* コマンド一覧（D&Dドラッグ元） */}
        {isCommandPhase && !isDead && (
          <div className="flex-1 overflow-y-auto space-y-0 mt-0.5">
            {commands.map((cmd) => {
              const isAvail = availableCommands.some(ac => ac.id === cmd.id)
              return (
                <DraggableCommand
                  key={cmd.id}
                  command={cmd}
                  explorerId={member.id}
                  disabled={!isCommandPhase}
                  isAvailable={isAvail}
                  attackerStr={member.str}
                  attackerInt={member.int}
                />
              )
            })}
          </div>
        )}

        {isDead && <div className="text-center text-red-400 text-xs font-bold mt-1">戦闘不能</div>}

        {/* 味方ターゲットハイライト */}
        {((isSelectingTarget && selectedTargetId === member.id) || draggingAllyTarget) && !isDead && (
          <div className="absolute inset-0 ring-2 ring-lime-400 rounded pointer-events-none" />
        )}
      </div>
    </DroppableTarget>
  )
}

/** 共有枠: ポーション + レリック + ゴールド */
function SharedPanel({
  potions,
  relics,
  isCommandPhase,
  gold,
}: {
  potions: { id: string; name: string; commandCategory: 'potion' }[]
  relics: { id: string; name: string; price: number }[]
  isCommandPhase: boolean
  gold: number
}) {
  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded p-1.5">
      {/* ゴールド + ポーション */}
      <div className="mb-2">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[9px] text-gray-500">ポーション</span>
          <span className="text-[10px] text-yellow-400 font-bold">{gold}G</span>
        </div>
        {potions.length === 0 ? (
          <div className="text-[10px] text-gray-600">なし</div>
        ) : (
          potions.map((potion) => (
            <DraggableCommand
              key={potion.id}
              command={potion as BattleCommand}
              explorerId="shared"
              disabled={!isCommandPhase}
              isAvailable={true}
            />
          ))
        )}
      </div>

      <div className="border-t border-gray-700 my-1" />

      {/* レリック */}
      <div className="flex-1">
        <div className="text-[9px] text-gray-500 mb-0.5">レリック</div>
        {relics.length === 0 ? (
          <div className="text-[10px] text-gray-600">なし</div>
        ) : (
          <div className="space-y-0.5">
            {relics.map((relic) => (
              <div key={relic.id} className="text-[10px] text-gray-300 truncate" title={getItemTooltip(relic as never)}>
                {relic.name}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

export function BattleScreen() {
  const { state, returnToTitle, endBattle } = useGame()
  const battle = useBattle()
  const { run, battleState } = state

  if (!run || !battleState || !battle) {
    return (
      <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center">
        <p className="text-white mb-4">Loading battle...</p>
        <Button variant="secondary" onClick={returnToTitle}>Return to Title</Button>
      </div>
    )
  }

  const { party, gold } = run
  const { turn, turnLimit, enemies, phase, commandSlots } = battleState

  const {
    allSlotsSet,
    selectedCommand,
    selectedTargetId,
    damagePopups,
    playerDamagePopups,
    levelUpPopups,
    potions,
    cancelCommand,
    selectTarget,
    changeActiveExplorer,
    reorderCommandSlots,
    setCommandSlotDirect,
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
  const [draggingCommand, setDraggingCommand] = useState<BattleCommand | null>(null)
  const [draggingExplorerId, setDraggingExplorerId] = useState<string | null>(null)
  const [hoverEnemyId, setHoverEnemyId] = useState<string | null>(null)

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
  // ドラッグ中はクリックベースのターゲット選択を無効化（D&Dで処理するため）
  const isSelectingTarget = selectedCommand !== null && isCommandPhase && !draggingCommand
  const uniquePotions = potions.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
  const targetRates = calculateTargetRates(party)

  // === D&D ハンドラ ===
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current
    if (!data) return

    if ('command' in data) {
      const { command, explorerId } = data as { command: BattleCommand; explorerId: string }
      setDraggingCommand(command)
      setDraggingExplorerId(explorerId)
      setHoverEnemyId(null)
      // selectCommandはドロップ確定時のみ呼ぶ（ここで呼ぶとTargetSelectorが自動選択してしまう）
      const slotIndex = commandSlots.findIndex(s => s.explorerId === explorerId)
      if (slotIndex >= 0) changeActiveExplorer(slotIndex)
    }
  }, [commandSlots, changeActiveExplorer])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined
    if (overId?.startsWith('enemy-')) {
      setHoverEnemyId(overId.replace('enemy-', ''))
    } else {
      setHoverEnemyId(null)
    }
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingCommand(null)
    setDraggingExplorerId(null)
    setHoverEnemyId(null)

    if (!event.over || !isCommandPhase) {
      cancelCommand()
      return
    }

    const activeId = event.active.id as string
    const overId = event.over.id as string

    // 行動順ソートの判定
    if (activeId.startsWith('order-') && overId.startsWith('order-')) {
      const fromExplorerId = activeId.replace('order-', '')
      const toExplorerId = overId.replace('order-', '')
      const fromIndex = commandSlots.findIndex(s => s.explorerId === fromExplorerId)
      const toIndex = commandSlots.findIndex(s => s.explorerId === toExplorerId)
      if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
        reorderCommandSlots(fromIndex, toIndex)
      }
      return
    }

    // コマンドD&D
    const data = event.active.data.current
    if (!data || !('command' in data)) return

    const { command, explorerId } = data as { command: BattleCommand; explorerId: string }

    // targetTypeとドロップ先の整合性を検証
    const isEnemyTarget = command.targetType === 'enemySingle' || command.targetType === 'enemyAll'
    const isAllyTargetCmd = command.targetType === 'allySingle'

    let targetId: string | null = null
    if (overId.startsWith('enemy-') && isEnemyTarget) {
      targetId = overId.replace('enemy-', '')
    } else if (overId.startsWith('ally-') && isAllyTargetCmd) {
      targetId = overId.replace('ally-', '')
    }

    if (targetId) {
      // 単一アクションでスロットに直接セット（複数dispatch間のステート不整合を回避）
      setCommandSlotDirect(explorerId, command, targetId)
    }
  }, [isCommandPhase, commandSlots, setCommandSlotDirect, reorderCommandSlots])

  // コマンドD&DではpointerWithin（ポインタが実際に上にあるときのみ）、
  // 行動順ソートではclosestCenter（近い要素を検出）を使い分ける
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    if (draggingCommand) {
      return pointerWithin(args)
    }
    return closestCenter(args)
  }, [draggingCommand])

  const handleDragCancel = useCallback(() => {
    setDraggingCommand(null)
    setDraggingExplorerId(null)
    setHoverEnemyId(null)
    cancelCommand()
  }, [cancelCommand])

  // 行動順ソート用のID配列
  const orderIds = commandSlots.map(s => `order-${s.explorerId}`)

  return (
    <DndContext onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} collisionDetection={customCollisionDetection}>
      <div className="min-h-screen bg-gray-800 p-2 flex flex-col gap-2">

        {/* ===== 敵エリア ===== */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg relative min-h-[140px] flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-bold text-xs">Stage {run.currentStage}</span>
            <div className="flex gap-2 items-center">
              <span className="text-gray-400 text-[10px]">
                {phase === 'command' && 'コマンド選択'}
                {phase === 'partyAction' && 'パーティー行動中...'}
                {phase === 'enemyAction' && '敵行動中...'}
                {phase === 'turnEnd' && 'ターン終了'}
              </span>
              <span className="text-yellow-400 text-xs">Turn {turn}/{turnLimit}</span>
            </div>
          </div>

          <div className="absolute top-1 right-1 z-[5] flex gap-1">
            <NextStagePreview seed={run.seed} currentStage={run.currentStage} />
            <NextStagePreview seed={run.seed} currentStage={run.currentStage} offset={2} label="Next+" />
          </div>

          {visibleMessage && (
            <div className={`absolute top-8 left-1/2 -translate-x-1/2 z-10 bg-gray-800 border border-gray-500 px-4 py-1 rounded text-white text-xs font-bold shadow-lg transition-opacity duration-300 ${messageVisible ? 'opacity-100' : 'opacity-0'}`}>
              {visibleMessage}
            </div>
          )}

          <div className="flex-1 flex flex-wrap justify-center items-center content-center gap-3">
            {enemies.map((enemy) => {
              const isAllyTarget = selectedCommand?.targetType === 'allySingle' || draggingCommand?.targetType === 'allySingle'
              const { isSelected, isHighlighted } = isSelectingTarget && selectedCommand && !isAllyTarget
                ? getTargetSelectionState(enemy, selectedTargetId, selectedCommand.targetType)
                : { isSelected: false, isHighlighted: false }

              // ドラッグ中: 攻撃対象になりうる敵全体を強調
              const isDraggingAttack = draggingCommand !== null && !isAllyTarget && enemy.currentHp > 0
              // ホバー中の個別強調: 直接ホバーされている or 全体攻撃時は全敵
              const isEnemyAll = draggingCommand?.targetType === 'enemyAll'
              const isHoveredEnemy = isDraggingAttack && (
                hoverEnemyId === enemy.instanceId || (isEnemyAll && hoverEnemyId !== null)
              )

              // キルラインバー: ホバー中なら仮想コマンドを含めてプレビュー計算
              const previewOptions = { relics: run.relics, killStreakActive: battleState.relicState.killStreakActive, includeConditionalRelics: true }
              let tentative: TentativeCommand | null = null
              if (draggingCommand && draggingExplorerId && hoverEnemyId && !isAllyTarget) {
                // 全体攻撃: ホバー先に関係なく全敵にダメージ
                // 単体攻撃: ホバー先の敵のみ
                const targetForTentative = isEnemyAll ? enemy.instanceId : hoverEnemyId
                tentative = {
                  command: draggingCommand,
                  explorerId: draggingExplorerId,
                  targetEnemyId: targetForTentative,
                }
              }
              const damagePreview = isCommandPhase
                ? calculateCumulativeDamagePreview(commandSlots, enemy.instanceId, party, previewOptions, tentative)
                : null

              return (
                <DroppableTarget key={enemy.instanceId} id={`enemy-${enemy.instanceId}`} disabled={!isCommandPhase || enemy.currentHp <= 0 || draggingCommand?.targetType === 'allySingle'}>
                  <EnemyDisplay enemy={enemy} isCurrentActor={false}
                    isTargetSelected={isSelected} isTargetHighlighted={isHighlighted}
                    isDragTarget={isDraggingAttack}
                    isHovered={isHoveredEnemy}
                    onSelect={isSelectingTarget && enemy.currentHp > 0 ? () => selectTarget(enemy.instanceId) : undefined}
                    damagePreview={damagePreview} intent={battleState.enemyIntents.find(i => i.enemyInstanceId === enemy.instanceId)} />
                </DroppableTarget>
              )
            })}
          </div>

          {damagePopups.map((popup) => {
            const targetIndex = enemies.findIndex(e => e.instanceId === popup.targetId)
            if (targetIndex === -1) return null
            return <DamagePopup key={popup.id} damage={popup.damage} targetIndex={targetIndex} totalTargets={enemies.length} onComplete={() => removePopup(popup.id)} />
          })}
        </div>

        {/* ===== 行動順スロット（D&Dソート可能 + コマンド内容表示） ===== */}
        <div className="bg-gray-900 border border-gray-600 px-2 py-1.5 rounded-lg">
          <SortableContext items={orderIds} strategy={horizontalListSortingStrategy}>
            <ActionOrderSlots commandSlots={commandSlots} party={party} enemies={enemies} isCommandPhase={isCommandPhase} />
          </SortableContext>
        </div>

        {/* ===== キャラ欄4等分（3キャラ + 共有枠） ===== */}
        <div className="grid grid-cols-4 gap-1.5 flex-1 min-h-0">
          {party.map((member) => {
            const memberAvailCmds = getAvailableCommands(member, gold, potions)
            const rate = targetRates.find(r => r.explorerId === member.id)?.rate
            return (
              <CharacterPanel
                key={member.id}
                member={member}
                isCommandPhase={isCommandPhase}
                availableCommands={memberAvailCmds}
                targetRate={rate}
                isSelectingTarget={isSelectingTarget}
                selectedTargetId={selectedTargetId}
                draggingAllyTarget={draggingCommand?.targetType === 'allySingle'}
                draggingEnemyTarget={draggingCommand !== null && (draggingCommand.targetType === 'enemySingle' || draggingCommand.targetType === 'enemyAll')}
                onAllyClick={() => {
                  if (isSelectingTarget && selectedCommand?.targetType === 'allySingle') {
                    selectTarget(member.id)
                    setTimeout(() => executeCommand(), 0)
                  }
                }}
              />
            )
          })}
          <SharedPanel potions={uniquePotions} relics={run.relics} isCommandPhase={isCommandPhase} gold={gold} />
        </div>

        {/* ===== 実行ボタン（最下段） ===== */}
        {isCommandPhase && (
          <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
            <Button variant="primary" onClick={startExecution} disabled={!allSlotsSet} className="w-full text-sm">
              {allSlotsSet ? '実行' : 'コマンドを選択してください'}
            </Button>
          </div>
        )}

        {playerDamagePopups.map((popup) => (
          <DamagePopup key={popup.id} damage={popup.damage} targetIndex={0} totalTargets={1} onComplete={() => removePlayerPopup(popup.id)} isPlayerDamage={true} />
        ))}

        {isSelectingTarget && selectedCommand && !draggingCommand && (
          <TargetSelector enemies={enemies} selectedTargetId={selectedTargetId} targetType={selectedCommand.targetType}
            columns={2} party={party} onSelectTarget={selectTarget} onConfirm={executeCommand} onCancel={cancelCommand} />
        )}

        {!expAnimating && levelUpPopups.length > 0 && (
          <LevelUpModal levelUpInfo={levelUpPopups[0].levelUpInfo} onComplete={() => removeLevelUpPopup(levelUpPopups[0].id)} />
        )}

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
