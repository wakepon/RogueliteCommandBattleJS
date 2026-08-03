import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { ICommandable, ITargetable } from './Command'
import { ISingleUse } from './Consumable'

/** ポーション効果 */
export type PotionEffect =
  | { type: 'healHp'; value: number; full?: boolean }   // full=true でHPを全回復
  | { type: 'repairWeapons'; value: number }
  // バフ系ポーション
  | { type: 'taunt' }  // 挑発: 被弾率100%（1ターン）
  | { type: 'statBoost'; strValue: number; intValue: number }  // 興奮: STR+N, INT+N（1ターン）
  | { type: 'damageReduction'; rate: number }  // 防御: 被ダメ×rate軽減（1ターン）
  | { type: 'aoeConvert' }  // 全体化: 次の1回の単体攻撃を全体化
  // 永続ステータス強化（種系）
  | { type: 'boostStr'; value: number }     // STR永続+N
  | { type: 'boostInt'; value: number }     // INT永続+N
  | { type: 'boostMaxHp'; value: number }   // maxHP永続+N
  | { type: 'boostMaxMp'; value: number }   // maxMP永続+N

/** ポーションデータ */
export interface PotionData extends IItem, IPurchasable, ICommandable, ITargetable, ISingleUse {
  commandCategory: 'potion'
  targetType: 'allySingle'
  effect: PotionEffect
}

/** ポーションインスタンス（状態を持たないためデータと同一） */
export type PotionInstance = PotionData
