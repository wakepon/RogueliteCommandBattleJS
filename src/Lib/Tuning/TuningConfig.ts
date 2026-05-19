export const TUNING_SCHEMA_VERSION = 1

/** 全チューニングパラメータの型定義 */
export interface TuningConfig {
  // キャラクター初期ステータス
  readonly warrior_hp: number
  readonly warrior_mp: number
  readonly warrior_str: number
  readonly warrior_int: number
  readonly warrior_weaponSlotCount: number
  readonly warrior_magicSlotCount: number
  readonly mage_hp: number
  readonly mage_mp: number
  readonly mage_str: number
  readonly mage_int: number
  readonly mage_weaponSlotCount: number
  readonly mage_magicSlotCount: number
  readonly cleric_hp: number
  readonly cleric_mp: number
  readonly cleric_str: number
  readonly cleric_int: number
  readonly cleric_weaponSlotCount: number
  readonly cleric_magicSlotCount: number

  // レベルアップ
  readonly levelup_formula_coefficient: number
  readonly warrior_growth_maxHp: number
  readonly warrior_growth_maxMp: number
  readonly warrior_growth_str: number
  readonly warrior_growth_int: number
  readonly mage_growth_maxHp: number
  readonly mage_growth_maxMp: number
  readonly mage_growth_str: number
  readonly mage_growth_int: number
  readonly cleric_growth_maxHp: number
  readonly cleric_growth_maxMp: number
  readonly cleric_growth_str: number
  readonly cleric_growth_int: number
  readonly levelup_required_kills_cap: number
  readonly levelup_hp_recovery_rate: number
  readonly levelup_mp_recovery_rate: number

  // 武器・基本攻撃
  readonly punch_power: number
  readonly punch_variance: number
  readonly magic_bullet_power: number
  readonly magic_bullet_variance: number

  // バトルメカニクス
  readonly poison_damage_per_tick: number
  readonly charge_multiplier: number
  readonly front_position_weight: number
  readonly back_position_weight: number
  readonly buff_multiplier_per_point: number

  // 報酬・経済
  readonly gold_reward_normal: number
  readonly gold_reward_elite: number
  readonly gold_reward_boss: number
  readonly gold_reward_boss_minor: number
  readonly interest_cap_default: number
  readonly store_category_slots: number
  readonly base_reroll_cost: number
  readonly max_relic_count: number
  readonly max_potion_count: number

  // イベント
  readonly rest_heal_percent: number

  // レリック
  readonly phoenix_ember_increment: number

  // 第二階層
  readonly floor_2_hp_multiplier: number
  readonly floor_2_damage_multiplier: number
  readonly floor_2_rare_rate: number

  // 第三階層
  readonly floor_3_hp_multiplier: number
  readonly floor_3_damage_multiplier: number
  readonly floor_3_rare_rate: number
}

/** BroadcastChannelメッセージ型 */
export type TuningChannelMessage =
  | { type: 'request-sync' }
  | {
      type: 'full-sync'
      version: number
      revision: number
      senderId: string
      state: Record<string, unknown>
    }
  | {
      type: 'batch-update'
      version: number
      revision: number
      senderId: string
      state: Record<string, unknown>
    }
