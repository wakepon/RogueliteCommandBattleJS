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
  healAlly?: { amount?: number; percentOfMaxHp?: number } // 味方1体のHP回復
  isAoe?: boolean              // 全体攻撃
  applyWeakness?: { value: number; duration: number }   // 弱体デバフ付与
  applySelfDefense?: { value: number; duration: number } // 自己防御バフ
  transformName?: string       // 条件トリガーで敵表示名を変更
  isRandomTarget?: boolean     // 各hitでランダムにターゲットを選択
  // 新メカニクス
  weaponSeal?: boolean         // 対象の武器耐久-1（単体）
  weaponSealAll?: boolean      // 全員の武器耐久-1
  applyShieldToSelf?: number   // 自身にシールド付与
  applyShieldToAlly?: number   // 味方1体にシールド付与
  applyGuard?: boolean         // 庇う（プレイヤーの単体攻撃を自分にリダイレクト）
  mpDrainAll?: number          // 全員のMP吸収
  applyVulnerability?: { multiplier: number; duration: number } // 被ダメ増加デバフ付与
  unlimitedSummon?: boolean    // 召喚回数制限なし
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
  return defaultResult('体当たり', 11)
}

/** ゴブリンの行動決定 — 溜め持ち */
function selectGoblinAction(enemy: EnemyInstance): EnemyActionResult {
  const hasCharge = getChargeMultiplier(enemy.battleBuffs) > 1.0

  if (hasCharge) {
    return {
      ...defaultResult('渾身の一撃', 20),
      consumeCharge: true,
    }
  }

  const chargeAction: EnemyActionResult = {
    ...defaultResult('力溜め', 0),
    applyCharge: true,
  }

  const table = [
    { weight: 0.60, value: defaultResult('斬りつける', 9) },
    { weight: 0.40, value: chargeAction },
  ]
  return selectByWeight(table)
}

/** どぶネズミの行動決定 — 召喚（1回限り） */
function selectSewerRatAction(enemy: EnemyInstance): EnemyActionResult {
  if (!enemy.hasSummoned) {
    const table = [
      { weight: 0.60, value: defaultResult('かみつく', 8) },
      { weight: 0.40, value: { ...defaultResult('仲間を呼ぶ', 0), summonEnemyId: 'sewer_rat' } },
    ]
    return selectByWeight(table)
  }
  return defaultResult('かみつく', 8)
}

/** オークの行動決定 */
function selectOrcAction(enemy: EnemyInstance): EnemyActionResult {
  const hasCharge = getChargeMultiplier(enemy.battleBuffs) > 1.0

  if (hasCharge) {
    return {
      ...defaultResult('渾身の一撃', 28),
      consumeCharge: true,
    }
  }

  const chargeAction: EnemyActionResult = {
    ...defaultResult('力溜め', 0),
    applyCharge: true,
  }

  const table = [
    { weight: 0.60, value: chargeAction },
    { weight: 0.40, value: defaultResult('こづく', 10) },
  ]
  return selectByWeight(table)
}

/** アサシンの行動決定 */
function selectAssassinAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.55, value: defaultResult('急所狙い', 26) },
    { weight: 0.45, value: { ...defaultResult('二連撃', 11), hits: 2 } },
  ]
  return selectByWeight(table)
}

/** スリープタイガーの行動決定 */
function selectSleepTigerAction(enemy: EnemyInstance): EnemyActionResult {
  const hpRatio = enemy.currentHp / enemy.hp
  const hasCharge = getChargeMultiplier(enemy.battleBuffs) > 1.0

  if (hasCharge) {
    return {
      ...defaultResult('大暴れ', 20),
      hits: 2,
      consumeCharge: true,
      transformName: 'マッドタイガー',
    }
  }

  if (hpRatio > 0.8) {
    return defaultResult('寝返り', 8)
  }

  const chargeAction: EnemyActionResult = {
    ...defaultResult('力溜め', 0),
    applyCharge: true,
    transformName: 'マッドタイガー',
  }

  const table = [
    { weight: 0.35, value: { ...defaultResult('怒りの爪', 24), transformName: 'マッドタイガー' } },
    { weight: 0.20, value: { ...defaultResult('あばれる', 12), hits: 2, transformName: 'マッドタイガー' } },
    { weight: 0.25, value: { ...defaultResult('乱れ引っかき', 10), hits: 3, isRandomTarget: true, transformName: 'マッドタイガー' } },
    { weight: 0.20, value: chargeAction },
  ]
  return selectByWeight(table)
}

/** シャーマンの行動決定 — 弱体の呪い追加 */
function selectShamanAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.50, value: { ...defaultResult('仲間を鼓舞する', 0), chargeAllAllies: true } },
    { weight: 0.30, value: { ...defaultResult('弱体の呪い', 0), applyVulnerability: { multiplier: 1.5, duration: 1 } } },
    { weight: 0.20, value: defaultResult('杖で殴る', 8) },
  ]
  return selectByWeight(table)
}

/** ヘドロスライムの行動決定 */
function selectHedroSlimeAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.50, value: { ...defaultResult('泥かけ', 6), applyWeakness: { value: 0.5, duration: 1 } } },
    { weight: 0.50, value: defaultResult('体当たり', 10) },
  ]
  return selectByWeight(table)
}

/** ダークメイジの行動決定 — 武器封印追加 */
function selectDarkMageAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.35, value: { ...defaultResult('MPドレイン', 0), mpDrain: 10 } },
    { weight: 0.35, value: { ...defaultResult('武器封印', 0), weaponSeal: true } },
    { weight: 0.30, value: defaultResult('ダークショット', 9) },
  ]
  return selectByWeight(table)
}

/** 妖精の行動決定 */
function selectFairyAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.80, value: { ...defaultResult('ヒール', 0), healAlly: { percentOfMaxHp: 0.3 } } },
    { weight: 0.20, value: defaultResult('タックル', 6) },
  ]
  return selectByWeight(table)
}

/** 盾持ちゴブリンの行動決定 */
function selectShieldGoblinAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.80, value: { ...defaultResult('シールドバッシュ', 9), applyShieldToSelf: 1 } },
    { weight: 0.20, value: { ...defaultResult('ガード', 0), applyShieldToSelf: 1 } },
  ]
  return selectByWeight(table)
}

/** ガーディアンの行動決定 */
function selectGuardianAction(_enemy: EnemyInstance): EnemyActionResult {
  const table = [
    { weight: 0.40, value: { ...defaultResult('守護の盾', 0), applyShieldToAlly: 1 } },
    { weight: 0.30, value: { ...defaultResult('庇う', 0), applyGuard: true } },
    { weight: 0.30, value: defaultResult('体当たり', 12) },
  ]
  return selectByWeight(table)
}

/** ドラゴンの行動決定 — 自己再生を30%に下方 */
function selectDragonAction(enemy: EnemyInstance): EnemyActionResult {
  const hpRatio = enemy.currentHp / enemy.hp
  const hasCharge = getChargeMultiplier(enemy.battleBuffs) > 1.0

  if (hasCharge) {
    return {
      ...defaultResult('渾身の一撃', 41),
      consumeCharge: true,
    }
  }

  if (hpRatio > 0.5) {
    const table = [
      { weight: 0.50, value: defaultResult('切り裂く爪', 21) },
      { weight: 0.30, value: { ...defaultResult('自己再生', 0), healSelf: Math.floor(enemy.hp * 0.3) } },
      { weight: 0.20, value: { ...defaultResult('火炎ブレス', 14), isAoe: true } },
    ]
    return selectByWeight(table)
  }

  const chargeAction: EnemyActionResult = {
    ...defaultResult('力溜め', 0),
    applyCharge: true,
  }

  const table = [
    { weight: 0.30, value: defaultResult('怒りの爪', 26) },
    { weight: 0.30, value: { ...defaultResult('猛火のブレス', 19), isAoe: true } },
    { weight: 0.40, value: chargeAction },
  ]
  return selectByWeight(table)
}

/** リッチの行動決定 — 妨害特化ボス */
function selectLichAction(enemy: EnemyInstance): EnemyActionResult {
  const hpRatio = enemy.currentHp / enemy.hp

  if (hpRatio > 0.5) {
    // Phase1: MPドレイン全体 / 呪い / ダークショット
    const table = [
      { weight: 0.35, value: { ...defaultResult('MPドレイン', 0), mpDrainAll: 5, isAoe: true } },
      { weight: 0.35, value: { ...defaultResult('呪い', 0), applyWeakness: { value: 0.5, duration: 1 } } },
      { weight: 0.30, value: defaultResult('ダークショット', 16) },
    ]
    return selectByWeight(table)
  }

  // Phase2: 武器封印全体 / 暗黒ブレス / 召喚
  const table: { weight: number; value: EnemyActionResult }[] = [
    { weight: 0.35, value: { ...defaultResult('武器封印', 0), weaponSealAll: true } },
    { weight: 0.35, value: { ...defaultResult('暗黒ブレス', 12), isAoe: true } },
    { weight: 0.30, value: { ...defaultResult('召喚', 0), summonEnemyId: 'hedro_slime', unlimitedSummon: true } },
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
    case 'fairy':
      return selectFairyAction(enemy)
    case 'shield_goblin':
      return selectShieldGoblinAction(enemy)
    case 'guardian':
      return selectGuardianAction(enemy)
    case 'dragon':
      return selectDragonAction(enemy)
    case 'lich':
      return selectLichAction(enemy)
    default:
      return defaultResult('攻撃', enemy.attack)
  }
}
