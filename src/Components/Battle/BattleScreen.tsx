import { useEffect, useState, useCallback } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverEvent, DragOverlay, pointerWithin, closestCenter, CollisionDetection } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useGame } from '../../Hooks/UseGame'
import { useBattle } from '../../Hooks/UseBattle'
import { checkBattleResult, calculateTargetRates, getAvailableCommands, getRequiredKillsForNextLevel, isWeapon } from '../../Lib/Core'
import { calculateDetailedDamagePreview, TentativeCommand } from '../../Lib/Utils/DamagePredictor'
import { BattleCommand, CommandSlot } from '../../Lib/Types/Battle'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { RelicInstance } from '../../Lib/Types/Relic'
import { calculateRelicAttackImpacts } from '../../Lib/Utils/RelicImpactCalculator'
import { Button } from '../Common/Button'
import { ResourceBar, Tooltip } from '../Common'
import { EnemyDisplay } from './EnemyDisplay'
import { TargetSelector, getTargetSelectionState } from './TargetSelector'
import { DamagePopup } from './DamagePopup'
import { LevelUpModal } from './LevelUpModal'
import { DraggableCommand } from './DraggableCommand'
import { DroppableTarget } from './DroppableTarget'
import { TooltipCard } from '../Common/TooltipCard'
import { NextStagePreview } from './NextStagePreview'
import { GameOverOverlay } from './GameOverOverlay'
import { ExpPopupEffect } from './ExpPopupEffect'
import { PlayerDamagePopupEffect } from './PlayerDamagePopupEffect'

/** ターゲット名を解決 */
function resolveTargetName(
  targetId: string | null,
  party: ExplorerState[],
  enemies: { instanceId: string; name: string }[]
): string {
  if (!targetId) return ''
  const enemy = enemies.find(e => e.instanceId === targetId)
  if (enemy) return enemy.name
  const member = party.find(m => m.id === targetId)
  if (member) return member.name
  return ''
}

/** 行動順番号 */
const ORDER_BADGES = ['①', '②', '③', '④', '⑤']

const ACTION_DELAY_MS = 500
const ENEMY_TURN_DELAY_MS = 600
const TURN_END_DELAY_MS = 300
const MESSAGE_DISPLAY_MS = 1500

/** キャラ欄: ステータスバー + コマンド一覧 */
function CharacterPanel({
  member,
  isCommandPhase,
  isGameOver,
  availableCommands,
  targetRate,
  previewRate,
  isSelectingTarget,
  selectedTargetId,
  draggingAllyTarget,
  draggingEnemyTarget,
  onAllyClick,
  commandSlot,
  allEnemies,
  allParty,
  draggingPanel,
  orderIndex,
  dragHandleProps,
}: {
  member: ExplorerState
  isCommandPhase: boolean
  isGameOver: boolean
  availableCommands: BattleCommand[]
  targetRate: number | undefined
  previewRate: number | undefined
  isSelectingTarget: boolean
  selectedTargetId: string | null
  draggingAllyTarget: boolean
  draggingEnemyTarget: boolean
  onAllyClick: () => void
  commandSlot: CommandSlot | null
  allEnemies: { instanceId: string; name: string }[]
  allParty: ExplorerState[]
  draggingPanel: boolean
  orderIndex: number
  dragHandleProps?: { listeners: ReturnType<typeof useSortable>['listeners']; attributes: ReturnType<typeof useSortable>['attributes'] }
}) {
  const isDead = member.hp <= 0
  const positionLabel = member.position === 'front' ? '前衛' : '後衛'
  const positionColor = member.position === 'front' ? 'text-orange-400' : 'text-cyan-400'
  const commands = [...member.weapons, ...member.spells]

  // EXP/レベルアップ進捗
  const requiredKills = getRequiredKillsForNextLevel(member.level)
  const expProgress = requiredKills > 0 ? member.exp : 0

  return (
    <DroppableTarget id={`ally-${member.id}`} disabled={!isCommandPhase || draggingEnemyTarget || draggingPanel}>
      <div
        className={`relative h-full flex flex-col rounded p-1.5 ${isDead ? 'opacity-40 bg-gray-800' : 'bg-gray-800/50'}`}
        onClick={onAllyClick}
      >
        {/* ドラッグ領域: 名前〜EXPバー */}
        <div
          {...(dragHandleProps?.listeners ?? {})}
          {...(dragHandleProps?.attributes ?? {})}
          className={`select-none ${isCommandPhase && !isDead ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          {/* ヘッダー: 行動順番号 + 名前 + レベル */}
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-1">
              <span className="text-yellow-400 font-bold text-[10px]">{ORDER_BADGES[orderIndex] ?? `${orderIndex + 1}`}</span>
              <span className="text-white font-bold text-xs">{member.name}</span>
            </div>
            <span className="text-yellow-400 text-[10px]">Lv.{member.level}</span>
          </div>

          {/* 選択済みコマンド表示 */}
          {commandSlot?.command && (
            <div className="text-[10px] mb-0.5 truncate">
              <span className="text-green-300">→{commandSlot.command.name}</span>
              {commandSlot.targetId && (
                <span className="text-gray-400 ml-1">→{resolveTargetName(commandSlot.targetId, allParty, allEnemies)}</span>
              )}
            </div>
          )}

          {/* HP バー */}
          <div id={`hp-bar-${member.id}`} className="mb-0.5">
            <div className="flex justify-between text-[9px] text-gray-400">
              <span className="text-red-400">HP</span>
              <span>{member.hp}/{member.maxHp}</span>
            </div>
            <ResourceBar current={member.hp} max={member.maxHp} color="green" showText={false} size="sm" />
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
          <div id={`exp-gauge-${member.id}`} className="mb-1">
            <div className="flex justify-between text-[9px] text-gray-400">
              <span className="text-yellow-400">EXP</span>
              <span>{expProgress}/{requiredKills}</span>
            </div>
            <ResourceBar current={expProgress} max={requiredKills} color="yellow" showText={false} size="sm" />
          </div>
        </div>

        {/* 前衛/後衛 + 被弾率 */}
        {targetRate !== undefined && !isDead && (
          <div className="text-[9px] text-gray-400 mb-1">
            <span className={positionColor}>{positionLabel}</span>
            <span className="mx-1">被弾:</span>
            <span className={targetRate >= 0.5 ? 'text-red-400 font-bold' : 'text-gray-300'}>{Math.round(targetRate * 100)}%</span>
            {previewRate !== undefined && Math.round(previewRate * 100) !== Math.round(targetRate * 100) && (
              <>
                <span className="text-gray-500 mx-0.5">→</span>
                <span className={previewRate >= 0.5 ? 'text-red-400 font-bold' : 'text-yellow-400 font-bold'}>{Math.round(previewRate * 100)}%</span>
              </>
            )}
          </div>
        )}

        {/* 戦闘不能バッジ（コマンド一覧の上に小さく表示） */}
        {isDead && (
          <div className="text-center text-red-400 text-[10px] font-bold mb-0.5">戦闘不能</div>
        )}

        {/* コマンド一覧（D&Dドラッグ元。戦闘不能時・ゲームオーバー時もグレーアウトして表示、ドラッグは無効） */}
        {(isCommandPhase || isGameOver) && (
          <div className="flex-1 overflow-y-auto space-y-0 mt-0.5">
            {commands.map((cmd, cmdIdx) => {
              const isAvail = !isDead && !isGameOver && availableCommands.some(ac => ac.id === cmd.id)
              // 武器のweapons配列内インデックスを計算（spellsはundefined）
              const weaponIdx = cmdIdx < member.weapons.length ? cmdIdx : undefined
              return (
                <DraggableCommand
                  key={`${cmd.id}-${cmdIdx}`}
                  command={cmd}
                  explorerId={member.id}
                  commandIndex={weaponIdx}
                  disabled={!isCommandPhase || isDead || isGameOver}
                  isAvailable={isAvail}
                  attackerStr={member.str}
                  attackerInt={member.int}
                />
              )
            })}
          </div>
        )}

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
  party,
}: {
  potions: { id: string; name: string; commandCategory: 'potion' }[]
  relics: RelicInstance[]
  isCommandPhase: boolean
  gold: number
  party: ExplorerState[]
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
              <Tooltip key={relic.id} content={<TooltipCard item={relic} attackImpacts={calculateRelicAttackImpacts(relic, party, relics.filter(r => r.id !== relic.id))} />} position="top">
                <div className="text-[10px] text-gray-300 truncate">
                  {relic.name}
                </div>
              </Tooltip>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

/** ソート可能なキャラパネルラッパー */
function SortableCharacterPanel({
  member,
  isCommandPhase,
  isDead,
  children,
}: {
  member: ExplorerState
  orderIndex: number
  isCommandPhase: boolean
  isDead: boolean
  children: (dragHandleProps: { listeners: ReturnType<typeof useSortable>['listeners']; attributes: ReturnType<typeof useSortable>['attributes'] }) => React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `panel-${member.id}`,
    disabled: !isCommandPhase || isDead,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? 'opacity-50 z-10' : ''}`}>
      {children({ listeners: listeners ?? {}, attributes })}
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
    expPopups,
    potions,
    cancelCommand,
    selectTarget,
    changeActiveExplorer,
    reorderParty,
    usePotionInstant,
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
    removeExpPopup,
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
  const [draggingPanel, setDraggingPanel] = useState(false)
  const [hoverEnemyId, setHoverEnemyId] = useState<string | null>(null)

  // === フェーズ自動処理 ===
  // レベルアップポップアップ表示中はフェーズ進行を一時停止
  const hasLevelUpPopups = levelUpPopups.length > 0

  useEffect(() => {
    if (phase !== 'partyAction' || hasLevelUpPopups) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const t1 = setTimeout(() => {
      executePartyAction()
      const t2 = setTimeout(() => advancePartyAction(), ACTION_DELAY_MS / 2)
      timers.push(t2)
    }, ACTION_DELAY_MS)
    timers.push(t1)
    return () => timers.forEach(t => clearTimeout(t))
  }, [phase, battleState.currentCommandIndex, hasLevelUpPopups]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'enemyAction' || hasLevelUpPopups) return
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
  }, [phase, battleState.currentEnemyIndex, hasLevelUpPopups]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'turnEnd' || hasLevelUpPopups) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const t1 = setTimeout(() => {
      processTurnEnd()
      const t2 = setTimeout(() => startNewTurn(), TURN_END_DELAY_MS)
      timers.push(t2)
    }, ACTION_DELAY_MS)
    timers.push(t1)
    return () => timers.forEach(t => clearTimeout(t))
  }, [phase, hasLevelUpPopups]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasLevelUpPopups || battleState.isGameOver) return
    const result = checkBattleResult(enemies, party)
    if (result === 'ongoing') return
    // HPバーアニメーション(300ms) + 余韻(500ms) を待ってから遷移
    const timer = setTimeout(() => endBattle(result), 800)
    return () => clearTimeout(timer)
  }, [enemies, party, endBattle, hasLevelUpPopups, battleState.isGameOver])

  const isCommandPhase = phase === 'command'
  // ドラッグ中はクリックベースのターゲット選択を無効化（D&Dで処理するため）
  const isSelectingTarget = selectedCommand !== null && isCommandPhase && !draggingCommand
  const uniquePotions = potions.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
  const targetRates = calculateTargetRates(party)

  // 祈りコマンドによる被弾率プレビュー
  const previewParty = party.map(member => {
    const prayerSlot = commandSlots.find(s =>
      s.targetId === member.id && s.command &&
      isWeapon(s.command) && 'effect' in s.command && s.command.effect?.type === 'targetRateUp'
    )
    if (!prayerSlot?.command) return member
    if (member.battleBuffs.some(b => b.type === 'targetRateUp')) return member
    const effect = (prayerSlot.command as { effect: { value: number } }).effect
    return {
      ...member,
      battleBuffs: [...member.battleBuffs, { type: 'targetRateUp' as const, value: effect.value, duration: 1 as const }],
    }
  })
  const previewTargetRates = calculateTargetRates(previewParty)

  // === D&D ハンドラ ===
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id as string

    // パネル並び替え
    if (activeId.startsWith('panel-')) {
      setDraggingPanel(true)
      return
    }

    // コマンドD&D
    const data = event.active.data.current
    if (!data) return

    if ('command' in data) {
      const { command, explorerId } = data as { command: BattleCommand; explorerId: string }
      setDraggingCommand(command)
      setDraggingExplorerId(explorerId)
      setHoverEnemyId(null)
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
    setDraggingPanel(false)
    setHoverEnemyId(null)

    if (!event.over || !isCommandPhase) {
      cancelCommand()
      return
    }

    const activeId = event.active.id as string
    const overId = event.over.id as string

    // パネル並び替え（ally- ドロップゾーンが内側にあるため両方のプレフィックスを認識）
    if (activeId.startsWith('panel-')) {
      let targetMemberId: string | null = null
      if (overId.startsWith('panel-')) {
        targetMemberId = overId.replace('panel-', '')
      } else if (overId.startsWith('ally-')) {
        targetMemberId = overId.replace('ally-', '')
      }
      if (targetMemberId) {
        const fromExplorerId = activeId.replace('panel-', '')
        const fromIndex = party.findIndex(m => m.id === fromExplorerId)
        const toIndex = party.findIndex(m => m.id === targetMemberId)
        if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
          reorderParty(fromIndex, toIndex)
        }
      }
      return
    }

    // コマンドD&D
    const data = event.active.data.current
    if (!data || !('command' in data)) return

    const { command, explorerId: rawExplorerId, weaponIndex } = data as { command: BattleCommand; explorerId: string; weaponIndex?: number }
    // ポーションは explorerId="shared" で来るので、アクティブエクスプローラーのIDに差し替え
    const explorerId = rawExplorerId === 'shared'
      ? commandSlots[battleState.activeExplorerIndex]?.explorerId ?? rawExplorerId
      : rawExplorerId

    const isEnemyTarget = command.targetType === 'enemySingle' || command.targetType === 'enemyAll'
    const isAllyTargetCmd = command.targetType === 'allySingle'

    let targetId: string | null = null
    if (overId.startsWith('enemy-') && isEnemyTarget) {
      targetId = overId.replace('enemy-', '')
    } else if (overId.startsWith('ally-') && isAllyTargetCmd) {
      targetId = overId.replace('ally-', '')
    }

    if (targetId) {
      // ポーションは即時発動（行動消費なし）
      if (command.commandCategory === 'potion') {
        usePotionInstant(command.id, targetId)
      } else {
        setCommandSlotDirect(explorerId, command, targetId, weaponIndex)
      }
    }
  }, [isCommandPhase, party, setCommandSlotDirect, usePotionInstant, reorderParty, cancelCommand, commandSlots, battleState.activeExplorerIndex])

  // コマンドD&DではpointerWithin、パネルソートではpanel-/ally-のみ対象のclosestCenter
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    if (draggingCommand) {
      return pointerWithin(args)
    }
    if (draggingPanel) {
      // パネルドラッグ中は panel- と ally- のみを衝突対象にする
      const filtered = {
        ...args,
        droppableContainers: args.droppableContainers.filter(c => {
          const id = String(c.id)
          return id.startsWith('panel-') || id.startsWith('ally-')
        }),
      }
      return closestCenter(filtered)
    }
    return closestCenter(args)
  }, [draggingCommand, draggingPanel])

  const handleDragCancel = useCallback(() => {
    if (draggingCommand) {
      cancelCommand()
    }
    setDraggingCommand(null)
    setDraggingExplorerId(null)
    setDraggingPanel(false)
    setHoverEnemyId(null)
  }, [cancelCommand, draggingCommand])

  // パネルソート用のID配列
  const panelIds = party.map(m => `panel-${m.id}`)

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
              const previewOptions = { relics: run.relics, killStreakActive: battleState.relicState.killStreakActive, includeConditionalRelics: true, weaponBreakMultiplier: run.weaponBreakMultiplier ?? 0 }
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
                ? calculateDetailedDamagePreview(commandSlots, enemy.instanceId, party, previewOptions, tentative)
                : null

              return (
                <div key={enemy.instanceId} id={`enemy-dom-${enemy.instanceId}`}>
                  <DroppableTarget id={`enemy-${enemy.instanceId}`} disabled={!isCommandPhase || enemy.currentHp <= 0 || draggingCommand?.targetType === 'allySingle' || draggingPanel}>
                    <EnemyDisplay enemy={enemy} isCurrentActor={false}
                      isTargetSelected={isSelected} isTargetHighlighted={isHighlighted}
                      isDragTarget={isDraggingAttack}
                      isHovered={isHoveredEnemy}
                      onSelect={isSelectingTarget && enemy.currentHp > 0 ? () => selectTarget(enemy.instanceId) : undefined}
                      damagePreview={damagePreview} intent={battleState.enemyIntents.find(i => i.enemyInstanceId === enemy.instanceId)} />
                  </DroppableTarget>
                </div>
              )
            })}
          </div>

          {damagePopups.map((popup) => {
            const targetIndex = enemies.findIndex(e => e.instanceId === popup.targetId)
            if (targetIndex === -1) return null
            return <DamagePopup key={popup.id} damage={popup.damage} targetIndex={targetIndex} totalTargets={enemies.length} onComplete={() => removePopup(popup.id)} contributors={popup.contributors} />
          })}
        </div>

        {/* ===== キャラ欄4等分（3キャラ + 共有枠）D&Dソート可能 ===== */}
        <div className="grid grid-cols-4 gap-1.5 flex-1 min-h-0">
          <SortableContext items={panelIds} strategy={horizontalListSortingStrategy}>
            {party.map((member, index) => {
              const memberAvailCmds = getAvailableCommands(member, gold, potions)
              const rate = targetRates.find(r => r.explorerId === member.id)?.rate
              const prevRate = previewTargetRates.find(r => r.explorerId === member.id)?.rate
              const slot = commandSlots.find(s => s.explorerId === member.id) ?? null
              return (
                <SortableCharacterPanel
                  key={member.id}
                  member={member}
                  orderIndex={index}
                  isCommandPhase={isCommandPhase}
                  isDead={member.hp <= 0}
                >
                  {(dragHandleProps) => (
                    <CharacterPanel
                      member={member}
                      isCommandPhase={isCommandPhase}
                      isGameOver={battleState.isGameOver ?? false}
                      availableCommands={memberAvailCmds}
                      targetRate={rate}
                      previewRate={prevRate}
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
                      commandSlot={slot}
                      allEnemies={enemies}
                      allParty={party}
                      draggingPanel={draggingPanel}
                      orderIndex={index}
                      dragHandleProps={dragHandleProps}
                    />
                  )}
                </SortableCharacterPanel>
              )
            })}
          </SortableContext>
          <SharedPanel potions={uniquePotions} relics={run.relics} isCommandPhase={isCommandPhase} gold={gold} party={party} />
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
          <PlayerDamagePopupEffect key={popup.id} popup={popup} onComplete={() => removePlayerPopup(popup.id)} />
        ))}

        {isSelectingTarget && selectedCommand && !draggingCommand && (
          <TargetSelector enemies={enemies} selectedTargetId={selectedTargetId} targetType={selectedCommand.targetType}
            columns={2} party={party} onSelectTarget={selectTarget} onConfirm={executeCommand} onCancel={cancelCommand} />
        )}

        {!expAnimating && levelUpPopups.length > 0 && (
          <LevelUpModal key={levelUpPopups[0].id} levelUpInfo={levelUpPopups[0].levelUpInfo} onComplete={() => removeLevelUpPopup(levelUpPopups[0].id)} />
        )}

        <DragOverlay>
          {draggingCommand && (
            <div className="bg-gray-800 border border-yellow-400 rounded px-3 py-1 text-sm text-white shadow-lg">
              {draggingCommand.name}
            </div>
          )}
          {draggingPanel && (
            <div className="bg-gray-700 border border-yellow-400 rounded px-4 py-2 text-xs text-white shadow-lg">
              ≡ 移動中
            </div>
          )}
        </DragOverlay>

        {/* 経験値獲得エフェクト（敵位置→メンバーの経験値バーへ飛ぶ） */}
        {expPopups.map(popup => (
          <ExpPopupEffect key={popup.id} popup={popup} onComplete={() => removeExpPopup(popup.id)} />
        ))}

        {battleState.isGameOver && <GameOverOverlay onReturnTitle={returnToTitle} />}
      </div>
    </DndContext>
  )
}
