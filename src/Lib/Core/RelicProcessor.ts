import { RelicInstance } from '../Types/Relic'
import { PassiveEffectType } from '../Types/Passive'
import { ExplorerState } from '../Types/Explorer'

/** 全レリックの効果一覧を取得 */
export function getRelicEffects(relics: RelicInstance[]): PassiveEffectType[] {
  return relics.map(r => r.passiveEffect)
}

/** 特定効果の所持判定 */
export function hasRelicEffect(
  relics: RelicInstance[],
  type: PassiveEffectType['type']
): boolean {
  return relics.some(r => r.passiveEffect.type === type)
}

/** ステータスボーナス合算（str/int/agi） */
export function getStatBonus(
  relics: RelicInstance[],
  stat: 'str' | 'int' | 'agi'
): number {
  return relics.reduce((sum, r) => {
    if (r.passiveEffect.type === 'statBonus' && r.passiveEffect.stat === stat) {
      return sum + r.passiveEffect.value
    }
    return sum
  }, 0)
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

/** interestCap値を取得（未所持なら0） */
export function getInterestCapBonus(relics: RelicInstance[]): number {
  for (const r of relics) {
    if (r.passiveEffect.type === 'interestCap') {
      return r.passiveEffect.value
    }
  }
  return 0
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

/** weaponAttackMpRecover の値を取得 */
export function getWeaponAttackMpRecover(relics: RelicInstance[]): { value: number; excludeWeaponId?: string } | null {
  for (const r of relics) {
    if (r.passiveEffect.type === 'weaponAttackMpRecover') {
      return {
        value: r.passiveEffect.value,
        excludeWeaponId: r.passiveEffect.excludeWeaponId,
      }
    }
  }
  return null
}
