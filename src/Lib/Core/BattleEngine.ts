import { EnemyInstance } from '../Types/Enemy'
import { ExplorerState } from '../Types/Explorer'
import { BattleResult } from '../Types/Battle'
import { getChargeMultiplier, processPoisonDamage, decrementBuffDurations } from './BuffProcessor'

/**
 * 敵の攻撃ダメージを計算
 * damage = enemy.attack × 力溜め倍率（getChargeMultiplier）
 * @param enemy - 攻撃する敵インスタンス
 * @returns 計算されたダメージ量
 */
export function calculateEnemyDamage(enemy: EnemyInstance): number {
  const chargeMultiplier = getChargeMultiplier(enemy.battleBuffs)
  const damage = Math.floor(enemy.attack * chargeMultiplier)
  return damage
}

/**
 * 勝敗を判定
 * - 全敵HP0 → 'victory'
 * - プレイヤーHP0 → 'defeat'
 * - それ以外 → 'ongoing'
 * @param enemies - 敵インスタンスの配列
 * @param explorer - プレイヤーの状態
 * @returns 戦闘結果
 */
export function checkBattleResult(
  enemies: EnemyInstance[],
  explorer: ExplorerState
): BattleResult {
  // プレイヤーのHP0チェック（先にチェック）
  if (explorer.hp <= 0) {
    return 'defeat'
  }

  // 全敵がHP0かチェック
  const allEnemiesDefeated = enemies.every(enemy => enemy.currentHp <= 0)
  if (allEnemiesDefeated) {
    return 'victory'
  }

  return 'ongoing'
}

/**
 * ターン終了時の処理（全員が行動完了後）
 * - 毒ダメージ処理（processPoisonDamage使用）
 * - バフ/デバフのターン減少（decrementBuffDurations使用）
 * @param explorer - プレイヤーの状態
 * @returns { updatedExplorer, poisonDamage }
 */
export function processTurnEnd(
  explorer: ExplorerState
): { updatedExplorer: ExplorerState; poisonDamage: number } {
  // 毒ダメージ処理
  const { damage: poisonDamage, updatedDebuffs } = processPoisonDamage(explorer.battleDebuffs)

  // バフのターン減少処理
  const updatedBuffs = decrementBuffDurations(explorer.battleBuffs)

  // HPを減少（毒ダメージ適用）、最低0
  const newHp = Math.max(0, explorer.hp - poisonDamage)

  const updatedExplorer: ExplorerState = {
    ...explorer,
    hp: newHp,
    battleBuffs: updatedBuffs,
    battleDebuffs: updatedDebuffs,
  }

  return {
    updatedExplorer,
    poisonDamage,
  }
}
