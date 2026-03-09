import { BattleState, BattleCommand, DamagePopup, PlayerDamagePopup, LevelUpPopup } from '../Types/Battle'
import { ExplorerState } from '../Types/Explorer'
import { calculateWeaponDamage, calculateSpellDamage, isSpell, isWeapon, isPotion, LevelUpInfo } from '../Core'

/** バトルアクション型 */
export type BattleAction =
  | { type: 'SELECT_COMMAND'; command: BattleCommand }
  | { type: 'CANCEL_COMMAND' }
  | { type: 'SELECT_TARGET'; targetId: string }
  | { type: 'EXECUTE_COMMAND'; explorer: ExplorerState }
  | { type: 'NEXT_ACTOR' }
  | { type: 'REMOVE_POPUP'; popupId: string }
  | { type: 'ENEMY_ACTION'; enemyId: string; damage: number; explorer: ExplorerState }
  | { type: 'REMOVE_PLAYER_POPUP'; popupId: string }
  | { type: 'PROCESS_TURN_END'; poisonDamage: number; updatedExplorer: ExplorerState }
  | { type: 'ADD_LEVEL_UP_POPUP'; levelUpInfo: LevelUpInfo }
  | { type: 'REMOVE_LEVEL_UP_POPUP'; popupId: string }

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
function createPlayerDamagePopup(damage: number): PlayerDamagePopup {
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

      // ターゲットの敵を見つける
      const { enemies } = state
      const targetEnemy = enemies.find(e => e.instanceId === selectedTargetId)
      if (!targetEnemy) {
        return state
      }

      // ダメージ計算
      let damage: number
      if (isWeapon(selectedCommand)) {
        const result = calculateWeaponDamage(action.explorer, selectedCommand, targetEnemy)
        damage = result.damage
      } else if (isSpell(selectedCommand)) {
        const result = calculateSpellDamage(action.explorer, selectedCommand, targetEnemy)
        damage = result.damage
      } else {
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
      // プレイヤーダメージポップアップを追加
      const newPlayerPopup = createPlayerDamagePopup(action.damage)

      // 次のアクターへ遷移
      const { nextIndex, nextTurn } = calculateNextActorIndex(state)

      return {
        ...state,
        playerDamagePopups: [...state.playerDamagePopups, newPlayerPopup],
        currentActorIndex: nextIndex,
        turn: nextTurn,
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

    default:
      return state
  }
}
