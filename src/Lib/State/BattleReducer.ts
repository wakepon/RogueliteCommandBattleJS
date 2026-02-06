import { BattleState, DamagePopup } from '../Types/Battle'
import { ExplorerWeapon } from '../Types/Weapon'
import { SpellInstance } from '../Types/Spell'
import { ExplorerState } from '../Types/Explorer'
import { calculateWeaponDamage, calculateSpellDamage, isSpell, isWeapon } from '../Core'

/** バトルアクション型 */
export type BattleAction =
  | { type: 'SELECT_COMMAND'; command: ExplorerWeapon | SpellInstance }
  | { type: 'CANCEL_COMMAND' }
  | { type: 'SELECT_TARGET'; targetId: string }
  | { type: 'EXECUTE_COMMAND'; explorer: ExplorerState }
  | { type: 'NEXT_ACTOR' }
  | { type: 'REMOVE_POPUP'; popupId: string }

/** ユニークIDを生成 */
function generatePopupId(): string {
  return `popup-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/** ダメージポップアップを作成 */
function createDamagePopup(targetId: string, damage: number): DamagePopup {
  return {
    id: generatePopupId(),
    targetId,
    damage,
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
      const { selectedCommand, selectedTargetId, enemies } = state

      // コマンドまたはターゲットが未選択の場合は何もしない
      if (!selectedCommand || !selectedTargetId) {
        return state
      }

      // ターゲットの敵を見つける
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

    default:
      return state
  }
}
