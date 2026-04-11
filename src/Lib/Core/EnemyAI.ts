import { EnemyInstance } from '../Types/Enemy'
import { ExplorerState } from '../Types/Explorer'
import { getChargeMultiplier } from './BuffProcessor'

/** 敵行動の結果 */
export interface EnemyActionResult {
  actionName: string       // "体当たり", "力溜め" 等
  damage: number           // プレイヤーへのダメージ
  hits: number             // 攻撃回数（通常1、連続攻撃は2以上）
  poisonStacks: number     // 付与する毒スタック数（0=なし）
  mpDrain: number          // MPドレイン量（0=なし）
  applyCharge: boolean     // 敵に力溜めバフを付与するか
  consumeCharge: boolean   // 敵の力溜めバフを消費するか
  // 拡張フィールド
  chargeAllAllies?: boolean    // 他の生存敵全員にcharge付与
  summonEnemyId?: string       // 戦闘中に敵を追加
  healSelf?: number            // 自身のHP回復量
  healAlly?: { amount: number } // 味方1体のHP回復
  isAoe?: boolean              // 全体攻撃
  applyWeakness?: { value: number; duration: number }   // 弱体デバフ付与
  applySelfDefense?: { value: number; duration: number } // 自己防御バフ
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
  return defaultResult('体当たり', 15)
}

/** ゴブリンの行動決定 */
function selectGoblinAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.60, value: defaultResult('斬りつける', 12) },
    { weight: 0.40, value: defaultResult('振りまわす', 25) },
  ]
  return selectByWeight(table)
}

/** どぶネズミの行動決定 */
function selectSewerRatAction(enemy: EnemyInstance): EnemyActionResult {
  // 仲間を呼んだことがない場合、40%の確率で仲間を呼ぶ
  if (!enemy.hasSummoned) {
    const table = [
      { weight: 0.60, value: defaultResult('かみつく', 12) },
      { weight: 0.40, value: { ...defaultResult('仲間を呼ぶ', 0), summonEnemyId: 'sewer_rat' } },
    ]
    return selectByWeight(table)
  }
  // 仲間を呼んだ後はかみつくのみ
  return defaultResult('かみつく', 12)
}

/** オークの行動決定 */
function selectOrcAction(enemy: EnemyInstance): EnemyActionResult {
  const hasCharge = getChargeMultiplier(enemy.battleBuffs) > 1.0

  if (hasCharge) {
    return {
      ...defaultResult('渾身の一撃', 40),
      consumeCharge: true,
    }
  }

  const chargeAction: EnemyActionResult = {
    ...defaultResult('力溜め', 0),
    applyCharge: true,
  }

  const table = [
    { weight: 0.60, value: chargeAction },
    { weight: 0.40, value: defaultResult('こづく', 14) },
  ]
  return selectByWeight(table)
}

/** アサシンの行動決定 */
function selectAssassinAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.55, value: defaultResult('急所狙い', 35) },
    { weight: 0.45, value: { ...defaultResult('二連撃', 15), hits: 2 } },
  ]
  return selectByWeight(table)
}

/** スリープタイガーの行動決定 */
function selectSleepTigerAction(enemy: EnemyInstance): EnemyActionResult {
  const hpRatio = enemy.currentHp / enemy.hp
  const hasCharge = getChargeMultiplier(enemy.battleBuffs) > 1.0

  // 力溜め中: フェーズに関係なく大暴れ（力溜め消費）
  if (hasCharge) {
    return {
      ...defaultResult('大暴れ', 20),
      hits: 2,
      consumeCharge: true,
    }
  }

  if (hpRatio > 0.8) {
    // Phase 1: HP > 80% — 寝ている
    return defaultResult('寝返り', 10)
  }

  // Phase 2: HP ≤ 80% — 覚醒
  const chargeAction: EnemyActionResult = {
    ...defaultResult('力溜め', 0),
    applyCharge: true,
  }

  const table = [
    { weight: 0.50, value: defaultResult('怒りの爪', 24) },
    { weight: 0.25, value: { ...defaultResult('あばれる', 10), hits: 2 } },
    { weight: 0.25, value: chargeAction },
  ]
  return selectByWeight(table)
}

/** シャーマンの行動決定 */
function selectShamanAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.45, value: { ...defaultResult('仲間を鼓舞する', 0), chargeAllAllies: true } },
    { weight: 0.55, value: defaultResult('杖で殴る', 10) },
  ]
  return selectByWeight(table)
}

/** ヘドロスライムの行動決定 */
function selectHedroSlimeAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.50, value: { ...defaultResult('泥かけ', 8), applyWeakness: { value: 0.25, duration: 2 } } },
    { weight: 0.50, value: defaultResult('体当たり', 15) },
  ]
  return selectByWeight(table)
}

/** ダークメイジの行動決定 */
function selectDarkMageAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.40, value: { ...defaultResult('MPドレイン', 0), mpDrain: 10 } },
    { weight: 0.60, value: defaultResult('ダークショット', 12) },
  ]
  return selectByWeight(table)
}

/** オークロードの行動決定 */
function selectOrcLordAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.35, value: { ...defaultResult('鼓舞', 0), chargeAllAllies: true } },
    { weight: 0.45, value: defaultResult('小突く', 8) },
    { weight: 0.20, value: { ...defaultResult('ガード', 0), applySelfDefense: { value: 50, duration: 1 } } },
  ]
  return selectByWeight(table)
}

/** 妖精の行動決定 */
function selectFairyAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.80, value: { ...defaultResult('ヒール', 0), healAlly: { amount: 10 } } },
    { weight: 0.20, value: defaultResult('タックル', 8) },
  ]
  return selectByWeight(table)
}

/** ドラゴンの行動決定 */
function selectDragonAction(enemy: EnemyInstance): EnemyActionResult {
  const hpRatio = enemy.currentHp / enemy.hp
  const hasCharge = getChargeMultiplier(enemy.battleBuffs) > 1.0

  // 力溜め中: フェーズに関係なく渾身の一撃（力溜め消費）
  if (hasCharge) {
    return {
      ...defaultResult('渾身の一撃', 55),
      consumeCharge: true,
    }
  }

  if (hpRatio > 0.5) {
    // Phase 1: HP > 50%
    const table = [
      { weight: 0.50, value: defaultResult('切り裂く爪', 28) },
      { weight: 0.30, value: { ...defaultResult('自己再生', 0), healSelf: 20 } },
      { weight: 0.20, value: { ...defaultResult('火炎ブレス', 18), isAoe: true } },
    ]
    return selectByWeight(table)
  }

  // Phase 2: HP ≤ 50%
  const chargeAction: EnemyActionResult = {
    ...defaultResult('力溜め', 0),
    applyCharge: true,
  }

  const table = [
    { weight: 0.30, value: defaultResult('怒りの爪', 35) },
    { weight: 0.30, value: { ...defaultResult('猛火のブレス', 25), isAoe: true } },
    { weight: 0.40, value: chargeAction },
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
    case 'sewer_rat':
      return selectSewerRatAction(enemy)
    case 'orc':
      return selectOrcAction(enemy)
    case 'assassin':
      return selectAssassinAction(enemy)
    case 'sleep_tiger':
      return selectSleepTigerAction(enemy)
    case 'shaman':
      return selectShamanAction(enemy)
    case 'hedro_slime':
      return selectHedroSlimeAction(enemy)
    case 'dark_mage':
      return selectDarkMageAction(enemy)
    case 'orc_lord':
      return selectOrcLordAction(enemy)
    case 'fairy':
      return selectFairyAction(enemy)
    case 'dragon':
      return selectDragonAction(enemy)
    default:
      // 未知の敵: ATK分の通常攻撃
      return defaultResult('攻撃', enemy.attack)
  }
}
