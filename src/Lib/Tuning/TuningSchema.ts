/** UIコントロール型 */
export type TuningControl =
  | { type: 'number'; min: number; max: number; step: number }
  | { type: 'slider'; min: number; max: number; step: number }
  | { type: 'toggle' }

/** 調整項目のメタデータ */
export interface TuningFieldMeta {
  readonly key: string
  readonly label: string
  readonly category: string
  readonly defaultValue: unknown
  readonly control: TuningControl
}

/** カテゴリ表示名 */
export const TUNING_CATEGORIES: Record<string, string> = {
  character: 'キャラクター',
  levelup: 'レベルアップ',
  weapon: '武器・基本攻撃',
  battle: 'バトル',
  economy: '報酬・経済',
  event: 'イベント',
}

/** 全調整項目のスキーマ定義 */
export const TUNING_SCHEMA: readonly TuningFieldMeta[] = [
  // === キャラクター初期ステータス ===
  // 戦士
  { key: 'warrior_hp', label: '戦士 HP', category: 'character', defaultValue: 60, control: { type: 'number', min: 1, max: 999, step: 1 } },
  { key: 'warrior_mp', label: '戦士 MP', category: 'character', defaultValue: 5, control: { type: 'number', min: 0, max: 999, step: 1 } },
  { key: 'warrior_str', label: '戦士 STR', category: 'character', defaultValue: 7, control: { type: 'slider', min: 0, max: 30, step: 1 } },
  { key: 'warrior_int', label: '戦士 INT', category: 'character', defaultValue: 3, control: { type: 'slider', min: 0, max: 30, step: 1 } },
  { key: 'warrior_weaponSlotCount', label: '戦士 武器枠', category: 'character', defaultValue: 4, control: { type: 'number', min: 0, max: 10, step: 1 } },
  { key: 'warrior_magicSlotCount', label: '戦士 魔法枠', category: 'character', defaultValue: 0, control: { type: 'number', min: 0, max: 10, step: 1 } },
  // 魔法使い
  { key: 'mage_hp', label: '魔法使い HP', category: 'character', defaultValue: 30, control: { type: 'number', min: 1, max: 999, step: 1 } },
  { key: 'mage_mp', label: '魔法使い MP', category: 'character', defaultValue: 25, control: { type: 'number', min: 0, max: 999, step: 1 } },
  { key: 'mage_str', label: '魔法使い STR', category: 'character', defaultValue: 3, control: { type: 'slider', min: 0, max: 30, step: 1 } },
  { key: 'mage_int', label: '魔法使い INT', category: 'character', defaultValue: 7, control: { type: 'slider', min: 0, max: 30, step: 1 } },
  { key: 'mage_weaponSlotCount', label: '魔法使い 武器枠', category: 'character', defaultValue: 0, control: { type: 'number', min: 0, max: 10, step: 1 } },
  { key: 'mage_magicSlotCount', label: '魔法使い 魔法枠', category: 'character', defaultValue: 4, control: { type: 'number', min: 0, max: 10, step: 1 } },
  // 僧侶
  { key: 'cleric_hp', label: '僧侶 HP', category: 'character', defaultValue: 40, control: { type: 'number', min: 1, max: 999, step: 1 } },
  { key: 'cleric_mp', label: '僧侶 MP', category: 'character', defaultValue: 15, control: { type: 'number', min: 0, max: 999, step: 1 } },
  { key: 'cleric_str', label: '僧侶 STR', category: 'character', defaultValue: 4, control: { type: 'slider', min: 0, max: 30, step: 1 } },
  { key: 'cleric_int', label: '僧侶 INT', category: 'character', defaultValue: 5, control: { type: 'slider', min: 0, max: 30, step: 1 } },
  { key: 'cleric_weaponSlotCount', label: '僧侶 武器枠', category: 'character', defaultValue: 1, control: { type: 'number', min: 0, max: 10, step: 1 } },
  { key: 'cleric_magicSlotCount', label: '僧侶 魔法枠', category: 'character', defaultValue: 3, control: { type: 'number', min: 0, max: 10, step: 1 } },

  // === レベルアップ ===
  { key: 'levelup_formula_coefficient', label: '必要討伐数 係数', category: 'levelup', defaultValue: 3, control: { type: 'slider', min: 1, max: 10, step: 0.5 } },
  // 戦士成長値
  { key: 'warrior_growth_maxHp', label: '戦士 HP成長', category: 'levelup', defaultValue: 7, control: { type: 'number', min: 0, max: 30, step: 1 } },
  { key: 'warrior_growth_maxMp', label: '戦士 MP成長', category: 'levelup', defaultValue: 1, control: { type: 'number', min: 0, max: 30, step: 1 } },
  { key: 'warrior_growth_str', label: '戦士 STR成長', category: 'levelup', defaultValue: 2, control: { type: 'number', min: 0, max: 10, step: 1 } },
  { key: 'warrior_growth_int', label: '戦士 INT成長', category: 'levelup', defaultValue: 0, control: { type: 'number', min: 0, max: 10, step: 1 } },
  // 魔法使い成長値
  { key: 'mage_growth_maxHp', label: '魔法使い HP成長', category: 'levelup', defaultValue: 3, control: { type: 'number', min: 0, max: 30, step: 1 } },
  { key: 'mage_growth_maxMp', label: '魔法使い MP成長', category: 'levelup', defaultValue: 4, control: { type: 'number', min: 0, max: 30, step: 1 } },
  { key: 'mage_growth_str', label: '魔法使い STR成長', category: 'levelup', defaultValue: 0, control: { type: 'number', min: 0, max: 10, step: 1 } },
  { key: 'mage_growth_int', label: '魔法使い INT成長', category: 'levelup', defaultValue: 2, control: { type: 'number', min: 0, max: 10, step: 1 } },
  // 僧侶成長値
  { key: 'cleric_growth_maxHp', label: '僧侶 HP成長', category: 'levelup', defaultValue: 5, control: { type: 'number', min: 0, max: 30, step: 1 } },
  { key: 'cleric_growth_maxMp', label: '僧侶 MP成長', category: 'levelup', defaultValue: 3, control: { type: 'number', min: 0, max: 30, step: 1 } },
  { key: 'cleric_growth_str', label: '僧侶 STR成長', category: 'levelup', defaultValue: 1, control: { type: 'number', min: 0, max: 10, step: 1 } },
  { key: 'cleric_growth_int', label: '僧侶 INT成長', category: 'levelup', defaultValue: 1, control: { type: 'number', min: 0, max: 10, step: 1 } },

  // === 武器・基本攻撃 ===
  { key: 'punch_power', label: 'パンチ 威力', category: 'weapon', defaultValue: 1, control: { type: 'number', min: 0, max: 50, step: 0.5 } },
  { key: 'punch_variance', label: 'パンチ ブレ幅', category: 'weapon', defaultValue: 2, control: { type: 'number', min: 0, max: 20, step: 0.5 } },
  { key: 'magic_bullet_power', label: '魔力弾 威力', category: 'weapon', defaultValue: 1, control: { type: 'number', min: 0, max: 50, step: 0.5 } },
  { key: 'magic_bullet_variance', label: '魔力弾 ブレ幅', category: 'weapon', defaultValue: 2, control: { type: 'number', min: 0, max: 20, step: 0.5 } },

  // === バトルメカニクス ===
  { key: 'poison_damage_per_tick', label: '毒ダメージ/tick', category: 'battle', defaultValue: 2, control: { type: 'number', min: 0, max: 20, step: 1 } },
  { key: 'charge_multiplier', label: '力溜め倍率', category: 'battle', defaultValue: 2.0, control: { type: 'number', min: 1.0, max: 5.0, step: 0.1 } },
  { key: 'front_position_weight', label: '前衛ターゲット重み', category: 'battle', defaultValue: 2, control: { type: 'number', min: 1, max: 10, step: 1 } },
  { key: 'back_position_weight', label: '後衛ターゲット重み', category: 'battle', defaultValue: 1, control: { type: 'number', min: 1, max: 10, step: 1 } },
  { key: 'buff_multiplier_per_point', label: 'バフ倍率/pt', category: 'battle', defaultValue: 0.1, control: { type: 'number', min: 0.01, max: 1.0, step: 0.01 } },

  // === 報酬・経済 ===
  { key: 'gold_reward_normal', label: '通常敵 報酬G', category: 'economy', defaultValue: 3, control: { type: 'number', min: 0, max: 50, step: 1 } },
  { key: 'gold_reward_elite', label: 'エリート敵 報酬G', category: 'economy', defaultValue: 5, control: { type: 'number', min: 0, max: 50, step: 1 } },
  { key: 'gold_reward_boss', label: 'ボス 報酬G', category: 'economy', defaultValue: 10, control: { type: 'number', min: 0, max: 100, step: 1 } },
  { key: 'interest_cap_default', label: '利子上限(通常)', category: 'economy', defaultValue: 5, control: { type: 'number', min: 0, max: 30, step: 1 } },
  { key: 'interest_cap_piggybank', label: '利子上限(貯金箱)', category: 'economy', defaultValue: 10, control: { type: 'number', min: 0, max: 30, step: 1 } },
  { key: 'store_category_slots', label: 'ショップ各カテゴリ枠数', category: 'economy', defaultValue: 3, control: { type: 'number', min: 1, max: 6, step: 1 } },
  { key: 'base_reroll_cost', label: 'リロール基本コスト', category: 'economy', defaultValue: 3, control: { type: 'number', min: 0, max: 20, step: 1 } },
  { key: 'max_relic_count', label: 'レリック所持上限', category: 'economy', defaultValue: 5, control: { type: 'number', min: 1, max: 20, step: 1 } },
  { key: 'max_potion_count', label: 'ポーション所持上限', category: 'economy', defaultValue: 2, control: { type: 'number', min: 1, max: 10, step: 1 } },

  // === イベント ===
  { key: 'rest_heal_percent', label: '休憩回復率', category: 'event', defaultValue: 0.5, control: { type: 'slider', min: 0.1, max: 1.0, step: 0.05 } },
]
