import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { IPassiveEffect } from './Passive'

/** レリックデータ */
export interface RelicData extends IItem, IPurchasable, IPassiveEffect {}

/** レリックインスタンス（状態を持たないためデータと同一） */
export type RelicInstance = RelicData
