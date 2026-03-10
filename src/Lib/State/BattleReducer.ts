import { BattleState, BattleCommand, DamagePopup, PlayerDamagePopup, LevelUpPopup, RelicBattleState } from '../Types/Battle'
import { ExplorerState } from '../Types/Explorer'
import { isSpell, isPotion, LevelUpInfo } from '../Core'

/** バトルアクション型 */
export type BattleAction =
  | { type: 'SELECT_COMMAND'; command: BattleCommand }
  | { type: 'CANCEL_COMMAND' }
  | { type: 'SELECT_TARGET'; targetId: string }
  | { type: 'EXECUTE_COMMAND'; explorer: ExplorerState; calculatedDamage?: number; calculatedDamages?: Array<{targetId: string; damage: number}> }
  | { type: 'NEXT_ACTOR' }
  | { type: 'REMOVE_POPUP'; popupId: string }
  | { type: 'ENEMY_ACTION'; enemyId: string; damage: number; explorer: ExplorerState;
      actionName: string; poisonStacks: number; mpDrain: number;
      applyCharge: boolean; consumeCharge: boolean; hits: number }
  | { type: 'REMOVE_PLAYER_POPUP'; popupId: string }
  | { type: 'PROCESS_TURN_END'; poisonDamage: number; updatedExplorer: ExplorerState }
  | { type: 'ADD_LEVEL_UP_POPUP'; levelUpInfo: LevelUpInfo }
  | { type: 'REMOVE_LEVEL_UP_POPUP'; popupId: string }
  | { type: 'UPDATE_RELIC_STATE'; relicState: Partial<RelicBattleState> }
  | { type: 'UPDATE_ENEMIES'; enemies: BattleState['enemies'] }

/** ユニークIDを生成 */
function generatePopupId(): string {
  return `popup-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/** ダメージポップアップを作成（敵へのダメージ用） */
function createDamagePopup(targetId: string, damage: number): DamagePopup {
  return {
    id: generatePopupId(),
    targetId,
    damage,
    timestamp: Date.now(),
  }
}

/** プレイヤーダメージポップアップを作成 */
export function createPlayerDamagePopup(damage: number): PlayerDamagePopup {
  return {
    id: generatePopupId(),
    damage,
    timestamp: Date.now(),
  }
}

/** レベルアップポップアップを作成 */
function createLevelUpPopup(levelUpInfo: LevelUpInfo): LevelUpPopup {
  return {
    id: generatePopupId(),
    levelUpInfo,
    timestamp: Date.now(),
  }
}

/** 次のアクターインデックスを計算（ターン終了処理も含む） */
function calculateNextActorIndex(state: BattleState): { nextIndex: number; nextTurn: number } {
  const nextIndex = state.currentActorIndex + 1

  // キューの最後まで行った場合、次のターンへ
  if (nextIndex >= state.actionQueue.length) {
    return {
      nextIndex: 0,
      nextTurn: state.turn + 1,
    }
  }

  return {
    nextIndex,
    nextTurn: state.turn,
  }
}

/** バトル状態のReducer */
export function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'SELECT_COMMAND': {
      return {
        ...state,
        selectedCommand: action.command,
      }
    }

    case 'CANCEL_COMMAND': {
      return {
        ...state,
        selectedCommand: null,
        selectedTargetId: null,
      }
    }

    case 'SELECT_TARGET': {
      return {
        ...state,
        selectedTargetId: action.targetId,
      }
    }

    case 'EXECUTE_COMMAND': {
      const { selectedCommand, selectedTargetId } = state

      // コマンドまたはターゲットが未選択の場合は何もしない
      if (!selectedCommand || !selectedTargetId) {
        return state
      }

      // ポーションの場合: ダメージなし、ターン消費のみ（効果適用はGameReducer側）
      if (isPotion(selectedCommand)) {
        const { nextIndex, nextTurn } = calculateNextActorIndex(state)

        return {
          ...state,
          selectedCommand: null,
          selectedTargetId: null,
          currentActorIndex: nextIndex,
          turn: nextTurn,
        }
      }

      // 味方対象スペル（ヒールなど）: ダメージなし、ターン消費のみ（効果適用はGameReducer側）
      if (isSpell(selectedCommand) && selectedCommand.targetType === 'allySingle') {
        const { nextIndex, nextTurn } = calculateNextActorIndex(state)

        return {
          ...state,
          selectedCommand: null,
          selectedTargetId: null,
          currentActorIndex: nextIndex,
          turn: nextTurn,
        }
      }

      // 全体攻撃: calculatedDamages がある場合
      if (action.calculatedDamages && action.calculatedDamages.length > 0) {
        const { enemies } = state
        const updatedEnemies = enemies.map(enemy => {
          const dmgEntry = action.calculatedDamages!.find(d => d.targetId === enemy.instanceId)
          if (dmgEntry) {
            return { ...enemy, currentHp: Math.max(0, enemy.currentHp - dmgEntry.damage) }
          }
          return enemy
        })

        const newPopups = action.calculatedDamages.map(d => createDamagePopup(d.targetId, d.damage))
        const { nextIndex, nextTurn } = calculateNextActorIndex(state)

        return {
          ...state,
          enemies: updatedEnemies,
          damagePopups: [...state.damagePopups, ...newPopups],
          selectedCommand: null,
          selectedTargetId: null,
          currentActorIndex: nextIndex,
          turn: nextTurn,
        }
      }

      // 単体攻撃: ダメージがGameReducer側で事前計算されている場合はそれを使う
      const damage = action.calculatedDamage
      if (damage === undefined) {
        return state
      }

      // ターゲットの敵を見つける
      const { enemies } = state
      const targetEnemy = enemies.find(e => e.instanceId === selectedTargetId)
      if (!targetEnemy) {
        return state
      }

      // 敵のHPを減少（immutableに更新）
      const updatedEnemies = enemies.map(enemy => {
        if (enemy.instanceId === selectedTargetId) {
          return {
            ...enemy,
            currentHp: Math.max(0, enemy.currentHp - damage),
          }
        }
        return enemy
      })

      // ダメージポップアップを追加
      const newPopup = createDamagePopup(selectedTargetId, damage)

      // 次のアクターへ
      const { nextIndex, nextTurn } = calculateNextActorIndex(state)

      return {
        ...state,
        enemies: updatedEnemies,
        damagePopups: [...state.damagePopups, newPopup],
        selectedCommand: null,
        selectedTargetId: null,
        currentActorIndex: nextIndex,
        turn: nextTurn,
      }
    }

    case 'NEXT_ACTOR': {
      const { nextIndex, nextTurn } = calculateNextActorIndex(state)

      return {
        ...state,
        currentActorIndex: nextIndex,
        turn: nextTurn,
      }
    }

    case 'REMOVE_POPUP': {
      return {
        ...state,
        damagePopups: state.damagePopups.filter(popup => popup.id !== action.popupId),
      }
    }

    case 'ENEMY_ACTION': {
      // 敵の名前を取得してメッセージを生成
      const actingEnemy = state.enemies.find(e => e.instanceId === action.enemyId)
      const enemyName = actingEnemy?.name ?? '敵'
      const isIdle = action.damage === 0 && !action.applyCharge && action.poisonStacks === 0 && action.mpDrain === 0
      const battleMessage = isIdle
        ? `${enemyName}は${action.actionName}`
        : `${enemyName}の${action.actionName}`

      // damage=0の場合はポップアップを追加しない
      const newPlayerPopups = action.damage > 0
        ? [...state.playerDamagePopups, createPlayerDamagePopup(action.damage)]
        : state.playerDamagePopups

      // 次のアクターへ遷移
      const { nextIndex, nextTurn } = calculateNextActorIndex(state)

      return {
        ...state,
        playerDamagePopups: newPlayerPopups,
        currentActorIndex: nextIndex,
        turn: nextTurn,
        battleMessage,
        battleMessageId: state.battleMessageId + 1,
      }
    }

    case 'REMOVE_PLAYER_POPUP': {
      return {
        ...state,
        playerDamagePopups: state.playerDamagePopups.filter(popup => popup.id !== action.popupId),
      }
    }

    case 'PROCESS_TURN_END': {
      // ターンを+1し、actionQueueを先頭に戻す
      return {
        ...state,
        turn: state.turn + 1,
        currentActorIndex: 0,
      }
    }

    case 'ADD_LEVEL_UP_POPUP': {
      const newPopup = createLevelUpPopup(action.levelUpInfo)
      return {
        ...state,
        levelUpPopups: [...state.levelUpPopups, newPopup],
      }
    }

    case 'REMOVE_LEVEL_UP_POPUP': {
      return {
        ...state,
        levelUpPopups: state.levelUpPopups.filter(popup => popup.id !== action.popupId),
      }
    }

    case 'UPDATE_RELIC_STATE': {
      return {
        ...state,
        relicState: {
          ...state.relicState,
          ...action.relicState,
        },
      }
    }

    case 'UPDATE_ENEMIES': {
      return {
        ...state,
        enemies: action.enemies,
      }
    }

    default:
      return state
  }
}
