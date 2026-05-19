import { EnemyInstance } from '../Types/Enemy'
import { ExplorerState } from '../Types/Explorer'
import { BattleResult } from '../Types/Battle'
import { processPoisonDamage, decrementBuffDurations, decrementWeaknessDuration } from './BuffProcessor'

/**
 * 勝敗を判定
 * - 全敵HP0 → 'victory'
 * - パーティー全員HP0 → 'defeat'（全滅）
 * - それ以外 → 'ongoing'
 * @param enemies - 敵インスタンスの配列
 * @param party - パーティーメンバーの配列
 * @returns 戦闘結果
 */
export function checkBattleResult(
  enemies: EnemyInstance[],
  party: ExplorerState[]
): BattleResult {
  // パーティー全滅チェック（全員HP0）
  const allPartyDefeated = party.every(member => member.hp <= 0)
  if (allPartyDefeated) {
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
function processTurnEnd(
  explorer: ExplorerState
): { updatedExplorer: ExplorerState; poisonDamage: number } {
  // 毒ダメージ処理
  const { damage: poisonDamage, updatedDebuffs: debuffsAfterPoison } = processPoisonDamage(explorer.battleDebuffs)

  // weaknessデバフのターン減少処理
  const updatedDebuffs = decrementWeaknessDuration(debuffsAfterPoison)

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

/** パーティー全員のターン終了処理 */
export function processPartyTurnEnd(
  party: ExplorerState[]
): { updatedParty: ExplorerState[]; totalPoisonDamage: number } {
  let totalPoisonDamage = 0
  const updatedParty = party.map(member => {
    if (member.hp <= 0) return member  // 戦闘不能キャラはスキップ
    const { updatedExplorer, poisonDamage } = processTurnEnd(member)
    totalPoisonDamage += poisonDamage
    return updatedExplorer
  })
  return { updatedParty, totalPoisonDamage }
}
