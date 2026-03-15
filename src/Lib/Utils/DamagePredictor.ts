import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponData } from '../Types/Weapon'
import { SpellInstance, SpellData } from '../Types/Spell'
import { RelicInstance } from '../Types/Relic'
import {
  getStatBonus,
  getWeaponDamageBonus,
  getLowHpDamageMultiplier,
  getKillStreakMultiplier,
  getLastStrikeMultiplier,
  getLowMpDamageMultiplier,
} from '../Core/RelicProcessor'

/** ダメージ予測範囲 */
export interface DamageRange {
  min: number
  max: number
  isBoosted: boolean
}

/**
 * ダメージ予測オプション
 *
 * includeConditionalRelics:
 *   - false (デフォルト): ショップ等で使用。条件付きレリック倍率を除外した基本ダメージを表示
 *   - true: バトル中で使用。現在のHP/MP/連続撃破等に基づくレリック倍率を含む
 */
export interface DamagePredictOptions {
  relics?: RelicInstance[]
  killStreakActive?: boolean
  includeConditionalRelics?: boolean
}

const VARIANCE_MIN = 0.90
const VARIANCE_MAX = 1.10

/** バフ倍率を計算する（DamageCalculator.tsと同じロジック） */
function calculateBuffMultiplier(explorer: ExplorerState, stat: 'str' | 'int'): number {
  const statBuffs = explorer.battleBuffs.filter(buff => buff.type === stat)
  const totalValue = statBuffs.reduce((sum, buff) => sum + buff.value, 0)
  return 1.0 + (totalValue * 0.1)
}

/** 武器ダメージ予測 */
export function predictWeaponDamage(
  explorer: ExplorerState,
  weapon: ExplorerWeapon | WeaponData,
  options: DamagePredictOptions = {}
): DamageRange {
  const { relics = [], killStreakActive = false, includeConditionalRelics = false } = options

  const strBonus = getStatBonus(relics, 'str')
  const weaponDmgBonus = getWeaponDamageBonus(relics)
  const effectiveStr = explorer.str + strBonus
  const buffMultiplier = calculateBuffMultiplier(explorer, 'str')

  let baseDamage = effectiveStr * (weapon.power + weaponDmgBonus) * buffMultiplier

  // 条件付きレリック倍率（バトル中のみ）
  let relicMultiplier = 1.0
  if (includeConditionalRelics) {
    relicMultiplier *= getLowHpDamageMultiplier(relics, explorer)
    if (killStreakActive) {
      relicMultiplier *= getKillStreakMultiplier(relics)
    }
    if ('currentUses' in weapon && weapon.currentUses === 1) {
      relicMultiplier *= getLastStrikeMultiplier(relics)
    }
  }

  baseDamage *= relicMultiplier

  const min = Math.max(0, Math.floor(baseDamage * VARIANCE_MIN))
  const max = Math.max(0, Math.floor(baseDamage * VARIANCE_MAX))

  const isBoosted = strBonus > 0
    || weaponDmgBonus > 0
    || buffMultiplier > 1.0
    || relicMultiplier > 1.0

  return { min, max, isBoosted }
}

/** 魔法ダメージ予測 */
export function predictSpellDamage(
  explorer: ExplorerState,
  spell: SpellInstance | SpellData,
  options: DamagePredictOptions = {}
): DamageRange {
  const { relics = [], includeConditionalRelics = false } = options

  const intBonus = getStatBonus(relics, 'int')
  const effectiveInt = explorer.int + intBonus
  const buffMultiplier = calculateBuffMultiplier(explorer, 'int')

  let baseDamage = effectiveInt * spell.power * buffMultiplier

  // 条件付きレリック倍率（バトル中のみ）
  let relicMultiplier = 1.0
  if (includeConditionalRelics) {
    relicMultiplier *= getLowHpDamageMultiplier(relics, explorer)
    relicMultiplier *= getLowMpDamageMultiplier(relics, explorer)
  }

  baseDamage *= relicMultiplier

  const min = Math.max(0, Math.floor(baseDamage * VARIANCE_MIN))
  const max = Math.max(0, Math.floor(baseDamage * VARIANCE_MAX))

  const isBoosted = intBonus > 0
    || buffMultiplier > 1.0
    || relicMultiplier > 1.0

  return { min, max, isBoosted }
}

/** ダメージ範囲を文字列にフォーマット */
export function formatDamageRange(range: DamageRange): string {
  if (range.min === range.max) return `${range.min}`
  return `${range.min}-${range.max}`
}
