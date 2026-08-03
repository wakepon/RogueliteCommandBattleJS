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
  | { type: 'followUp'; coefficient: number }  // 追撃のナイフ: 先行攻撃回数×coefficientをPower加算
  | { type: 'levelScale'; basePower: number }  // 成長のナイフ: Power = basePower + level
  | { type: 'combatStrGain'; value: number }  // 鍛錬のナイフ: 使用後STR+value(戦闘中永続)
  | { type: 'targetHpConditional'; coefficient: number }  // 処刑の大剣: 敵が失ったHP割合×coefficientをPower加算
  | { type: 'selfHpConditional'; coefficient: number }  // 怒りの大剣: 失ったHP割合×coefficientをPower加算
  | { type: 'revengeDamage'; coefficient: number }  // 復讐の氷弾(魔法)互換: 前ターン被ダメ×coefficientをPower加算
  | { type: 'revengeFlat'; powerBonus: number }  // 復讐の大剣: 前ターン被ダメを受けていたらPower+powerBonus
  | { type: 'lifestealPercent'; rate: number }  // 吸血の杖: ダメージのrate%をHP回復
  | { type: 'scalingShield'; base: number; strMultiplier: number }  // 守護の盾: シールド(base + STR×strMultiplier)付与
  | { type: 'thornsShield'; shieldBase: number; shieldStrMultiplier: number; thornStacks: number }  // 棘の盾: シールド(base + STR×mult)+棘スタック付与
  | { type: 'aoe' }  // 大鎌: 全体攻撃
  | { type: 'recoilSelfDamage'; rate: number }  // 反動の大剣/大鎌: 攻撃後、与えたダメージ(敵1体分)×rateの自傷
  | { type: 'hpThresholdBonus'; thresholdRate: number; powerBonus: number; when: 'below' | 'atLeast' }  // 怒りの大剣/余裕のナイフ: HP割合条件でPower+powerBonus
  | { type: 'allyFollowUpBonus'; requiredCount: number; powerBonus: number }  // 追撃のナイフ: 同ターンに先行味方攻撃がrequiredCount回以上ならPower+powerBonus
  | { type: 'breakCountBonus' }  // 破片の大剣: ラン中に耐久0になった回数をPower加算
  | { type: 'nextTurnStrGain'; value: number }  // 鍛錬のナイフ: 次のターンのみSTR+value

/** 武器データ（マスター） */
export interface WeaponData extends IItem, IPurchasable, ICommandable, ITargetable, IUseLimited {
  commandCategory: 'weapon'
  category?: 'knife' | 'greatsword' | 'staff' | 'shield' | 'other'  // 武器カテゴリ
  power: number
  variance: number  // ダメージブレ幅（ダメージ×variance の割合ブレ。例: 0.1=±10%, 0.2=±20%, 0.5=±50%）
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
    variance: getTuningValue('punch_variance', 0.1),
    maxUses: null,
    currentUses: null,
  }
}

export type ExplorerWeapon = WeaponInstance | PunchInstance
