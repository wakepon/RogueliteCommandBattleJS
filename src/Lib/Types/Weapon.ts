import { IItem } from './Item'
import { IPurchasable } from './Purchasable'
import { ICommandable, ITargetable } from './Command'
import { IUseLimited } from './Consumable'
import { WeaponEnhancement } from './Enhancement'
import { getTuningValue } from '../Tuning/TuningStore'

/** 武器効果 */
export type WeaponEffect =
  | { type: 'lifesteal'; value: number }
  | { type: 'shield'; value: number }  // 守護の盾: 対象に被ダメ軽減シールド付与
  | { type: 'hpPercentDamage'; rate: number }  // 生命の拳: 最大HP×rate のダメージ
  | { type: 'currentHpDamage' }  // 捨て身の一撃: 現在HP-1 のダメージ、HPが1になる
  | { type: 'shieldBash' }  // 盾殴り: 攻撃者のシールド値をダメージに加算し、シールドを消費
  | { type: 'selfVulnerability'; multiplier: number; duration: number }  // 後隙の: 使用後被ダメ倍率デバフ
  | { type: 'killBonusExpToAll'; expAmount: number }  // 稽古の: トドメ時全員EXP付与
  | { type: 'followUp'; bonusPower: number }  // 追撃のナイフ: 味方が同ターン攻撃済みなら+bonusPower
  | { type: 'levelScale'; basePower: number }  // 成長のナイフ: Power = basePower + level
  | { type: 'combatStrGain'; value: number }  // 鍛錬のナイフ: 使用後STR+value(戦闘中永続)
  | { type: 'targetHpConditional'; hpThreshold: number; bonusPower: number }  // 処刑の大剣: 対象HP≤threshold%で+bonusPower
  | { type: 'selfHpConditional'; hpThreshold: number; bonusPower: number }  // 怒りの大剣: 自身HP≤threshold%で+bonusPower
  | { type: 'lifestealPercent'; rate: number }  // 吸血の杖: ダメージのrate%をHP回復
  | { type: 'manaSteal'; rate: number }  // 吸魔の杖: ダメージのrate%をMP回復
  | { type: 'thornsShield'; shieldValue: number; thornsDuration: number }  // 棘の盾: シールド+反撃1T
  | { type: 'aoe' }  // 旋風剣: 全体攻撃

/** 武器データ（マスター） */
export interface WeaponData extends IItem, IPurchasable, ICommandable, ITargetable, IUseLimited {
  commandCategory: 'weapon'
  category?: 'knife' | 'greatsword' | 'staff' | 'shield' | 'other'  // 武器カテゴリ
  power: number
  variance: number  // ダメージブレ幅（±variance の加算ブレ）
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
