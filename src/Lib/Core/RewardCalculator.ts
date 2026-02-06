import { EnemyInstance, EnemyType } from '../Types/Enemy'

/** 敵タイプ別の基本報酬 */
const BASE_GOLD_BY_TYPE: Record<EnemyType, number> = {
  normal: 3,
  elite: 5,
  boss: 10,
}

/** 敵タイプの強さ順位（大きいほど強い） */
const TYPE_STRENGTH: Record<EnemyType, number> = {
  normal: 1,
  elite: 2,
  boss: 3,
}

/**
 * 最大利子を計算
 * 利子 = min(floor(currentGold / 5), 5)
 */
function calculateInterest(currentGold: number): number {
  return Math.min(Math.floor(currentGold / 5), 5)
}

/**
 * 最も強い敵のタイプを取得
 */
function getStrongestEnemyType(enemies: EnemyInstance[]): EnemyType {
  if (enemies.length === 0) {
    return 'normal'
  }

  return enemies.reduce<EnemyType>((strongest, enemy) => {
    if (TYPE_STRENGTH[enemy.type] > TYPE_STRENGTH[strongest]) {
      return enemy.type
    }
    return strongest
  }, 'normal')
}

/**
 * 戦闘報酬を計算
 *
 * BaseGold計算ルール（仕様書より）:
 * - 最も強い敵の報酬のみを取得
 * - normal: 3G, elite: 5G, boss: 10G
 *
 * Interest計算ルール:
 * - 利子 = min(floor(currentGold / 5), 5)
 * - 最大5Gまで
 *
 * @param enemies - 戦闘で倒した敵の配列
 * @param currentGold - 現在の所持ゴールド
 * @param stolenGold - ゴールドラッシュで盗んだゴールド
 */
export function calculateReward(
  enemies: EnemyInstance[],
  currentGold: number,
  stolenGold: number
): {
  baseGold: number
  interestGold: number
  stolenGold: number
  total: number
} {
  const strongestType = getStrongestEnemyType(enemies)
  const baseGold = BASE_GOLD_BY_TYPE[strongestType]
  const interestGold = calculateInterest(currentGold)
  const total = baseGold + interestGold + stolenGold

  return {
    baseGold,
    interestGold,
    stolenGold,
    total,
  }
}
