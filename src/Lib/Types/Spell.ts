import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { ICommandable, ITargetable, TargetType } from './Command'
import { IMpCost } from './Consumable'
import { SpellEnhancement } from './Enhancement'

/** 魔法効果 */
export type SpellEffect =
  | { type: 'heal'; value: number }           // HP回復
  | { type: 'steal' }                         // ゴールドを盗む
  | { type: 'buff'; stat: 'str' | 'precision'; value: number; duration: 'battle' | 'nextAction' }  // バフ
  | { type: 'shield'; value: number }         // バリア: 被ダメ軽減
  | { type: 'hpToMp'; hpCostRate: number }    // 生命変換: 最大HP割合消費→MP全回復
  | { type: 'goldOnHit'; value: number }      // 金のまじない: ゴールド獲得
  | { type: 'goldDamage'; multiplier: number }  // ゴールドバースト: 所持金×倍率ダメージ（消費なし）
  | { type: 'repairWeapons'; value: number }  // 戦場の鍛冶: 武器耐久回復
  | { type: 'weaponPowerBuff'; value: number }  // 武器強化: 次の武器攻撃Power+N
  | { type: 'guidanceBuff'; bonusExp: number }  // 師弟の絆: 次のトドメでボーナスEXP
  | { type: 'killBonusExpToAll'; expAmount: number }  // 教育の魔弾: トドメで全員にボーナスEXP
  | { type: 'targetRateUp'; value: number }   // 祈り: 被ターゲット率UP

/** 魔法データ */
export interface SpellData extends IItem, IPurchasable, ICommandable, ITargetable, IMpCost {
  commandCategory: 'spell'
  targetType: TargetType
  power: number
  variance: number  // ダメージブレ幅（±variance の加算ブレ）
  effect?: SpellEffect | null
}

/** 魔法インスタンス */
export interface SpellInstance extends SpellData {
  enhancements: SpellEnhancement[]
}
