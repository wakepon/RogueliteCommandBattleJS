import { RelicInstance } from '../Types/Relic'
import { PassiveEffectType } from '../Types/Passive'

/** 特定効果の所持判定 */
export function hasRelicEffect(
  relics: RelicInstance[],
  type: PassiveEffectType['type']
): boolean {
  return relics.some(r => r.passiveEffect.type === type)
}

// ===== デメリット変換 =====

/** 修羅の血脈: HP消費時のPowerボーナス値 */
export function getHpCostPowerBoost(relics: RelicInstance[]): { powerBonus: number; duration: number } | null {
  for (const r of relics) {
    if (r.passiveEffect.type === 'hpCostPowerBoost') {
      return { powerBonus: r.passiveEffect.powerBonus, duration: r.passiveEffect.duration }
    }
  }
  return null
}

/** 逆境の鎧: 被ダメ増加状態中のPowerボーナス */
export function getVulnerabilityPowerBoost(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'vulnerabilityPowerBoost') return r.passiveEffect.powerBonus
  }
  return 0
}

/** 魔力の残滓: MP消費時のシールド付与閾値と値 */
export function getMpSpendShield(relics: RelicInstance[]): { mpThreshold: number; shieldValue: number } | null {
  for (const r of relics) {
    if (r.passiveEffect.type === 'mpSpendShield') {
      return { mpThreshold: r.passiveEffect.mpThreshold, shieldValue: r.passiveEffect.shieldValue }
    }
  }
  return null
}

// ===== 条件付きバフ =====

/** 研ぎ師の名刺: ナイフ使用回数ごとの耐久回復 */
export function getKnifeUseDurabilityRestore(relics: RelicInstance[]): { usesRequired: number; restoreAmount: number } | null {
  for (const r of relics) {
    if (r.passiveEffect.type === 'knifeUseDurabilityRestore') {
      return { usesRequired: r.passiveEffect.usesRequired, restoreAmount: r.passiveEffect.restoreAmount }
    }
  }
  return null
}

/** 討伐の対価: 撃破時MP回復量 */
export function getKillMpRecover(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'killMpRecover') return r.passiveEffect.value
  }
  return 0
}

/** 前衛の矜持: 前衛キャラのINTボーナス */
export function getFrontRowIntBonus(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'frontRowIntBonus') return r.passiveEffect.value
  }
  return 0
}

/** 後衛の底力: 後衛キャラのSTRボーナス */
export function getBackRowStrBonus(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'backRowStrBonus') return r.passiveEffect.value
  }
  return 0
}

/** 挑発式防御: シールドor反撃持ちの被弾率ボーナス */
export function getShieldTauntBonus(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'shieldTaunt') return r.passiveEffect.value
  }
  return 0
}

/** 連携の紋章: 同ターン複数攻撃時のPowerボーナス */
export function getComboAttackBonus(relics: RelicInstance[]): { requiredCount: number; powerBonus: number } | null {
  for (const r of relics) {
    if (r.passiveEffect.type === 'comboAttackBonus') {
      return { requiredCount: r.passiveEffect.requiredCount, powerBonus: r.passiveEffect.powerBonus }
    }
  }
  return null
}

/** 闘気の腕輪: レベルアップ時のSTR/INTボーナス */
export function getLevelUpStatBoost(relics: RelicInstance[]): { strBonus: number; intBonus: number } | null {
  for (const r of relics) {
    if (r.passiveEffect.type === 'levelUpStatBoost') {
      return { strBonus: r.passiveEffect.strBonus, intBonus: r.passiveEffect.intBonus }
    }
  }
  return null
}

/** 努力の証: 壊れた武器1本あたりのSTRボーナス */
export function getBrokenWeaponStrBonus(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'brokenWeaponStatBonus') return r.passiveEffect.strPerWeapon
  }
  return 0
}

// ===== リソース変換 =====

/** 苦痛のリング: 被ダメ→MP固定回復値 */
export function getDamageTakenToMpValue(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'damageTakenToMp') return r.passiveEffect.value
  }
  return 0
}

/** 血の契約: 戦闘開始時HP削減率とSTRボーナス */
export function getBattleStartHpReduction(relics: RelicInstance[]): { rate: number; strBonus: number } | null {
  for (const r of relics) {
    if (r.passiveEffect.type === 'battleStartHpReduction') {
      return { rate: r.passiveEffect.rate, strBonus: r.passiveEffect.strBonus }
    }
  }
  return null
}

/** 身代わりの人形: 致死ダメージ耐え効果所持判定 */
export function hasDeathProtection(relics: RelicInstance[]): boolean {
  return relics.some(r => r.passiveEffect.type === 'deathProtection')
}

// ===== シンプルバフ =====

/** 再生のコケ: 毎ターンHP回復量 */
export function getRegenPerTurn(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'regenPerTurn') return r.passiveEffect.value
  }
  return 0
}

/** 武器お手入れ用油: 耐久消費スキップ確率 */
export function getWeaponDurabilitySaveChance(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'weaponDurabilitySave') return r.passiveEffect.chance
  }
  return 0
}

/** 修羅の証: バトル終了後の全員ボーナスEXP */
export function getBattleEndBonusExp(relics: RelicInstance[]): { expValue: number } | null {
  for (const r of relics) {
    if (r.passiveEffect.type === 'battleEndBonusExp') {
      return { expValue: r.passiveEffect.expValue }
    }
  }
  return null
}

/** 棘の書: 反撃効果の持続ターンボーナス */
export function getThornsDurationBonus(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'thornsDurationBonus') return r.passiveEffect.value
  }
  return 0
}

/** 錬金術の触媒: ポーション効果倍率 */
export function getPotionEffectMultiplier(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'potionEffectMultiplier') return r.passiveEffect.multiplier
  }
  return 1.0
}

/** 薬師の鞄: ポーション所持上限ボーナス */
export function getPotionSlotBonus(relics: RelicInstance[]): number {
  return relics.reduce((sum, r) => {
    if (r.passiveEffect.type === 'potionSlotBonus') return sum + r.passiveEffect.value
    return sum
  }, 0)
}

// ===== ポジション判定ヘルパー =====

/** キャラクターが前衛かどうかを判定 */
export function isFrontRow(explorerIndex: number, partySize: number): boolean {
  if (partySize <= 1) return true
  return explorerIndex === 0
}

/** ポジションに基づくステータスボーナスを計算 */
export function getPositionStatBonus(
  relics: RelicInstance[],
  explorerIndex: number,
  partySize: number
): { strBonus: number; intBonus: number } {
  const front = isFrontRow(explorerIndex, partySize)
  return {
    strBonus: front ? 0 : getBackRowStrBonus(relics),
    intBonus: front ? getFrontRowIntBonus(relics) : 0,
  }
}
