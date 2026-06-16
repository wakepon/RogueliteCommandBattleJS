import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { ICommandable, ITargetable, TargetType } from './Command'
import { IMpCost } from './Consumable'
import { SpellEnhancement } from './Enhancement'

/** 魔法効果 */
export type SpellEffect =
  | { type: 'heal'; value: number }           // HP回復
  | { type: 'buff'; stat: 'str' | 'precision'; value: number; duration: 'battle' | 'nextAction' }  // バフ
  | { type: 'shield'; value: number }         // バリア: 被ダメ軽減
  | { type: 'repairWeapons'; value: number }  // 戦場の鍛冶: 武器耐久回復
  | { type: 'weaponPowerBuff'; value: number }  // 武器強化: 次の武器攻撃Power+N
  | { type: 'killBonusExpToAll'; expAmount: number }  // お手本ファイア: トドメで全員にボーナスEXP
  | { type: 'targetRateUp'; value: number }   // 祈り: 被ターゲット率UP
  | { type: 'mpPercentShield'; rate: number }  // 魔力の盾: 最大MP×rate のシールド付与
  | { type: 'mpAllDamage' }                    // 魔力放出: 現在MP全消費→MPぶんのダメージ
  | { type: 'thorns'; value: number }           // 棘付与: 味方に棘バフ付与（バトル中持続、蓄積、被弾時に反撃）
  | { type: 'followUp'; bonusPower: number }  // 追撃の炎: 味方が同ターン攻撃済みなら+bonusPower
  | { type: 'targetHpConditional'; hpThreshold: number; bonusPower: number }  // 処刑の雷: 対象HP≤threshold%で+bonusPower
  | { type: 'lowMpConditional'; mpThreshold: number; bonusPower: number }  // 渇きの火: MP≤threshold%で+bonusPower

/** 魔法データ */
export interface SpellData extends IItem, IPurchasable, ICommandable, ITargetable, IMpCost {
  commandCategory: 'spell'
  targetType: TargetType
  power: number
  variance: number  // ダメージブレ幅（±variance の加算ブレ）
  effect?: SpellEffect | null
  mpCostRate?: number  // 最大MP割合コスト（0.5 = 50%消費、1.0 = 全消費）
  hpCost?: number     // HP消費（反動魔法用）
  slotFree?: boolean  // trueなら魔法枠を消費しない（魔力弾・祈り等、パンチ相当）
}

/** 魔法インスタンス */
export interface SpellInstance extends SpellData {
  enhancements: SpellEnhancement[]
}
