// === 武器強化 ===
export type WeaponMeritType = 'powerUp' | 'lifesteal' | 'maxUsesUp' | 'mpRecovery'
export type WeaponDemeritType = 'hpCost' | 'attackDown' | 'maxUsesUpNoRepair' | 'goldCost' | 'mpCost'

export interface WeaponMerit {
  category: 'weaponMerit'
  type: WeaponMeritType
  value: number
}

export interface WeaponDemerit {
  category: 'weaponDemerit'
  type: WeaponDemeritType
  value: number
}

export interface WeaponEnhancement {
  merit: WeaponMerit
  demerit: WeaponDemerit
}

// === 魔法強化 ===
export type SpellMeritType = 'powerUp' | 'goldOnUse' | 'healOnUse' | 'killBonusExp' | 'becomeAoe'
export type SpellDemeritType = 'hpCostMpUp' | 'attackDownMpUp' | 'goldCostMpUp' | 'mpUp'

export interface SpellMerit {
  category: 'spellMerit'
  type: SpellMeritType
  value: number
}

export interface SpellDemerit {
  category: 'spellDemerit'
  type: SpellDemeritType
  value: number
  subValue?: number
}

export interface SpellEnhancement {
  merit: SpellMerit
  demerit: SpellDemerit
}

export type Enhancement = WeaponEnhancement | SpellEnhancement

export type WeaponEnhancementOption = { merit: WeaponMerit; demerit: WeaponDemerit }
export type SpellEnhancementOption = { merit: SpellMerit; demerit: SpellDemerit }
export type EnhancementOption = WeaponEnhancementOption | SpellEnhancementOption

export const ENHANCEMENT_COST = 3
export const MAX_ENHANCEMENTS_PER_ITEM = 3
export const MAX_ENHANCEMENTS_PER_SHOP = 2
export const ENHANCEMENT_WEAKNESS_VALUE = 30
