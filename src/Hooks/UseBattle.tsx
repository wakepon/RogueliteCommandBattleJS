import { useCallback } from 'react'
import { useGame } from './UseGame'
import { PotionInstance } from '../Lib/Types/Potion'
import { BattleAction } from '../Lib/State/BattleReducer'
import { getAvailableCommands, selectEnemyAction, processPartyTurnEnd, calculateTargetRates, selectTargetByRate } from '../Lib/Core'
import { generateEnemyIntents } from '../Lib/State/BattleStateFactory'
import { BattleState, BattleCommand, BattlePhase, CommandSlot, PlayerDamagePopup, LevelUpPopup, DamagePopup } from '../Lib/Types/Battle'
import { ExplorerState } from '../Lib/Types/Explorer'
import { EnemyInstance } from '../Lib/Types/Enemy'

/** useBattle Hookの戻り値の型 */
export interface UseBattleResult {
  // バトル状態
  battleState: BattleState
  phase: BattlePhase
  party: ExplorerState[]
  gold: number
  enemies: EnemyInstance[]
  turn: number
  turnLimit: number

  // コマンド選択フェーズ
  activeExplorer: ExplorerState       // 現在コマンド選択中のキャラ
  commandSlots: CommandSlot[]
  allSlotsSet: boolean                // 全スロットにコマンドがセットされたか
  availableCommands: BattleCommand[]
  selectedCommand: BattleCommand | null
  selectedTargetId: string | null

  // パーティー行動フェーズ
  currentCommandIndex: number
  isPlayerTurn: boolean               // 後方互換: パーティーのターンか（command or partyAction）

  // ポップアップ
  damagePopups: DamagePopup[]
  playerDamagePopups: PlayerDamagePopup[]
  levelUpPopups: LevelUpPopup[]
  potions: PotionInstance[]

  // コマンド選択アクション
  selectCommand: (command: BattleCommand) => void
  cancelCommand: () => void
  selectTarget: (targetId: string) => void
  changeActiveExplorer: (index: number) => void
  startExecution: () => void

  // 実行アクション
  executePartyAction: () => void       // 現在のコマンドスロットを実行
  advancePartyAction: () => void
  enemyAction: (enemyIndex: number) => void
  advanceEnemyAction: () => void
  processTurnEnd: () => void
  startNewTurn: () => void

  // ポップアップアクション
  removePopup: (popupId: string) => void
  removePlayerPopup: (popupId: string) => void
  removeLevelUpPopup: (popupId: string) => void

  // 後方互換
  explorer: ExplorerState
  executeCommand: () => void
  nextActor: () => void
}

/**
 * 戦闘画面用のカスタムHook
 */
export function useBattle(): UseBattleResult | null {
  const { state, dispatch } = useGame()
  const { run, battleState } = state

  const dispatchBattle = useCallback((action: BattleAction) => {
    dispatch({ type: 'BATTLE_ACTION', action })
  }, [dispatch])

  // コマンド選択
  const selectCommand = useCallback((command: BattleCommand) => {
    dispatchBattle({ type: 'SELECT_COMMAND', command })
  }, [dispatchBattle])

  const cancelCommand = useCallback(() => {
    dispatchBattle({ type: 'CANCEL_COMMAND' })
  }, [dispatchBattle])

  const selectTarget = useCallback((targetId: string) => {
    dispatchBattle({ type: 'SELECT_TARGET', targetId })
  }, [dispatchBattle])

  const changeActiveExplorer = useCallback((index: number) => {
    dispatchBattle({ type: 'CHANGE_ACTIVE_EXPLORER', index })
  }, [dispatchBattle])

  const startExecution = useCallback(() => {
    dispatchBattle({ type: 'START_EXECUTION' })
  }, [dispatchBattle])

  // パーティー行動（戦闘不能キャラはスキップ）
  const executePartyAction = useCallback(() => {
    if (!battleState || !run) return
    const slot = battleState.commandSlots[battleState.currentCommandIndex]
    if (!slot?.command) return
    const explorer = run.party.find(e => e.id === slot.explorerId)
    if (!explorer || explorer.hp <= 0) return  // 戦闘不能チェック
    dispatchBattle({ type: 'EXECUTE_COMMAND', explorer })
  }, [battleState, run, dispatchBattle])

  const advancePartyAction = useCallback(() => {
    dispatchBattle({ type: 'ADVANCE_PARTY_ACTION' })
  }, [dispatchBattle])

  // 敵行動
  const enemyAction = useCallback((enemyIndex: number) => {
    if (!battleState || !run) return
    const aliveEnemies = battleState.enemies.filter(e => e.currentHp > 0)
    const enemy = aliveEnemies[enemyIndex]
    if (!enemy) return

    // 前衛/後衛の被ターゲット率に基づいてターゲット選択
    const targetRates = calculateTargetRates(run.party)
    const targetId = selectTargetByRate(targetRates)
    if (!targetId) return
    const targetMember = run.party.find(m => m.id === targetId)
    if (!targetMember) return

    const actionResult = selectEnemyAction(enemy, targetMember)

    dispatchBattle({
      type: 'ENEMY_ACTION',
      enemyId: enemy.instanceId,
      targetExplorerId: targetMember.id,
      damage: actionResult.damage,
      explorer: targetMember,
      actionName: actionResult.actionName,
      poisonStacks: actionResult.poisonStacks,
      mpDrain: actionResult.mpDrain,
      applyCharge: actionResult.applyCharge,
      consumeCharge: actionResult.consumeCharge,
      hits: actionResult.hits,
    })
  }, [battleState, run, dispatchBattle])

  const advanceEnemyAction = useCallback(() => {
    dispatchBattle({ type: 'ADVANCE_ENEMY_ACTION' })
  }, [dispatchBattle])

  // ターン終了（全パーティーメンバーの毒/バフ処理）
  const processTurnEnd = useCallback(() => {
    if (!run) return
    const { updatedParty, totalPoisonDamage } = processPartyTurnEnd(run.party)
    dispatchBattle({
      type: 'PROCESS_TURN_END',
      totalPoisonDamage,
      updatedParty,
    })
  }, [run, dispatchBattle])

  const startNewTurn = useCallback(() => {
    if (!run || !battleState) return
    // 生存メンバーのコマンドスロットを生成
    const newSlots: CommandSlot[] = run.party
      .filter(m => m.hp > 0)
      .map(m => ({ explorerId: m.id, command: null, targetId: null }))
    // 敵行動予告を再生成
    const newIntents = generateEnemyIntents(battleState.enemies, run.party)
    dispatchBattle({ type: 'START_NEW_TURN', commandSlots: newSlots, enemyIntents: newIntents })
  }, [run, battleState, dispatchBattle])

  // ポップアップ
  const removePopup = useCallback((popupId: string) => {
    dispatchBattle({ type: 'REMOVE_POPUP', popupId })
  }, [dispatchBattle])

  const removePlayerPopup = useCallback((popupId: string) => {
    dispatchBattle({ type: 'REMOVE_PLAYER_POPUP', popupId })
  }, [dispatchBattle])

  const removeLevelUpPopup = useCallback((popupId: string) => {
    dispatchBattle({ type: 'REMOVE_LEVEL_UP_POPUP', popupId })
  }, [dispatchBattle])

  if (!battleState || !run) return null

  const party = run.party
  const gold = run.gold
  const potions = run.potions

  // 現在コマンド選択中のキャラ
  const activeSlot = battleState.commandSlots[battleState.activeExplorerIndex]
  const activeExplorer = activeSlot
    ? party.find(e => e.id === activeSlot.explorerId) ?? party[0]
    : party[0]

  // 使用可能なコマンド一覧（アクティブキャラ基準）
  const availableCommands = getAvailableCommands(activeExplorer, gold, potions)

  // 全スロットにコマンドがセットされたか
  const allSlotsSet = battleState.commandSlots.every(slot => slot.command !== null)

  // 後方互換
  const isPlayerTurn = battleState.phase === 'command' || battleState.phase === 'partyAction'

  // 後方互換: executeCommand
  const executeCommand = () => {
    dispatchBattle({ type: 'SET_COMMAND_SLOT' })
  }

  return {
    battleState,
    phase: battleState.phase,
    party,
    gold,
    enemies: battleState.enemies,
    turn: battleState.turn,
    turnLimit: battleState.turnLimit,

    activeExplorer,
    commandSlots: battleState.commandSlots,
    allSlotsSet,
    availableCommands,
    selectedCommand: battleState.selectedCommand,
    selectedTargetId: battleState.selectedTargetId,

    currentCommandIndex: battleState.currentCommandIndex,
    isPlayerTurn,

    damagePopups: battleState.damagePopups,
    playerDamagePopups: battleState.playerDamagePopups,
    levelUpPopups: battleState.levelUpPopups,
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

    // 後方互換
    explorer: activeExplorer,
    executeCommand,
    nextActor: advancePartyAction,
  }
}
