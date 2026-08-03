import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { ICommandable, ITargetable, TargetType } from './Command'
import { IMpCost, IUseLimited } from './Consumable'
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
  | { type: 'mpPercentShield'; rate: number }  // 旧・魔力の盾: 最大MP×rate のシールド付与（互換）
  | { type: 'scalingShieldInt'; base: number; intMultiplier: number }  // 魔力の盾: シールド(base + INT×intMultiplier)付与
  | { type: 'mpAllDamage' }                    // 旧・魔力放出: 現在MP全消費→MPぶんのダメージ（互換）
  | { type: 'thorns'; value: number }           // 棘付与: 味方に棘スタック付与（ターン終了リセット、蓄積可、被弾時反射）
  | { type: 'followUp'; coefficient: number }  // 旧・追撃の炎: 先行攻撃回数×coefficientをPower加算（互換）
  | { type: 'allyFollowUpBonus'; requiredCount: number; powerBonus: number }  // 追撃の炎: 先行味方攻撃がrequiredCount回以上でPower+powerBonus
  | { type: 'targetHpConditional'; coefficient: number }  // 旧・処刑の雷: 敵が失ったHP割合×coefficientをPower加算（互換）
  | { type: 'lowMpConditional'; coefficient: number }  // 旧・渇きの火: 消費済みMP割合×coefficientをPower加算（互換）
  | { type: 'revengeDamage'; coefficient: number }  // 旧・復讐の氷弾: 前ターン被ダメ×coefficientをPower加算（互換）
  | { type: 'revengeFlat'; powerBonus: number }  // 復讐の氷弾: 前ターン被ダメを受けていたらPower+powerBonus
  | { type: 'recoilSelfDamage'; rate: number }  // 反動フレイム: 使用後、与ダメ×rateの自傷
  | { type: 'recoilMpDrain'; rate: number }  // 渇きの火: 使用後、与ダメ×rateのMP減少
  | { type: 'repairLastWeapon'; value: number }  // 戦場の鍛冶: 対象が最後に使った武器の耐久をvalue回復
  | { type: 'healMp'; value: number }  // MPチャージ: 対象のMPをvalue回復
  | { type: 'revive'; hp: number }  // 蘇生呪文: 戦闘不能の対象をHP=hpで復活

/** 魔法データ */
// NoMP化: 魔法は武器と同じ耐久値(maxUses/currentUses)で消費する。
// mpCost/mpCostRate は表示互換のため残置（MP消費の実処理・ゲート判定では未使用）。
export interface SpellData extends IItem, IPurchasable, ICommandable, ITargetable, IMpCost, IUseLimited {
  commandCategory: 'spell'
  targetType: TargetType
  power: number
  variance: number  // ダメージブレ幅（±variance の加算ブレ）
  effect?: SpellEffect | null
  mpCostRate?: number  // 旧・最大MP割合コスト（表示互換用の残置。消費判定には不使用）
  hpCost?: number     // HP消費（反動魔法用）
  slotFree?: boolean  // trueなら魔法枠を消費しない（魔力弾・祈り等、パンチ相当）
}

/** 魔法インスタンス */
export interface SpellInstance extends SpellData {
  currentUses: number | null  // 残り使用回数（耐久）。nullは無制限（魔力弾・祈り）
  enhancements: SpellEnhancement[]
}
