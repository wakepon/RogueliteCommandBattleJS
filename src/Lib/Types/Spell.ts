import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { ICommandable, ITargetable, TargetType } from './Command'
import { IMpCost } from './Consumable'

/** 魔法効果 */
export type SpellEffect =
  | { type: 'heal'; value: number }           // HP回復
  | { type: 'steal' }                         // ゴールドを盗む
  | { type: 'buff'; stat: 'str' | 'precision'; value: number; duration: 'battle' | 'nextAction' }  // バフ

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
