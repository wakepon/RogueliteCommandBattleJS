import { useCallback } from 'react'
import { useGame } from './UseGame'
import { ExplorerWeapon } from '../Lib/Types/Weapon'
import { SpellInstance } from '../Lib/Types/Spell'
import { BattleAction } from '../Lib/State/BattleReducer'
import { getAvailableCommands, calculateEnemyDamage, processTurnEnd as processTurnEndLogic } from '../Lib/Core'
import { BattleState, PlayerDamagePopup } from '../Lib/Types/Battle'
import { ExplorerState } from '../Lib/Types/Explorer'
import { EnemyInstance } from '../Lib/Types/Enemy'
import { ActorId, DamagePopup } from '../Lib/Types/Battle'

/** useBattle Hookの戻り値の型 */
export interface UseBattleResult {
  // バトル状態
  battleState: BattleState
  explorer: ExplorerState
  gold: number
  enemies: EnemyInstance[]
  turn: number
  turnLimit: number

  // アクター情報
  currentActor: ActorId
  isPlayerTurn: boolean

  // コマンド選択状態
  availableCommands: (ExplorerWeapon | SpellInstance)[]
  selectedCommand: ExplorerWeapon | SpellInstance | null
  selectedTargetId: string | null
  damagePopups: DamagePopup[]
  playerDamagePopups: PlayerDamagePopup[]

  // アクション
  selectCommand: (command: ExplorerWeapon | SpellInstance) => void
  cancelCommand: () => void
  selectTarget: (targetId: string) => void
  executeCommand: () => void
  nextActor: () => void
  removePopup: (popupId: string) => void
  enemyAction: (enemyId: string) => void
  removePlayerPopup: (popupId: string) => void
  processTurnEnd: () => void
}

/**
 * 戦闘画面用のカスタムHook
 *
 * バトル状態がない場合はnullを返す
 */
export function useBattle(): UseBattleResult | null {
  const { state, dispatch } = useGame()
  const { run, battleState } = state

  // バトルアクションをディスパッチ（useCallbackでメモ化）
  const dispatchBattle = useCallback((action: BattleAction) => {
    dispatch({ type: 'BATTLE_ACTION', action })
  }, [dispatch])

  // コマンド選択
  const selectCommand = useCallback((command: ExplorerWeapon | SpellInstance) => {
    dispatchBattle({ type: 'SELECT_COMMAND', command })
  }, [dispatchBattle])

  // コマンドキャンセル
  const cancelCommand = useCallback(() => {
    dispatchBattle({ type: 'CANCEL_COMMAND' })
  }, [dispatchBattle])

  // ターゲット選択
  const selectTarget = useCallback((targetId: string) => {
    dispatchBattle({ type: 'SELECT_TARGET', targetId })
  }, [dispatchBattle])

  // 次のアクターへ
  const nextActor = useCallback(() => {
    dispatchBattle({ type: 'NEXT_ACTOR' })
  }, [dispatchBattle])

  // ポップアップ削除
  const removePopup = useCallback((popupId: string) => {
    dispatchBattle({ type: 'REMOVE_POPUP', popupId })
  }, [dispatchBattle])

  // 敵の攻撃を実行
  const enemyAction = useCallback((enemyId: string) => {
    if (!battleState || !run) return

    const enemy = battleState.enemies.find(e => e.instanceId === enemyId)
    if (!enemy) return

    const damage = calculateEnemyDamage(enemy)
    const currentExplorer = run.party[0]

    dispatchBattle({
      type: 'ENEMY_ACTION',
      enemyId,
      damage,
      explorer: currentExplorer,
    })
  }, [battleState, run, dispatchBattle])

  // プレイヤーダメージポップアップを削除
  const removePlayerPopup = useCallback((popupId: string) => {
    dispatchBattle({ type: 'REMOVE_PLAYER_POPUP', popupId })
  }, [dispatchBattle])

  // ターン終了処理
  const processTurnEnd = useCallback(() => {
    if (!run) return

    const currentExplorer = run.party[0]
    const { updatedExplorer, poisonDamage } = processTurnEndLogic(currentExplorer)

    dispatchBattle({
      type: 'PROCESS_TURN_END',
      poisonDamage,
      updatedExplorer,
    })
  }, [run, dispatchBattle])

  // バトルステートがない場合はnullを返す
  if (!battleState || !run) {
    return null
  }

  const explorer = run.party[0]  // MVPでは1人
  const gold = run.gold

  // 使用可能なコマンド一覧
  const availableCommands = getAvailableCommands(explorer, gold)

  // 現在のアクター
  const currentActor = battleState.actionQueue[battleState.currentActorIndex]

  // プレイヤーのターンかどうか
  const isPlayerTurn = currentActor?.type === 'explorer'

  // コマンド実行（explorerに依存するためここで定義）
  const executeCommand = () => {
    dispatchBattle({ type: 'EXECUTE_COMMAND', explorer })
  }

  return {
    // バトル状態
    battleState,
    explorer,
    gold,
    enemies: battleState.enemies,
    turn: battleState.turn,
    turnLimit: battleState.turnLimit,

    // アクター情報
    currentActor,
    isPlayerTurn,

    // コマンド選択状態
    availableCommands,
    selectedCommand: battleState.selectedCommand,
    selectedTargetId: battleState.selectedTargetId,
    damagePopups: battleState.damagePopups,
    playerDamagePopups: battleState.playerDamagePopups,

    // アクション
    selectCommand,
    cancelCommand,
    selectTarget,
    executeCommand,
    nextActor,
    removePopup,
    enemyAction,
    removePlayerPopup,
    processTurnEnd,
  }
}
