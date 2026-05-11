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
  | { type: 'weaponBreakDamageMultiplier'; increment: number }  // 努力の証: 武器破壊時倍率蓄積
  | { type: 'weaponBreakNextAttackBonus'; value: number }  // 鍛冶師の金槌: 武器破壊後Power加算
  // EXP・防御系
  | { type: 'levelUpDamageBoost'; multiplier: number }  // 闘気の腕輪: 戦闘中レベルアップ時、次攻撃ダメージ倍率
  | { type: 'battleEndBonusExp'; expValue: number; goldPenalty: number }  // 修羅の証: 戦闘後全員+EXP、ゴールド-N
  | { type: 'lowestLevelDamageMultiplier'; multiplier: number }  // 番狂わせの一撃: パーティ最低レベル者のダメージ倍率
  | { type: 'highHpTargetRateBonus'; value: number }  // 強い者いじめ: HP最大者の被弾率+N%
  | { type: 'deathProtection' }  // 身代わりの人形: 致死ダメージでHP1耐え、1ラン1回消滅

/** パッシブ効果を持つアイテム */
export interface IPassiveEffect {
  passiveEffect: PassiveEffectType
}
