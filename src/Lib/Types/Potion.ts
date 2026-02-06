import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { ICommandable, ITargetable } from './Command'
import { ISingleUse } from './Consumable'

/** ポーション効果 */
export type PotionEffect =
  | { type: 'healHp'; value: number }
  | { type: 'healMp'; value: number }

/** ポーションデータ */
export interface PotionData extends IItem, IPurchasable, ICommandable, ITargetable, ISingleUse {
  commandCategory: 'potion'
  targetType: 'allySingle'
  effect: PotionEffect
}

/** ポーションインスタンス（状態を持たないためデータと同一） */
export type PotionInstance = PotionData
