import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { ICommandable, ITargetable, TargetType } from './Command'
import { IMpCost } from './Consumable'

/** 魔法効果 */
export type SpellEffect =
  | { type: 'heal'; value: number }           // HP回復
  | { type: 'steal' }                         // ゴールドを盗む
  | { type: 'buff'; stat: 'str' | 'precision'; value: number; duration: 'battle' | 'nextAction' }  // バフ
  | { type: 'shield'; value: number }         // バリア: 被ダメ軽減
  | { type: 'hpToMp'; hpCost: number; mpGain: number }  // 生命変換: HP→MP
  | { type: 'goldOnHit'; value: number }      // 金のまじない: ゴールド獲得
  | { type: 'goldDamage'; rate: number; multiplier: number }  // ゴールドバースト: ゴールド消費→ダメ
  | { type: 'repairWeapons'; value: number }  // 戦場の鍛冶: 武器耐久回復
  | { type: 'weaponPowerBuff'; value: number }  // 武器強化: 次の武器攻撃Power+N
  | { type: 'guidanceBuff' }                    // 師弟の絆: 次のトドメで+1ボーナスEXP
  | { type: 'killBonusExpToAll' }               // 教育の魔弾: トドメでトドメボーナスEXPを全員に

/** 魔法データ */
export interface SpellData extends IItem, IPurchasable, ICommandable, ITargetable, IMpCost {
  commandCategory: 'spell'
  targetType: TargetType
  power: number
  variance: number  // ダメージブレ幅（±variance の加算ブレ）
  effect?: SpellEffect | null
}

/** 魔法インスタンス（状態を持たないためデータと同一） */
export type SpellInstance = SpellData
