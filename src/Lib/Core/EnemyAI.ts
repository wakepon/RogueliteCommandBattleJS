import { EnemyInstance } from '../Types/Enemy'
import { ExplorerState } from '../Types/Explorer'
import { getChargeMultiplier } from './BuffProcessor'

/** 敵行動の結果 */
export interface EnemyActionResult {
  actionName: string       // "体当たり", "ぼんやりしている" 等
  damage: number           // プレイヤーへのダメージ
  hits: number             // 攻撃回数（通常1、連続攻撃は3）
  poisonStacks: number     // 付与する毒スタック数（0=なし）
  mpDrain: number          // MPドレイン量（0=なし）
  applyCharge: boolean     // 敵に力溜めバフを付与するか
  consumeCharge: boolean   // 敵の力溜めバフを消費するか
}

/** 確率テーブルからランダムに行動を選択 */
function selectByWeight<T>(table: { weight: number; value: T }[]): T {
  const roll = Math.random()
  let cumulative = 0
  for (const entry of table) {
    cumulative += entry.weight
    if (roll < cumulative) {
      return entry.value
    }
  }
  // 浮動小数点の丸め誤差対策: 最後のエントリを返す
  return table[table.length - 1].value
}

/** デフォルトの行動結果を生成 */
function defaultResult(actionName: string, damage: number): EnemyActionResult {
  return {
    actionName,
    damage,
    hits: 1,
    poisonStacks: 0,
    mpDrain: 0,
    applyCharge: false,
    consumeCharge: false,
  }
}

/** スライムの行動決定 */
function selectSlimeAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.75, value: defaultResult('体当たり', 3) },
    { weight: 0.25, value: defaultResult('ぼんやりしている', 0) },
  ]
  return selectByWeight(table)
}

/** ゴブリンの行動決定 */
function selectGoblinAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.15, value: defaultResult('全力で斬りつける', 7) },
    { weight: 0.55, value: defaultResult('斬りつける', 5) },
    { weight: 0.20, value: defaultResult('小突く', 2) },
    { weight: 0.10, value: defaultResult('様子を見ている', 0) },
  ]
  return selectByWeight(table)
}

/** オークの行動決定 */
function selectOrcAction(enemy: EnemyInstance): EnemyActionResult {
  const hasCharge = getChargeMultiplier(enemy.battleBuffs) > 1.0

  if (hasCharge) {
    // 力溜め中: 100% 渾身の一撃
    return {
      ...defaultResult('渾身の一撃', 18),
      consumeCharge: true,
    }
  }

  // 通常状態
  const chargeAction: EnemyActionResult = {
    ...defaultResult('力溜め', 0),
    applyCharge: true,
  }

  const table = [
    { weight: 0.55, value: chargeAction },
    { weight: 0.35, value: defaultResult('殴りつける', 8) },
    { weight: 0.10, value: defaultResult('小突く', 3) },
  ]
  return selectByWeight(table)
}

/** ドラゴンの行動決定 */
function selectDragonAction(enemy: EnemyInstance): EnemyActionResult {
  const hpRatio = enemy.currentHp / enemy.hp
  const hasCharge = getChargeMultiplier(enemy.battleBuffs) > 1.0

  // 力溜め中: フェーズに関係なく渾身の攻撃（力溜め消費）
  if (hasCharge) {
    return {
      ...defaultResult('渾身の一撃', 30),
      consumeCharge: true,
    }
  }

  if (hpRatio > 0.5) {
    // フェーズ1: HP > 50%
    const poisonAction: EnemyActionResult = {
      ...defaultResult('毒ブレス', 5),
      poisonStacks: 2,
    }

    const table = [
      { weight: 0.40, value: defaultResult('爪で引っ掻く', 15) },
      { weight: 0.25, value: defaultResult('尻尾で薙ぎ払う', 10) },
      { weight: 0.20, value: poisonAction },
      { weight: 0.15, value: defaultResult('睨みつける', 0) },
    ]
    return selectByWeight(table)
  }

  // フェーズ2: HP ≤ 50%
  const poisonAction: EnemyActionResult = {
    ...defaultResult('毒ブレス', 5),
    poisonStacks: 3,
  }

  const chargeAction: EnemyActionResult = {
    ...defaultResult('力溜め', 0),
    applyCharge: true,
  }

  const multiHitAction: EnemyActionResult = {
    ...defaultResult('連続攻撃', 12),
    hits: 3,
  }

  const table = [
    { weight: 0.30, value: defaultResult('爪で引っ掻く', 15) },
    { weight: 0.25, value: defaultResult('火炎ブレス', 18) },
    { weight: 0.20, value: poisonAction },
    { weight: 0.15, value: chargeAction },
    { weight: 0.10, value: multiHitAction },
  ]
  return selectByWeight(table)
}

/**
 * 敵の行動を決定する
 * @param enemy - 行動する敵インスタンス
 * @param _explorer - プレイヤーの状態（将来の拡張用）
 * @returns 行動結果
 */
export function selectEnemyAction(enemy: EnemyInstance, _explorer: ExplorerState): EnemyActionResult {
  switch (enemy.id) {
    case 'slime':
      return selectSlimeAction(enemy)
    case 'goblin':
      return selectGoblinAction(enemy)
    case 'orc':
      return selectOrcAction(enemy)
    case 'dragon':
      return selectDragonAction(enemy)
    default:
      // 未知の敵: ATK分の通常攻撃
      return defaultResult('攻撃', enemy.attack)
  }
}
