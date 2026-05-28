import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { ICommandable, ITargetable } from './Command'
import { IUseLimited } from './Consumable'
import { WeaponEnhancement } from './Enhancement'
import { getTuningValue } from '../Tuning/TuningStore'

/** 武器効果 */
export type WeaponEffect =
  | { type: 'lifesteal'; value: number }
  | { type: 'conditionalPower'; hpThreshold: number; bonusPower: number }  // HP条件でPower増加
  | { type: 'shield'; value: number }  // 守護の盾: 対象に被ダメ軽減シールド付与
  | { type: 'killPreserveDurability' }  // 魂喰いの剣: トドメを刺すと耐久を消費しない
  | { type: 'hpPercentDamage'; rate: number }  // 生命の拳: 最大HP×rate のダメージ
  | { type: 'hpPercentShieldAll'; rate: number }  // 護りの壁: 味方全員に最大HP×rate のシールド
  | { type: 'currentHpDamage' }  // 捨て身の一撃: 現在HP-1 のダメージ、HPが1になる
  | { type: 'shieldBash' }  // シールドバッシュ: 攻撃者のシールド値をダメージに加算し、シールドを消費
  | { type: 'goldOnHit'; value: number }  // 打ち出の: 使用時にゴールド獲得
  | { type: 'selfVulnerability'; multiplier: number; duration: number }  // 後隙の: 使用後被ダメ倍率デバフ
  | { type: 'killBonusExpToAll'; expAmount: number }  // 稽古の: トドメ時全員EXP付与

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
  enhancements: WeaponEnhancement[]
  noRepair?: boolean  // 強化デメリット: 耐久値回復不可
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
