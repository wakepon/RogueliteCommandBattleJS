/** パッシブ効果タイプ */
export type PassiveEffectType =
  // デメリット変換
  | { type: 'hpCostPowerBoost'; powerBonus: number; duration: number }  // 修羅の血脈: HP消費武器使用時Power+N
  | { type: 'vulnerabilityPowerBoost'; powerBonus: number }  // 逆境の鎧: 被ダメ増加中Power+N
  | { type: 'mpSpendShield'; mpThreshold: number; shieldValue: number }  // 魔力の残滓: MP累計消費≥threshold時シールド付与
  // 条件付きバフ
  | { type: 'knifeUseDurabilityRestore'; usesRequired: number; restoreAmount: number }  // 研ぎ師の名刺: ナイフN回使用で耐久回復
  | { type: 'frontRowIntBonus'; value: number }  // 前衛の矜持: 前衛時INT+N
  | { type: 'backRowStrBonus'; value: number }  // 後衛の底力: 後衛時STR+N
  | { type: 'shieldTaunt'; value: number }  // 挑発式防御: シールド付与時被ターゲット率+N
  | { type: 'comboAttackBonus'; requiredCount: number; statBonus: number }  // 連携の紋章: 同ターンN人以上攻撃でSTR/INT+bonus
  | { type: 'levelUpStatBoost'; strBonus: number; intBonus: number }  // 闘気の腕輪: レベルアップ時STR/INT追加上昇
  | { type: 'brokenWeaponStatBonus'; strPerWeapon: number }  // 努力の証: 壊れた武器1本につきSTR+N
  // リソース変換
  | { type: 'battleStartHpReduction'; rate: number; strBonus: number }  // 血の契約: 戦闘開始時HP削減+STR
  | { type: 'deathProtection' }  // 身代わりの人形: 致死ダメージでHP1耐え、1ラン1回消滅
  // シンプルバフ
  | { type: 'regenPerTurn'; value: number }  // 再生のコケ: 毎ターンHP回復
  | { type: 'weaponDurabilitySave'; chance: number }  // 武器お手入れ用油: 耐久消費をchance%で回避
  | { type: 'battleEndBonusExp'; expValue: number }  // 修羅の証: 戦闘後全員+EXP
  | { type: 'thornsStackBonus'; value: number }  // 棘の書: 棘スタック追加+N
  | { type: 'potionEffectMultiplier'; multiplier: number }  // 錬金術の触媒: ポーション効果倍化
  | { type: 'potionSlotBonus'; value: number }  // 薬師の鞄: ポーション所持上限+N

/** パッシブ効果を持つアイテム */
export interface IPassiveEffect {
  passiveEffect: PassiveEffectType
}
