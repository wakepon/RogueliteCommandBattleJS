/** パッシブ効果タイプ */
export type PassiveEffectType =
  // 既存
  | { type: 'statBonus'; stat: 'str' | 'int'; value: number }
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
  // 3アーキタイプ用
  | { type: 'battleStartHpReduction'; rate: number; strBonus: number }  // 血の契約: 戦闘開始時HP削減+STR
  | { type: 'damageTakenToMp'; rate: number }  // 苦痛のリング: 被ダメ→MP変換
  | { type: 'goldPerKill'; value: number }  // 商人の護符: キル時ゴールド
  | { type: 'weaponBreakDamageMultiplier'; increment: number }  // 不死鳥の残り火: 武器破壊時倍率蓄積
  | { type: 'weaponBreakNextAttackBonus'; value: number }  // 鍛冶師の金槌: 武器破壊後Power加算

/** パッシブ効果を持つアイテム */
export interface IPassiveEffect {
  passiveEffect: PassiveEffectType
}
