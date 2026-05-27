import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { ICommandable, ITargetable } from './Command'
import { ISingleUse } from './Consumable'

/** ポーション効果 */
export type PotionEffect =
  | { type: 'healHp'; value: number }
  | { type: 'healMp'; value: number }
  | { type: 'repairWeapons'; value: number }
  // バフ系ポーション
  | { type: 'taunt' }  // 挑発: 被弾率100%（1ターン）
  | { type: 'statBoost'; strValue: number; intValue: number }  // 興奮: STR+N, INT+N（1ターン）
  | { type: 'damageReduction'; rate: number }  // 防御: 被ダメ×rate軽減（1ターン）
  | { type: 'aoeConvert' }  // 全体化: 次の1回の単体攻撃を全体化

/** ポーションデータ */
export interface PotionData extends IItem, IPurchasable, ICommandable, ITargetable, ISingleUse {
  commandCategory: 'potion'
  targetType: 'allySingle'
  effect: PotionEffect
}

/** ポーションインスタンス（状態を持たないためデータと同一） */
export type PotionInstance = PotionData
