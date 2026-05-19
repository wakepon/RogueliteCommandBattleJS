import { RelicInstance } from '../Types/Relic'
import { PassiveEffectType } from '../Types/Passive'
import { ExplorerState } from '../Types/Explorer'
import { getTuningValue } from '../Tuning/TuningStore'

/** 特定効果の所持判定 */
export function hasRelicEffect(
  relics: RelicInstance[],
  type: PassiveEffectType['type']
): boolean {
  return relics.some(r => r.passiveEffect.type === type)
}

/** ステータスボーナス合算（str/int） */
export function getStatBonus(
  relics: RelicInstance[],
  stat: 'str' | 'int'
): number {
  return relics.reduce((sum, r) => {
    if (r.passiveEffect.type === 'statBonus' && r.passiveEffect.stat === stat) {
      return sum + r.passiveEffect.value
    }
    return sum
  }, 0)
}

/** 武器ダメージボーナス（鋭い砥石）の対象かどうか判定（INT武器・パンチは対象外） */
export function isWeaponDamageBonusApplicable(weapon: { id: string; scaleStat?: 'str' | 'int' }): boolean {
  if (weapon.id === 'punch') return false
  if (weapon.scaleStat === 'int') return false
  return true
}

/** 武器ダメージボーナス合算 */
export function getWeaponDamageBonus(relics: RelicInstance[]): number {
  return relics.reduce((sum, r) => {
    if (r.passiveEffect.type === 'weaponDamageBonus') {
      return sum + r.passiveEffect.value
    }
    return sum
  }, 0)
}

/** 条件付きダメージ倍率を計算（lowHpDamageMultiplier） */
export function getLowHpDamageMultiplier(
  relics: RelicInstance[],
  explorer: ExplorerState
): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'lowHpDamageMultiplier') {
      const threshold = explorer.maxHp * r.passiveEffect.hpThreshold
      if (explorer.hp <= threshold) {
        return r.passiveEffect.multiplier
      }
    }
  }
  return 1.0
}

/** killStreakBonus の倍率を取得 */
export function getKillStreakMultiplier(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'killStreakBonus') {
      return r.passiveEffect.multiplier
    }
  }
  return 1.0
}

/** lastStrikeDamageMultiplier の倍率を取得 */
export function getLastStrikeMultiplier(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'lastStrikeDamageMultiplier') {
      return r.passiveEffect.multiplier
    }
  }
  return 1.0
}

/** lowMpDamageBonus の倍率を取得 */
export function getLowMpDamageMultiplier(
  relics: RelicInstance[],
  explorer: ExplorerState
): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'lowMpDamageBonus') {
      const threshold = explorer.maxMp * r.passiveEffect.mpThreshold
      if (explorer.mp <= threshold) {
        return r.passiveEffect.multiplier
      }
    }
  }
  return 1.0
}

/** thornsDamage の値を取得 */
export function getThornsDamage(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'thornsDamage') {
      return r.passiveEffect.value
    }
  }
  return 0
}

/** regenPerTurn の値を取得 */
export function getRegenPerTurn(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'regenPerTurn') {
      return r.passiveEffect.value
    }
  }
  return 0
}

/** potionEffectMultiplier の倍率を取得 */
export function getPotionEffectMultiplier(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'potionEffectMultiplier') {
      return r.passiveEffect.multiplier
    }
  }
  return 1.0
}

/** weaponDurabilitySave のチャンスを取得 */
export function getWeaponDurabilitySaveChance(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'weaponDurabilitySave') {
      return r.passiveEffect.chance
    }
  }
  return 0
}

/** 努力の証: 武器破壊時の蓄積increment */
export function getWeaponBreakIncrement(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'weaponBreakDamageMultiplier') {
      return getTuningValue('phoenix_ember_increment', r.passiveEffect.increment)
    }
  }
  return 0
}

/** 鍛冶師の金槌: 武器破壊後のPowerボーナス */
export function getWeaponBreakAttackBonus(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'weaponBreakNextAttackBonus') return r.passiveEffect.value
  }
  return 0
}

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

/** 闘気の腕輪: 戦闘中レベルアップ時のダメージ倍率 */
export function getLevelUpDamageBoost(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'levelUpDamageBoost') return r.passiveEffect.multiplier
  }
  return 1.0
}

/** 修羅の証: バトル終了後の全員ボーナスEXPとゴールドペナルティ */
export function getBattleEndBonusExp(relics: RelicInstance[]): { expValue: number; goldPenalty: number } | null {
  for (const r of relics) {
    if (r.passiveEffect.type === 'battleEndBonusExp') {
      return { expValue: r.passiveEffect.expValue, goldPenalty: r.passiveEffect.goldPenalty }
    }
  }
  return null
}

/** 番狂わせの一撃: パーティ最低レベル時のダメージ倍率 */
export function getLowestLevelDamageMultiplier(
  relics: RelicInstance[],
  attacker: ExplorerState,
  party: ExplorerState[]
): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'lowestLevelDamageMultiplier') {
      const minLevel = Math.min(...party.map(p => p.level))
      if (attacker.level === minLevel) {
        return r.passiveEffect.multiplier
      }
    }
  }
  return 1.0
}

/** 強い者いじめ: HP最大者の被弾率ボーナス */
export function getHighHpTargetRateBonus(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'highHpTargetRateBonus') return r.passiveEffect.value
  }
  return 0
}

/** 身代わりの人形: 致死ダメージ耐え効果所持判定 */
export function hasDeathProtection(relics: RelicInstance[]): boolean {
  return relics.some(r => r.passiveEffect.type === 'deathProtection')
}
