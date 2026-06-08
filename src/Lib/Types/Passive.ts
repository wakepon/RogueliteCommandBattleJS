/** パッシブ効果タイプ */
export type PassiveEffectType =
  // 既存
  | { type: 'statBonus'; stat: 'str' | 'int'; value: number }
  | { type: 'weaponDamageBonus'; value: number }
  | { type: 'lowHpDamageMultiplier'; hpThreshold: number; multiplier: number }
  // 新規
  | { type: 'weaponDurabilitySave'; chance: number }
  | { type: 'killStreakBonus'; multiplier: number }
  | { type: 'lastStrikeDamageMultiplier'; multiplier: number }
  | { type: 'lowMpDamageBonus'; mpThreshold: number; multiplier: number }
  | { type: 'thornsDamage'; value: number }
  | { type: 'regenPerTurn'; value: number }
  | { type: 'potionEffectMultiplier'; multiplier: number }
  // 3アーキタイプ用
  | { type: 'battleStartHpReduction'; rate: number; strBonus: number }  // 血の契約: 戦闘開始時HP削減+STR
  | { type: 'damageTakenToMp'; value: number }  // 苦痛のリング: 被弾時固定MP回復
  | { type: 'weaponBreakDamageMultiplier'; increment: number }  // 努力の証: 武器破壊時倍率蓄積
  | { type: 'weaponBreakNextAttackBonus'; value: number }  // 鍛冶師の金槌: 武器破壊後Power加算
  // EXP・防御系
  | { type: 'levelUpDamageBoost'; multiplier: number }  // 闘気の腕輪: 戦闘中レベルアップ時、次攻撃ダメージ倍率
  | { type: 'battleEndBonusExp'; expValue: number }  // 修羅の証: 戦闘後全員+EXP
  | { type: 'lowestLevelDamageMultiplier'; multiplier: number }  // 番狂わせの一撃: パーティ最低レベル者のダメージ倍率
  | { type: 'highHpTargetRateBonus'; value: number }  // 強い者いじめ: HP最大者の被弾率+N%
  | { type: 'deathProtection' }  // 身代わりの人形: 致死ダメージでHP1耐え、1ラン1回消滅
  | { type: 'growthGuarantee'; growthType: 'attack' | 'hp' | 'mp' | 'balance' | 'allBonus' }  // 成長方向保証: レベルアップ時に指定タイプを1枠確定
  // ビルドパス拡張
  | { type: 'thornsMultiplier'; multiplier: number }  // 棘の書: 棘バフの実効値を倍化
  | { type: 'comboBonus'; multiplier: number }  // 連携の紋章: 同ターン2人以上武器攻撃で全武器ダメ×multiplier
  | { type: 'potionSlotBonus'; value: number }  // 薬師の鞄: ポーション所持上限+N
  | { type: 'potionDurationMultiplier'; multiplier: number }  // ポーション効果ターンを倍化

/** パッシブ効果を持つアイテム */
export interface IPassiveEffect {
  passiveEffect: PassiveEffectType
}
