import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { ICommandable, ITargetable } from './Command'
import { IUseLimited } from './Consumable'
import { getTuningValue } from '../Tuning/TuningStore'

/** 武器効果 */
export type WeaponEffect =
  | { type: 'lifesteal'; value: number }
  | { type: 'conditionalPower'; hpThreshold: number; bonusPower: number }  // HP条件でPower増加
  | { type: 'shield'; value: number }  // 守護の盾: 対象に被ダメ軽減シールド付与
  | { type: 'killPreserveDurability' }  // 魂喰いの剣: トドメを刺すと耐久を消費しない

/** 武器データ（マスター） */
export interface WeaponData extends IItem, IPurchasable, ICommandable, ITargetable, IUseLimited {
  commandCategory: 'weapon'
  power: number
  variance: number  // ダメージブレ幅（±variance の加算ブレ）
  goldCost?: number
  hpCost?: number
  hits?: number     // 複数ヒット数（三節棍等）
  effect?: WeaponEffect
  scaleStat?: 'str' | 'int'  // ダメージ計算に使うステータス（デフォルト: str）
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
  variance: number
  maxUses: null
  currentUses: null
}

/** パンチのインスタンスを生成（Tuningで威力調整可能） */
export function createPunch(): PunchInstance {
  return {
    id: 'punch',
    name: 'パンチ',
    commandCategory: 'weapon',
    targetType: 'enemySingle',
    power: getTuningValue('punch_power', 1),
    variance: getTuningValue('punch_variance', 2),
    maxUses: null,
    currentUses: null,
  }
}

export type ExplorerWeapon = WeaponInstance | PunchInstance
