import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverEvent, DragOverlay, pointerWithin, closestCenter, CollisionDetection } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useGame } from '../../Hooks/UseGame'
import { useBattle } from '../../Hooks/UseBattle'
import { checkBattleResult, calculateTargetRates, getAvailableCommands, getRequiredKillsForNextLevel, isWeapon, isSpell, isPotion, isFrontMember, targetsDownedAlly, getPotionEffectMultiplier } from '../../Lib/Core'
import { calculateDetailedDamagePreview, TentativeCommand, getComboConditionBonus, getComboBonusAssumingAttacker, pendingWeaponPowerBonus, pendingWeaponPowerBuffSources } from '../../Lib/Utils/DamagePredictor'
import { classifyCommandsKillPotential, killPotentialKey, getReferenceEnemy, KillCategory } from '../../Lib/Utils/KillPotential'
import { BattleCommand, CommandSlot, ExpPopup } from '../../Lib/Types/Battle'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { RelicInstance } from '../../Lib/Types/Relic'
import { calculateRelicAttackImpacts } from '../../Lib/Utils/RelicImpactCalculator'
import { Button } from '../Common/Button'
import { ResourceBar, Tooltip, SegmentedBar } from '../Common'
import { EnemyDisplay } from './EnemyDisplay'
import { TargetSelector, getTargetSelectionState } from './TargetSelector'
import { DamagePopup } from './DamagePopup'
import { LevelUpPopupEffect } from './LevelUpPopupEffect'
import { DraggableCommand } from './DraggableCommand'
import { DroppableTarget } from './DroppableTarget'
import { TooltipCard } from '../Common/TooltipCard'
import { NextStagePreview } from './NextStagePreview'
import { GameOverOverlay } from './GameOverOverlay'
import { ExpPopupEffect } from './ExpPopupEffect'
import { PlayerDamagePopupEffect } from './PlayerDamagePopupEffect'
import { PartyAvatars, AvatarActingType, CLASS_ICONS, AvatarVisual } from './PartyAvatars'
import { DebugButton } from '../Debug/DebugButton'
import { DebugWindow } from '../Debug/DebugWindow'

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

/**
 * コマンドスロットに積まれたヒール魔法・蘇生呪文が、対象メンバーを回復させる予測量の合計（未クランプ）を返す。
 * 確定済みのスロットに加え、ドラッグ中ホバーを仮反映した previewCommandSlots を渡すことで、
 * 「ドロップ前のホバー中」も「ドロップ後〜ターン実行開始まで」も同じ計算でプレビューできる。
 * ポーションはスロットに乗らない（即時発動）ため対象外。
 */
function getPendingHealForMember(slots: CommandSlot[], member: ExplorerState): number {
  let total = 0
  for (const slot of slots) {
    if (!slot.command) continue
    if (!isSpell(slot.command)) continue
    const effect = slot.command.effect
    // 全体回復は全員、単体はこのメンバーを対象にしているスロットのみ
    const targetsMember = slot.command.targetType === 'allyAll' || slot.targetId === member.id
    if (!targetsMember) continue
    if (effect?.type === 'heal' && member.hp > 0) {
      // ヒールは生存者のみ対象
      total += effect.value
    } else if (effect?.type === 'revive' && member.hp <= 0) {
      // 蘇生は戦闘不能者のみ対象。HP=0 から reviveHp まで伸ばす
      total += Math.min(effect.hp, member.maxHp)
    }
  }
  return total
}

/**
 * HP回復ポーション（healHp）が対象メンバーを回復させる予測量（未クランプ）を返す。
 * 対象外・回復不要（HP満タン、戦闘不能者）の場合は 0。ポーションは即時発動のためホバー中のみ使う。
 */
function getPotionHpRestoreAmount(command: BattleCommand, member: ExplorerState, potionMultiplier: number): number {
  if (isPotion(command) && command.effect.type === 'healHp') {
    const amount = Math.floor(command.effect.value * potionMultiplier)
    return member.hp > 0 ? Math.max(0, amount) : 0
  }
  return 0
}

/**
 * MP回復ポーション（healMp）が対象メンバーを回復させる予測量を返す。
 * 対象外・回復不要（MP満タン、戦闘不能者）の場合は 0。MPバーの点滅プレビューに使う。
 */
function getMpRestorePreviewAmount(command: BattleCommand, member: ExplorerState, potionMultiplier: number): number {
  const missing = member.maxMp - member.mp
  if (isPotion(command) && command.effect.type === 'healMp') {
    const amount = Math.floor(command.effect.value * potionMultiplier)
    // MP回復ポーションは生存者のみ対象
    return member.hp > 0 ? Math.max(0, Math.min(amount, missing)) : 0
  }
  return 0
}

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
  reviveMode,
  onAllyClick,
  commandSlot,
  allEnemies,
  allParty,
  draggingPanel,
  orderIndex,
  dragHandleProps,
  relics,
  killCategoryMap,
  weaponPowerBonusPreview,
  weaponBuffSources = [],
  comboBonusPreview = 0,
  previewCommandSlots,
  memberSlotIndex,
  hpPreviewAdd = 0,
  mpPreviewAdd = 0,
  acting,
  shaking,
  levelingUp,
  displayedExp,
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
  reviveMode: boolean
  onAllyClick: () => void
  commandSlot: CommandSlot | null
  allEnemies: { instanceId: string; name: string }[]
  allParty: ExplorerState[]
  draggingPanel: boolean
  orderIndex: number
  relics: RelicInstance[]
  /** 各コマンドの撃破確定カテゴリ（左端アクセントバーの着色に使う） */
  killCategoryMap?: Map<string, KillCategory>
  /** このキャラがこのターン先に受け取る武器強化の合計（武器チップの予測に反映） */
  weaponPowerBonusPreview: number
  /** このキャラが先に受け取る武器強化魔法の内訳（バフポップアップで呪文名つき表示） */
  weaponBuffSources?: { name: string; value: number }[]
  /** 連携の紋章: このキャラが攻撃をセットしたと仮定した場合のSTR/INTボーナス（コマンドチップの予測に反映） */
  comboBonusPreview?: number
  /** 行動順スロット（追撃のナイフ等の先行味方攻撃数の算出用。ドラッグ中ホバーを仮反映済み） */
  previewCommandSlots?: CommandSlot[]
  /** このキャラの行動順スロットインデックス（追撃系の算出用） */
  memberSlotIndex?: number
  /** 回復系コマンドのドラッグ中ホバー時、このキャラが回復する予測量（HPバーを点滅で伸ばす） */
  hpPreviewAdd?: number
  /** MP回復ポーションのドラッグ中ホバー時、このキャラが回復するMPの予測量（MPバーを点滅で伸ばす） */
  mpPreviewAdd?: number
  dragHandleProps?: { listeners: ReturnType<typeof useSortable>['listeners']; attributes: ReturnType<typeof useSortable>['attributes'] }
  /** 行動中ならアニメ種別。攻撃/ヒール時にパネル全体を浮かせる */
  acting: AvatarActingType | null
  /** 被弾時の振動フラグ */
  shaking: boolean
  /** レベルアップ縦伸縮中フラグ（最優先） */
  levelingUp: boolean
  /** EXPバー表示用の進捗値（経験値ポップアップ未到達分は除外）。max は requiredKills */
  displayedExp: number
}) {
  const isDead = member.hp <= 0
  const isFront = isFrontMember(allParty, member.id)
  const positionLabel = isFront ? '前衛' : '後衛'
  const commands = [...member.weapons, ...member.spells]

  // HP割合しきい値で発動する武器（怒りの大剣など）所持中はHPバーに閾値マーカーを表示
  let hpThresholdMarker: { positionPct: number; tooltip: string } | null = null
  for (const w of member.weapons) {
    if ('effect' in w && w.effect?.type === 'hpThresholdBonus' && w.effect.when === 'below') {
      hpThresholdMarker = {
        positionPct: w.effect.thresholdRate * 100,
        tooltip: `${w.name}：HP${Math.round(w.effect.thresholdRate * 100)}%以下でPower+${w.effect.powerBonus}`,
      }
      break
    }
  }

  // EXP/レベルアップ進捗
  const requiredKills = getRequiredKillsForNextLevel(member.level)
  const expProgress = requiredKills > 0 ? displayedExp : 0

  const animClass = levelingUp
    ? 'animate-levelup-stretch'
    : acting
      ? 'animate-panel-rise'
      : shaking
        ? 'animate-panel-shake'
        : ''

  return (
    <DroppableTarget id={`ally-${member.id}`} disabled={!isCommandPhase || draggingEnemyTarget || draggingPanel}>
      <div
        className={`relative h-full flex flex-col rounded-lg border border-gray-500 p-1.5 ${isDead ? 'opacity-40 bg-gray-800' : 'bg-gray-800/50'} ${animClass}`}
        onClick={onAllyClick}
      >
        {/* ドラッグ領域: 名前〜EXPバー */}
        <div
          {...(dragHandleProps?.listeners ?? {})}
          {...(dragHandleProps?.attributes ?? {})}
          className={`select-none ${isCommandPhase ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          {/* ヘッダー: 行動順番号 + クラスアイコン + 名前 + レベル */}
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-yellow-400 font-bold text-sm shrink-0">{ORDER_BADGES[orderIndex] ?? `${orderIndex + 1}`}</span>
              <span className="text-2xl leading-none shrink-0">{CLASS_ICONS[member.characterClass]}</span>
              <span className="text-white font-bold text-2xl truncate">{member.name}</span>
              {member.battleDebuffs.find(d => d.type === 'weakness') && (
                <span className="text-red-400 text-xs font-bold bg-red-900/50 px-1 rounded shrink-0">
                  攻↓{(member.battleDebuffs.find(d => d.type === 'weakness') as { duration: number }).duration}
                </span>
              )}
              {member.battleDebuffs.find(d => d.type === 'vulnerability') && (
                <span className="text-red-400 text-xs font-bold bg-red-900/50 px-1 rounded shrink-0">
                  被↑{(member.battleDebuffs.find(d => d.type === 'vulnerability') as { duration: number }).duration}
                </span>
              )}
              {(() => {
                // シールドバフ（複数付与時は合算して表示）
                const shieldTotal = member.battleBuffs
                  .filter(b => b.type === 'shield')
                  .reduce((sum, b) => sum + b.value, 0)
                return shieldTotal > 0 && (
                  <span className="text-cyan-300 text-xs font-bold bg-cyan-900/50 px-1 rounded shrink-0">
                    盾{shieldTotal}
                  </span>
                )
              })()}
              {(() => {
                const thornsBuff = member.battleBuffs.find(b => b.type === 'thorns')
                return thornsBuff && (
                  <span className="text-orange-400 text-xs font-bold bg-orange-900/50 px-1 rounded shrink-0">
                    棘{thornsBuff.value}
                  </span>
                )
              })()}
            </div>
            <span className="text-yellow-400 text-xl font-bold shrink-0">Lv.{member.level}</span>
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
              <span>
                {member.hp}/{member.maxHp}
                {hpPreviewAdd > 0 && (
                  <span className="text-green-300 animate-exp-blink ml-0.5">+{hpPreviewAdd}</span>
                )}
              </span>
            </div>
            <div className="relative">
              <ResourceBar current={member.hp} max={member.maxHp} color="green" showText={false} size="sm" preview={hpPreviewAdd} />
              {/* HP割合しきい値マーカー（怒りの大剣など所持時） */}
              {hpThresholdMarker && (
                <div
                  className="absolute inset-y-0 z-[2]"
                  style={{ left: `${hpThresholdMarker.positionPct}%`, transform: 'translateX(-50%)' }}
                >
                  <Tooltip content={hpThresholdMarker.tooltip} position="top">
                    <div className="px-1 -mx-1 h-full flex items-center cursor-help">
                      <div className="w-0.5 h-3 -my-0.5 bg-white rounded-full shadow ring-1 ring-black/40" />
                    </div>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>

          {/* MP バー */}
          <div className="mb-0.5">
            <div className="flex justify-between text-[9px] text-gray-400">
              <span className="text-blue-400">MP</span>
              <span>
                {member.mp}/{member.maxMp}
                {mpPreviewAdd > 0 && (
                  <span className="text-blue-300 animate-exp-blink ml-0.5">+{mpPreviewAdd}</span>
                )}
              </span>
            </div>
            <ResourceBar current={member.mp} max={member.maxMp} color="blue" showText={false} size="sm" preview={mpPreviewAdd} />
          </div>

          {/* EXP バー（必要敵数で区画分割表示。経験値到達時に1セグずつ点灯） */}
          <div id={`exp-gauge-${member.id}`} className="mb-1">
            <div className="flex justify-between text-[9px] text-gray-400">
              <span className="text-yellow-400">EXP</span>
              <span>{expProgress}/{requiredKills}</span>
            </div>
            <SegmentedBar current={expProgress} max={requiredKills} color="yellow" size="sm" animateExpansion />
          </div>
        </div>

        {/* 前衛/後衛ラベル + 被弾率 */}
        {targetRate !== undefined && !isDead && (
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className={`text-base font-bold px-1.5 py-0.5 rounded leading-none ${isFront ? 'bg-orange-500/30 text-orange-300 border border-orange-400' : 'bg-cyan-500/30 text-cyan-300 border border-cyan-400'}`}>
              {positionLabel}
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-sm text-gray-400">被弾:</span>
              <span className={`text-2xl font-bold leading-none ${targetRate >= 0.5 ? 'text-red-400' : 'text-gray-200'}`}>{Math.round(targetRate * 100)}%</span>
              {previewRate !== undefined && Math.round(previewRate * 100) !== Math.round(targetRate * 100) && (
                <>
                  <span className="text-gray-500 text-sm mx-0.5">→</span>
                  <span className={`text-2xl font-bold leading-none ${previewRate >= 0.5 ? 'text-red-400' : 'text-yellow-400'}`}>{Math.round(previewRate * 100)}%</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* 戦闘不能バッジ（コマンド一覧の上に小さく表示） */}
        {isDead && (
          <div className="text-center text-red-400 text-[10px] font-bold mb-0.5">戦闘不能</div>
        )}

        {/* コマンド一覧（D&Dドラッグ元。戦闘不能時・ゲームオーバー時もグレーアウトして表示、ドラッグは無効） */}
        {(isCommandPhase || isGameOver) && (
          <div className="flex-1 overflow-y-auto space-y-1 mt-0.5">
            {commands.map((cmd, cmdIdx) => {
              const isAvail = !isDead && !isGameOver && availableCommands.some(ac => ac.id === cmd.id)
              // weapons/spells 各配列内の生インデックス（武器はweapons内、魔法はspells内の位置）
              const commandIndex = cmdIdx < member.weapons.length ? cmdIdx : cmdIdx - member.weapons.length
              const killCategory = killCategoryMap?.get(killPotentialKey(member.id, cmd.id))
              return (
                <DraggableCommand
                  key={`${cmd.id}-${cmdIdx}`}
                  command={cmd}
                  explorerId={member.id}
                  commandIndex={commandIndex}
                  disabled={!isCommandPhase || isDead || isGameOver}
                  isAvailable={isAvail}
                  explorer={member}
                  relics={relics}
                  party={allParty}
                  killCategory={killCategory}
                  extraWeaponPowerBonus={weaponPowerBonusPreview}
                  pendingWeaponBuffs={weaponBuffSources}
                  comboBonus={comboBonusPreview}
                  commandSlots={previewCommandSlots}
                  commandSlotIndex={memberSlotIndex}
                />
              )
            })}
          </div>
        )}

        {/* 味方ターゲットハイライト（蘇生時は戦闘不能側を有効対象とする） */}
        {((isSelectingTarget && selectedTargetId === member.id) || draggingAllyTarget) && (reviveMode ? isDead : !isDead) && (
          <div className="absolute inset-0 ring-2 ring-lime-400 rounded pointer-events-none" />
        )}
      </div>
    </DroppableTarget>
  )
}

/** 左サイドパネル: ステージ番号 / 次の敵 / 次の次の敵 / レリック / ポーション */
function LeftPanel({
  potions,
  relics,
  isCommandPhase,
  party,
  currentStage,
  seed,
  commandSlots,
  onOpenDebug,
  draggingDiscardable,
}: {
  potions: { id: string; name: string; commandCategory: 'potion' }[]
  relics: RelicInstance[]
  isCommandPhase: boolean
  party: ExplorerState[]
  currentStage: number
  seed: number
  commandSlots: CommandSlot[]
  /** デバッグウィンドウを開く（DEV時のみ） */
  onOpenDebug: () => void
  /** 破棄可能なコマンド（武器/魔法）をドラッグ中か */
  draggingDiscardable: boolean
}) {
  const comboActive = isCommandPhase && getComboConditionBonus(commandSlots, relics) > 0
  return (
    <div className="h-full flex flex-col gap-2 overflow-y-auto">
      {/* ステージ番号（2倍）*/}
      <div className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-center">
        <div className="text-2xl font-bold text-white leading-tight">Stage {currentStage}</div>
      </div>

      {/* 次の敵 */}
      <NextStagePreview seed={seed} currentStage={currentStage} label="次の敵" />

      {/* 次の次の敵 */}
      <NextStagePreview seed={seed} currentStage={currentStage} offset={2} label="次の次の敵" />

      {/* レリック（3倍、サイドバー残り高さの約半分）*/}
      <div className="bg-gray-800/70 border border-gray-600 rounded-lg p-2 flex-[1] min-h-0 overflow-y-auto">
        <div className="text-base text-gray-400 font-bold mb-1">レリック</div>
        {relics.length === 0 ? (
          <div className="text-base text-gray-600">なし</div>
        ) : (
          <div className="space-y-0.5">
            {relics.map((relic) => (
              <Tooltip key={relic.id} content={<TooltipCard item={relic} attackImpacts={calculateRelicAttackImpacts(relic, party, relics.filter(r => r.id !== relic.id))} />} position="top">
                <div className={`text-xl truncate ${comboActive && relic.passiveEffect.type === 'comboAttackBonus' ? 'text-yellow-300' : 'text-gray-200'}`}>
                  {relic.name}
                </div>
              </Tooltip>
            ))}
          </div>
        )}
      </div>

      {/* ポーション（2倍、レリックの下。同種を複数所持していても重ならず別カードで表示） */}
      <div className="bg-gray-800/70 border border-gray-600 rounded-lg p-2">
        <div className="text-sm text-gray-400 font-bold mb-1">ポーション</div>
        {potions.length === 0 ? (
          <div className="text-base text-gray-600">なし</div>
        ) : (
          potions.map((potion, idx) => (
            <DraggableCommand
              key={`${potion.id}-${idx}`}
              command={potion as BattleCommand}
              explorerId="shared"
              commandIndex={idx}
              disabled={!isCommandPhase}
              isAvailable={true}
            />
          ))
        )}
      </div>

      {/* デバッグボタン（開発時のみ。破棄のドロップ先を兼ねる） */}
      {import.meta.env.DEV && (
        <DebugButton onClick={onOpenDebug} isDraggingItem={draggingDiscardable} />
      )}

      {/* 最下部の空白スペース（ポーションを上方に押し上げる） */}
      <div className="flex-[1]" />
    </div>
  )
}

/** ソート可能なキャラパネルラッパー */
function SortableCharacterPanel({
  member,
  isCommandPhase,
  children,
}: {
  member: ExplorerState
  orderIndex: number
  isCommandPhase: boolean
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
    disabled: !isCommandPhase,
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
  const { state, returnToTitle, endBattle, debugDiscardWeapon, debugDiscardSpell } = useGame()
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

  const { party } = run
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
  // ドラッグ外でマウスホバー中の敵ID（コマンド着色の基準敵をホバー先に切り替えるため）
  const [colorHoverEnemyId, setColorHoverEnemyId] = useState<string | null>(null)
  // 味方対象コマンドをドラッグ中にホバーしている味方メンバーID（武器強化のダメージ予測プレビュー用）
  const [hoverAllyId, setHoverAllyId] = useState<string | null>(null)
  // 行動アニメ: { explorerId, type } を保持。執行直前にセットし、進行後にクリア
  const [acting, setActing] = useState<{ explorerId: string; type: AvatarActingType } | null>(null)
  // 被弾振動: 振動中のメンバーID集合
  const [shakingIds, setShakingIds] = useState<Set<string>>(new Set())
  // レベルアップ縦伸縮中のメンバーID集合
  const [levelingUpIds, setLevelingUpIds] = useState<Set<string>>(new Set())
  // 丸アイコンドラッグ中のメンバーID（DragOverlay 用）
  const [draggingAvatarId, setDraggingAvatarId] = useState<string | null>(null)
  // 経験値ポップアップ「未到達」分の合計（メンバーID別）。到達するまで EXP バーに反映しない
  const [pendingExpByMember, setPendingExpByMember] = useState<Record<string, number>>({})
  // デバッグウィンドウ開閉（DEV時のみ使用）
  const [debugOpen, setDebugOpen] = useState(false)

  // === フェーズ自動処理 ===
  // レベルアップ演出はフローティングポップアップとして並走するため、フェーズ進行は止めない

  useEffect(() => {
    if (phase !== 'partyAction') return
    const timers: ReturnType<typeof setTimeout>[] = []
    // 行動者のアニメ種別を判定（攻撃 or 味方対象）
    const slot = commandSlots[battleState.currentCommandIndex]
    if (slot?.command && slot.explorerId) {
      const isEnemyTarget = slot.command.targetType === 'enemySingle' || slot.command.targetType === 'enemyAll' || slot.command.targetType === 'enemyRandom'
      setActing({ explorerId: slot.explorerId, type: isEnemyTarget ? 'attack' : 'heal' })
    }
    const t1 = setTimeout(() => {
      executePartyAction()
      const t2 = setTimeout(() => {
        advancePartyAction()
        setActing(null)
      }, ACTION_DELAY_MS / 2)
      timers.push(t2)
    }, ACTION_DELAY_MS)
    timers.push(t1)
    return () => timers.forEach(t => clearTimeout(t))
  }, [phase, battleState.currentCommandIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'enemyAction') return
    const aliveEnemies = enemies.filter(e => e.currentHp > 0 && !e.justSummoned)
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
    if (battleState.isGameOver) return
    const result = checkBattleResult(enemies, party)
    if (result === 'ongoing') return
    // HPバーアニメーション(300ms) + 余韻(500ms) を待ってから遷移
    // レベルアップ演出が出ているときは追加で1秒延長して余韻を確保
    const delay = levelUpPopups.length > 0 ? 1800 : 800
    const timer = setTimeout(() => endBattle(result), delay)
    return () => clearTimeout(timer)
  }, [enemies, party, endBattle, battleState.isGameOver, levelUpPopups.length])

  // 経験値ポップアップ追加検知: 新しい popup の amount を pendingExpByMember に積む
  // （popup がメンバーに到達するまで EXP バーに反映させない）
  const prevExpPopupIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const newPopups = expPopups.filter(p => !prevExpPopupIdsRef.current.has(p.id))
    prevExpPopupIdsRef.current = new Set(expPopups.map(p => p.id))
    if (newPopups.length === 0) return
    setPendingExpByMember(prev => {
      const next = { ...prev }
      for (const p of newPopups) {
        next[p.targetExplorerId] = (next[p.targetExplorerId] ?? 0) + p.amount
      }
      return next
    })
  }, [expPopups])

  // 経験値ポップアップ完了ハンドラ: メンバーに到達したタイミングで pending を減らし、EXPバーが伸びる
  const handleExpPopupComplete = useCallback((popup: ExpPopup) => {
    setPendingExpByMember(prev => {
      const cur = prev[popup.targetExplorerId] ?? 0
      const remaining = Math.max(0, cur - popup.amount)
      const next = { ...prev }
      if (remaining === 0) delete next[popup.targetExplorerId]
      else next[popup.targetExplorerId] = remaining
      return next
    })
    removeExpPopup(popup.id)
  }, [removeExpPopup])

  // レベルアップ縦伸縮: 新しい levelUpPopup が追加されたタイミングで対象カードをストレッチ
  const prevLevelUpPopupIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const newPopups = levelUpPopups.filter(p => !prevLevelUpPopupIdsRef.current.has(p.id))
    prevLevelUpPopupIdsRef.current = new Set(levelUpPopups.map(p => p.id))
    if (newPopups.length === 0) return
    const targetIds = newPopups.map(p => p.levelUpInfo.explorerId)
    setLevelingUpIds(prev => {
      const next = new Set(prev)
      targetIds.forEach(id => next.add(id))
      return next
    })
    // 1500ms（CSS animation の duration = 2ニョキ分と同期）後に解除
    const timer = setTimeout(() => {
      setLevelingUpIds(prev => {
        const next = new Set(prev)
        targetIds.forEach(id => next.delete(id))
        return next
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [levelUpPopups])

  // 被弾振動: 新しい playerDamagePopup が追加されたタイミングで対象メンバーを振動
  const prevDamagePopupIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const newPopups = playerDamagePopups.filter(p => !prevDamagePopupIdsRef.current.has(p.id))
    prevDamagePopupIdsRef.current = new Set(playerDamagePopups.map(p => p.id))
    if (newPopups.length === 0) return
    const targetIds = newPopups
      .map(p => p.targetExplorerId)
      .filter((id): id is string => !!id)
    if (targetIds.length === 0) return
    setShakingIds(prev => {
      const next = new Set(prev)
      targetIds.forEach(id => next.add(id))
      return next
    })
    const timer = setTimeout(() => {
      setShakingIds(prev => {
        const next = new Set(prev)
        targetIds.forEach(id => next.delete(id))
        return next
      })
    }, 450)
    return () => clearTimeout(timer)
  }, [playerDamagePopups])

  const isCommandPhase = phase === 'command'
  // ドラッグ中はクリックベースのターゲット選択を無効化（D&Dで処理するため）
  const isSelectingTarget = selectedCommand !== null && isCommandPhase && !draggingCommand
  const targetRates = calculateTargetRates(party, run.relics)
  const aliveEnemyCount = enemies.filter(e => e.currentHp > 0).length

  // 祈りコマンドによる被弾率プレビュー
  const previewParty = party.map(member => {
    const prayerSlot = commandSlots.find(s =>
      s.targetId === member.id && s.command &&
      isSpell(s.command) && s.command.effect?.type === 'targetRateUp'
    )
    if (!prayerSlot?.command) return member
    if (member.battleBuffs.some(b => b.type === 'targetRateUp')) return member
    const effect = (prayerSlot.command as { effect: { value: number } }).effect
    return {
      ...member,
      battleBuffs: [...member.battleBuffs, { type: 'targetRateUp' as const, value: effect.value, duration: 1 as const }],
    }
  })
  const previewTargetRates = calculateTargetRates(previewParty, run.relics)

  // === D&D ハンドラ ===
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id as string

    // パネル並び替え（メンバーパネル または 丸アイコン）
    if (activeId.startsWith('panel-') || activeId.startsWith('avatar-')) {
      setDraggingPanel(true)
      if (activeId.startsWith('avatar-')) {
        setDraggingAvatarId(activeId.replace('avatar-', ''))
      }
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
      setHoverAllyId(null)
      const slotIndex = commandSlots.findIndex(s => s.explorerId === explorerId)
      if (slotIndex >= 0) changeActiveExplorer(slotIndex)
    }
  }, [commandSlots, changeActiveExplorer])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined
    if (overId?.startsWith('enemy-')) {
      setHoverEnemyId(overId.replace('enemy-', ''))
      setHoverAllyId(null)
    } else if (overId?.startsWith('ally-avatar-')) {
      setHoverEnemyId(null)
      setHoverAllyId(overId.replace('ally-avatar-', ''))
    } else if (overId?.startsWith('ally-')) {
      setHoverEnemyId(null)
      setHoverAllyId(overId.replace('ally-', ''))
    } else {
      setHoverEnemyId(null)
      setHoverAllyId(null)
    }
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingCommand(null)
    setDraggingExplorerId(null)
    setDraggingPanel(false)
    setDraggingAvatarId(null)
    setHoverEnemyId(null)
    setHoverAllyId(null)

    if (!event.over || !isCommandPhase) {
      cancelCommand()
      return
    }

    const activeId = event.active.id as string
    const overId = event.over.id as string

    // パネル並び替え（メンバーパネル または 丸アイコン）
    if (activeId.startsWith('panel-') || activeId.startsWith('avatar-')) {
      // ドロップ先IDから対象メンバーIDを抽出（avatar- > ally-avatar- > panel- > ally- の順で判定）
      let targetMemberId: string | null = null
      if (overId.startsWith('avatar-')) {
        targetMemberId = overId.replace('avatar-', '')
      } else if (overId.startsWith('ally-avatar-')) {
        targetMemberId = overId.replace('ally-avatar-', '')
      } else if (overId.startsWith('panel-')) {
        targetMemberId = overId.replace('panel-', '')
      } else if (overId.startsWith('ally-')) {
        targetMemberId = overId.replace('ally-', '')
      }
      if (targetMemberId) {
        const fromExplorerId = activeId.startsWith('panel-')
          ? activeId.replace('panel-', '')
          : activeId.replace('avatar-', '')
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

    const { command, explorerId: rawExplorerId, weaponIndex, commandIndex } = data as { command: BattleCommand; explorerId: string; weaponIndex?: number; commandIndex?: number }

    // デバッグ: 左下デバッグボタンへのドロップで武器/魔法を即時破棄（DEV時のみ）
    if (overId === 'debug-discard') {
      if (import.meta.env.DEV && commandIndex !== undefined && rawExplorerId !== 'shared') {
        const memberIndex = party.findIndex(m => m.id === rawExplorerId)
        if (memberIndex >= 0) {
          if (isWeapon(command)) debugDiscardWeapon(memberIndex, commandIndex)
          else if (isSpell(command)) debugDiscardSpell(memberIndex, commandIndex)
        }
      }
      return
    }
    // ポーションは explorerId="shared" で来るので、アクティブエクスプローラーのIDに差し替え
    const explorerId = rawExplorerId === 'shared'
      ? commandSlots[battleState.activeExplorerIndex]?.explorerId ?? rawExplorerId
      : rawExplorerId

    const isEnemyTarget = command.targetType === 'enemySingle' || command.targetType === 'enemyAll' || command.targetType === 'enemyRandom'
    const isAllyTargetCmd = command.targetType === 'allySingle' || command.targetType === 'allyAll'

    let targetId: string | null = null
    if (overId.startsWith('enemy-') && isEnemyTarget) {
      targetId = overId.replace('enemy-', '')
    } else if (overId.startsWith('ally-avatar-') && isAllyTargetCmd) {
      targetId = overId.replace('ally-avatar-', '')
    } else if (overId.startsWith('ally-') && isAllyTargetCmd) {
      targetId = overId.replace('ally-', '')
    }

    // allySingleの妥当性チェック: 蘇生は戦闘不能のみ、それ以外は生存者のみ対象
    if (targetId && command.targetType === 'allySingle') {
      const member = party.find(m => m.id === targetId)
      if (member) {
        const valid = targetsDownedAlly(command) ? member.hp <= 0 : member.hp > 0
        if (!valid) {
          cancelCommand()
          return
        }
      }
    }

    if (targetId) {
      // ポーションは即時発動（行動消費なし）
      if (command.commandCategory === 'potion') {
        usePotionInstant(command.id, targetId)
      } else {
        setCommandSlotDirect(explorerId, command, targetId, weaponIndex)
      }
    }
  }, [isCommandPhase, party, setCommandSlotDirect, usePotionInstant, reorderParty, cancelCommand, commandSlots, battleState.activeExplorerIndex, debugDiscardWeapon, debugDiscardSpell])

  // コマンドD&DではpointerWithin、パネルソートではpanel-/ally-のみ対象のclosestCenter
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    if (draggingCommand) {
      return pointerWithin(args)
    }
    if (draggingPanel) {
      // パネル/丸アイコンドラッグ中は並び替え用 ID のみ衝突対象
      const filtered = {
        ...args,
        droppableContainers: args.droppableContainers.filter(c => {
          const id = String(c.id)
          return (
            id.startsWith('panel-') ||
            id.startsWith('avatar-') ||
            id.startsWith('ally-')
          )
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
    setDraggingAvatarId(null)
    setHoverEnemyId(null)
    setHoverAllyId(null)
  }, [cancelCommand, draggingCommand])

  // ドラッグ中の武器強化魔法を、ホバー中の味方へ仮セットしたコマンドスロット。
  // ドロップ前でも武器強化のダメージ予測を反映するために使う（ホバーを外すと元に戻る）。
  // ドラッグ中の味方対象コマンド（武器強化・ヒール等）を、ホバー中の味方へ仮セットしたコマンドスロット。
  // ドロップ前でも予測（武器強化ダメージ / 回復量）を反映するために使う（ホバーを外すと元に戻る）。
  // ポーションは explorerId="shared" でスロットに乗らないため findIndex で自然に除外される。
  const previewCommandSlots = useMemo(() => {
    if (!draggingCommand || !draggingExplorerId || !hoverAllyId) return commandSlots
    const isAllyTargeting = draggingCommand.targetType === 'allySingle' || draggingCommand.targetType === 'allyAll'
    if (!isAllyTargeting) return commandSlots
    const idx = commandSlots.findIndex(s => s.explorerId === draggingExplorerId)
    if (idx < 0) return commandSlots
    const next = [...commandSlots]
    next[idx] = { explorerId: draggingExplorerId, command: draggingCommand, targetId: hoverAllyId }
    return next
  }, [commandSlots, draggingCommand, draggingExplorerId, hoverAllyId])

  // 回復ポーションの効果倍率（レリック補正）。回復プレビュー量の算出に使う
  const potionEffectMultiplier = getPotionEffectMultiplier(run.relics)

  // コマンド立案支援: 各コマンドの撃破確定カテゴリ（solo/combo/none/nonAttack）を算出。
  // 土台に previewCommandSlots を使うことで、武器強化などのバフ確定/ドラッグ中ホバーが即座に反映される。
  // 基準敵はドラッグ中のホバー敵 > 通常ホバー敵 > 最小HPの敵 の優先で決まる。
  // 依存は「解決済みの基準敵ID」にすることで、最小HP敵と同一の敵をホバーした場合など基準が
  // 変わらないマウス移動では再計算をスキップする（敵をなぞる操作での無駄な再計算を抑制）。
  const referenceEnemyId = getReferenceEnemy(enemies, hoverEnemyId ?? colorHoverEnemyId)?.instanceId ?? null
  const killCategoryMap = useMemo<Map<string, KillCategory>>(() => {
    if (!isCommandPhase) return new Map()
    const options = { relics: run.relics, includeConditionalRelics: true, brokenWeaponCount: run.brokenWeaponCount ?? 0, totalBrokenWeaponCount: run.totalBrokenWeaponCount ?? 0 }
    return classifyCommandsKillPotential(party, enemies, previewCommandSlots, referenceEnemyId, options)
  }, [isCommandPhase, party, enemies, previewCommandSlots, referenceEnemyId, run.relics, run.brokenWeaponCount, run.totalBrokenWeaponCount])

  // パネルソート用のID配列
  const panelIds = party.map(m => `panel-${m.id}`)

  return (
    <DndContext onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} collisionDetection={customCollisionDetection}>
      <div className="min-h-screen bg-gray-800 p-2 flex gap-2">

        {/* ===== 左サイドパネル ===== */}
        <div className="w-1/4 flex-shrink-0 flex flex-col">
          <LeftPanel
            potions={potions}
            relics={run.relics}
            isCommandPhase={isCommandPhase}
            party={party}
            currentStage={run.currentStage}
            seed={run.seed}
            commandSlots={commandSlots}
            onOpenDebug={() => setDebugOpen(true)}
            draggingDiscardable={draggingCommand !== null && !isPotion(draggingCommand)}
          />
        </div>

        {/* ===== 右側メイン領域 ===== */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">

        {/* ===== 敵エリア ===== */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg relative min-h-[140px] flex flex-col">
          <div className="flex justify-end items-center mb-2">
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

          {visibleMessage && (
            <div className={`absolute top-8 left-1/2 -translate-x-1/2 z-10 bg-gray-800 border border-gray-500 px-4 py-1 rounded text-white text-xs font-bold shadow-lg transition-opacity duration-300 ${messageVisible ? 'opacity-100' : 'opacity-0'}`}>
              {visibleMessage}
            </div>
          )}

          <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 flex flex-wrap justify-center items-center content-center gap-3">
            {enemies.map((enemy) => {
              const isAllyTarget = selectedCommand?.targetType === 'allySingle' || selectedCommand?.targetType === 'allyAll' || draggingCommand?.targetType === 'allySingle' || draggingCommand?.targetType === 'allyAll'
              const { isSelected, isHighlighted } = isSelectingTarget && selectedCommand && !isAllyTarget
                ? getTargetSelectionState(enemy, selectedTargetId, selectedCommand.targetType)
                : { isSelected: false, isHighlighted: false }

              // ドラッグ中: 攻撃対象になりうる敵全体を強調
              const isDraggingAttack = draggingCommand !== null && !isAllyTarget && enemy.currentHp > 0
              // ホバー中の個別強調: 直接ホバーされている or 全体攻撃時は全敵
              const isEnemyAll = draggingCommand?.targetType === 'enemyAll' || draggingCommand?.targetType === 'enemyRandom'
              const isHoveredEnemy = isDraggingAttack && (
                hoverEnemyId === enemy.instanceId || (isEnemyAll && hoverEnemyId !== null)
              )

              // キルラインバー: ホバー中なら仮想コマンドを含めてプレビュー計算
              const previewOptions = { relics: run.relics, includeConditionalRelics: true, brokenWeaponCount: run.brokenWeaponCount ?? 0, totalBrokenWeaponCount: run.totalBrokenWeaponCount ?? 0 }
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
                ? calculateDetailedDamagePreview(commandSlots, enemy.instanceId, party, previewOptions, tentative, aliveEnemyCount, enemy.battleBuffs.some(b => b.type === 'shield'), enemy.currentHp, enemy.hp)
                : null

              return (
                <div key={enemy.instanceId} id={`enemy-dom-${enemy.instanceId}`}
                  onMouseEnter={() => enemy.currentHp > 0 && setColorHoverEnemyId(enemy.instanceId)}
                  onMouseLeave={() => setColorHoverEnemyId(prev => (prev === enemy.instanceId ? null : prev))}
                >
                  <DroppableTarget id={`enemy-${enemy.instanceId}`} disabled={!isCommandPhase || enemy.currentHp <= 0 || draggingCommand?.targetType === 'allySingle' || draggingCommand?.targetType === 'allyAll' || draggingPanel}>
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

          <PartyAvatars
            party={party}
            isCommandPhase={isCommandPhase}
            draggingAllyTarget={draggingCommand?.targetType === 'allySingle' || draggingCommand?.targetType === 'allyAll'}
            draggingPanel={draggingPanel}
            reviveMode={Boolean((draggingCommand && targetsDownedAlly(draggingCommand)) || (isSelectingTarget && selectedCommand && targetsDownedAlly(selectedCommand)))}
            acting={acting}
            selectedTargetId={selectedTargetId}
            isSelectingAlly={isSelectingTarget && (selectedCommand?.targetType === 'allySingle' || selectedCommand?.targetType === 'allyAll')}
            onAllyClick={(memberId) => {
              if (isSelectingTarget && (selectedCommand?.targetType === 'allySingle' || selectedCommand?.targetType === 'allyAll')) {
                if (selectedCommand.targetType === 'allySingle') {
                  const m = party.find(p => p.id === memberId)
                  const valid = m && (targetsDownedAlly(selectedCommand) ? m.hp <= 0 : m.hp > 0)
                  if (!valid) return
                }
                selectTarget(memberId)
                setTimeout(() => executeCommand(), 0)
              }
            }}
          />
          </div>

          {damagePopups.map((popup) => {
            const targetIndex = enemies.findIndex(e => e.instanceId === popup.targetId)
            if (targetIndex === -1) return null
            return <DamagePopup key={popup.id} damage={popup.damage} targetIndex={targetIndex} totalTargets={enemies.length} onComplete={() => removePopup(popup.id)} contributors={popup.contributors} shielded={popup.shielded} delayMs={popup.delayMs} fadeAfterMs={popup.fadeAfterMs} fadeDurationMs={popup.fadeDurationMs} hitIndex={popup.hitIndex} />
          })}
        </div>

        {/* ===== キャラ欄3等分（3キャラ）D&Dソート可能 ===== */}
        <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0">
          <SortableContext items={panelIds} strategy={horizontalListSortingStrategy}>
            {party.map((member, index) => {
              const memberAvailCmds = getAvailableCommands(member, potions)
              const rate = targetRates.find(r => r.explorerId === member.id)?.rate
              const prevRate = previewTargetRates.find(r => r.explorerId === member.id)?.rate
              const slot = commandSlots.find(s => s.explorerId === member.id) ?? null
              // このキャラがこのターン先に受け取る武器強化の合計（武器チップ予測へ反映）
              // ドラッグ中の武器強化魔法をホバー中の味方へ仮反映した previewCommandSlots を使う
              const memberSlotIndex = previewCommandSlots.findIndex(s => s.explorerId === member.id)
              const weaponPowerBonusPreview = memberSlotIndex >= 0
                ? pendingWeaponPowerBonus(previewCommandSlots, member.id, memberSlotIndex)
                : 0
              // 武器強化魔法の内訳（呪文名つき。バフポップアップ表示用）
              const weaponBuffSources = memberSlotIndex >= 0
                ? pendingWeaponPowerBuffSources(previewCommandSlots, member.id, memberSlotIndex)
                : []
              // 連携の紋章: このキャラが攻撃をセットしたと仮定した場合のSTR/INTボーナス（コマンドチップ予測へ反映）
              const comboBonusPreview = isCommandPhase
                ? getComboBonusAssumingAttacker(previewCommandSlots, run.relics, member.id)
                : 0
              // 回復プレビュー: バーを点滅で伸ばす予測量を算出（コマンドフェーズのみ）
              let hpPreviewAdd = 0
              let mpPreviewAdd = 0
              if (isCommandPhase) {
                // ヒール魔法・蘇生はスロット由来で集計。previewCommandSlots はドラッグ中ホバーを仮反映済みなので、
                // 「ドロップ前のホバー中」も「ドロップ後〜ターン実行開始まで」も同じ計算でプレビューされる
                let rawHeal = getPendingHealForMember(previewCommandSlots, member)
                // ポーションはスロットに乗らず即時発動のため、ドラッグ中ホバー時のみ直接加算
                if (draggingCommand && hoverAllyId && isPotion(draggingCommand) && member.id === hoverAllyId) {
                  rawHeal += getPotionHpRestoreAmount(draggingCommand, member, potionEffectMultiplier)
                  mpPreviewAdd = getMpRestorePreviewAmount(draggingCommand, member, potionEffectMultiplier)
                }
                // 合算が最大HPを超えないようクランプ
                hpPreviewAdd = Math.max(0, Math.min(rawHeal, member.maxHp - member.hp))
              }
              return (
                <SortableCharacterPanel
                  key={member.id}
                  member={member}
                  orderIndex={index}
                  isCommandPhase={isCommandPhase}
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
                      draggingAllyTarget={draggingCommand?.targetType === 'allySingle' || draggingCommand?.targetType === 'allyAll'}
                      draggingEnemyTarget={draggingCommand !== null && (draggingCommand.targetType === 'enemySingle' || draggingCommand.targetType === 'enemyAll' || draggingCommand.targetType === 'enemyRandom')}
                      reviveMode={Boolean((draggingCommand && targetsDownedAlly(draggingCommand)) || (isSelectingTarget && selectedCommand && targetsDownedAlly(selectedCommand)))}
                      onAllyClick={() => {
                        if (isSelectingTarget && (selectedCommand?.targetType === 'allySingle' || selectedCommand?.targetType === 'allyAll')) {
                          if (selectedCommand.targetType === 'allySingle') {
                            const valid = targetsDownedAlly(selectedCommand) ? member.hp <= 0 : member.hp > 0
                            if (!valid) return
                          }
                          selectTarget(member.id)
                          setTimeout(() => executeCommand(), 0)
                        }
                      }}
                      commandSlot={slot}
                      allEnemies={enemies}
                      allParty={party}
                      draggingPanel={draggingPanel}
                      orderIndex={index}
                      relics={run.relics}
                      killCategoryMap={killCategoryMap}
                      weaponPowerBonusPreview={weaponPowerBonusPreview}
                      weaponBuffSources={weaponBuffSources}
                      comboBonusPreview={comboBonusPreview}
                      previewCommandSlots={previewCommandSlots}
                      memberSlotIndex={memberSlotIndex}
                      hpPreviewAdd={hpPreviewAdd}
                      mpPreviewAdd={mpPreviewAdd}
                      dragHandleProps={dragHandleProps}
                      acting={acting?.explorerId === member.id ? acting.type : null}
                      shaking={shakingIds.has(member.id)}
                      levelingUp={levelingUpIds.has(member.id)}
                      displayedExp={Math.max(0, member.exp - (pendingExpByMember[member.id] ?? 0))}
                    />
                  )}
                </SortableCharacterPanel>
              )
            })}
          </SortableContext>
        </div>

        {/* ===== 実行ボタン（最下段） ===== */}
        {isCommandPhase && (
          <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
            <Button variant="primary" onClick={startExecution} disabled={!allSlotsSet} className="w-full text-sm">
              {allSlotsSet ? '実行' : 'コマンドを選択してください'}
            </Button>
          </div>
        )}

        </div>{/* 右側メイン領域 終わり */}

        {playerDamagePopups.map((popup) => (
          <PlayerDamagePopupEffect key={popup.id} popup={popup} onComplete={() => removePlayerPopup(popup.id)} />
        ))}

        {isSelectingTarget && selectedCommand && !draggingCommand && (
          <TargetSelector enemies={enemies} selectedTargetId={selectedTargetId} targetType={selectedCommand.targetType}
            columns={2} party={party} command={selectedCommand} onSelectTarget={selectTarget} onConfirm={executeCommand} onCancel={cancelCommand} />
        )}

        {!expAnimating && levelUpPopups.map(popup => (
          <LevelUpPopupEffect
            key={popup.id}
            levelUpInfo={popup.levelUpInfo}
            onComplete={() => removeLevelUpPopup(popup.id)}
          />
        ))}

        <DragOverlay>
          {draggingCommand && (
            <div className="bg-gray-800 border border-yellow-400 rounded px-3 py-1 text-sm text-white shadow-lg">
              {draggingCommand.name}
            </div>
          )}
          {draggingAvatarId && (() => {
            const m = party.find(p => p.id === draggingAvatarId)
            return m ? <AvatarVisual member={m} party={party} scale={0.7} /> : null
          })()}
          {draggingPanel && !draggingAvatarId && (
            <div className="bg-gray-700 border border-yellow-400 rounded px-4 py-2 text-xs text-white shadow-lg">
              ≡ 移動中
            </div>
          )}
        </DragOverlay>

        {/* 経験値獲得エフェクト（敵位置→メンバーの経験値バーへ飛ぶ） */}
        {expPopups.map(popup => (
          <ExpPopupEffect key={popup.id} popup={popup} onComplete={() => handleExpPopupComplete(popup)} />
        ))}

        {/* デバッグウィンドウ（開発時のみ） */}
        {import.meta.env.DEV && debugOpen && <DebugWindow onClose={() => setDebugOpen(false)} />}

        {battleState.isGameOver && <GameOverOverlay onReturnTitle={returnToTitle} />}
      </div>
    </DndContext>
  )
}
