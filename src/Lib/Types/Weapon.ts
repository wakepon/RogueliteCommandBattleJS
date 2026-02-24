import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { ICommandable, ITargetable } from './Command'
import { IUseLimited } from './Consumable'

/** 武器効果 */
export type WeaponEffect = { type: 'lifesteal'; value: number }

/** 武器データ（マスター） */
export interface WeaponData extends IItem, IPurchasable, ICommandable, ITargetable, IUseLimited {
  commandCategory: 'weapon'
  power: number
  goldCost?: number
  hpCost?: number
  effect?: WeaponEffect
}

/** 武器インスタンス */
export interface WeaponInstance extends WeaponData {
  currentUses: number | null  // nullは無制限使用
}

/** パンチ */
export interface PunchInstance {
  id: 'punch'
  name: 'パンチ'
  commandCategory: 'weapon'
  targetType: 'enemySingle'
  power: number
  maxUses: null
  currentUses: null
}

export const PUNCH: PunchInstance = {
  id: 'punch',
  name: 'パンチ',
  commandCategory: 'weapon',
  targetType: 'enemySingle',
  power: 1,  // STR × 1 = STR分のダメージ
  maxUses: null,
  currentUses: null,
}

export type ExplorerWeapon = WeaponInstance | PunchInstance
