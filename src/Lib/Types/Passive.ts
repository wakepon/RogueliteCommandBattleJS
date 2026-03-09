/** パッシブ効果タイプ */
export type PassiveEffectType =
  // 既存
  | { type: 'statBonus'; stat: 'str' | 'int' | 'agi'; value: number }
  | { type: 'weaponDamageBonus'; value: number }
  | { type: 'interestCap'; value: number }
  | { type: 'lowHpDamageMultiplier'; hpThreshold: number; multiplier: number }
  // 新規
  | { type: 'firstHitShield' }
  | { type: 'weaponDurabilitySave'; chance: number }
  | { type: 'weaponAttackMpRecover'; value: number; excludeWeaponId?: string }
  | { type: 'killStreakBonus'; multiplier: number }
  | { type: 'lastStrikeDamageMultiplier'; multiplier: number }
  | { type: 'lowMpDamageBonus'; mpThreshold: number; multiplier: number }
  | { type: 'thornsDamage'; value: number }
  | { type: 'regenPerTurn'; value: number }
  | { type: 'potionEffectMultiplier'; multiplier: number }

/** パッシブ効果を持つアイテム */
export interface IPassiveEffect {
  passiveEffect: PassiveEffectType
}
