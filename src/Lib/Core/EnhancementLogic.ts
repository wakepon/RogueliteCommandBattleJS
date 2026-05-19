import { ExplorerWeapon, WeaponInstance } from '../Types/Weapon'
import { SpellInstance } from '../Types/Spell'
import {
  WeaponMerit, WeaponDemerit, WeaponEnhancement,
  SpellMerit, SpellDemerit, SpellEnhancement,
  WeaponEnhancementOption, SpellEnhancementOption,
  ENHANCEMENT_COST, MAX_ENHANCEMENTS_PER_ITEM,
} from '../Types/Enhancement'

// === 武器強化プール ===

const WEAPON_MERITS: WeaponMerit[] = [
  { category: 'weaponMerit', type: 'powerUp', value: 1 },
  { category: 'weaponMerit', type: 'lifesteal', value: 7 },
  { category: 'weaponMerit', type: 'maxUsesUp', value: 2 },
  { category: 'weaponMerit', type: 'mpRecovery', value: 4 },
]

const WEAPON_DEMERITS: WeaponDemerit[] = [
  { category: 'weaponDemerit', type: 'hpCost', value: 5 },
  { category: 'weaponDemerit', type: 'attackDown', value: 1 },
  { category: 'weaponDemerit', type: 'maxUsesUpNoRepair', value: 2 },
  { category: 'weaponDemerit', type: 'goldCost', value: 1 },
  { category: 'weaponDemerit', type: 'mpCost', value: 3 },
]

// === 魔法強化プール ===

const SPELL_MERITS: SpellMerit[] = [
  { category: 'spellMerit', type: 'powerUp', value: 1 },
  { category: 'spellMerit', type: 'goldOnUse', value: 1 },
  { category: 'spellMerit', type: 'healOnUse', value: 7 },
  { category: 'spellMerit', type: 'killBonusExp', value: 2 },
  { category: 'spellMerit', type: 'becomeAoe', value: 3 },
]

const SPELL_DEMERITS: SpellDemerit[] = [
  { category: 'spellDemerit', type: 'hpCostMpUp', value: 2, subValue: 5 },
  { category: 'spellDemerit', type: 'attackDownMpUp', value: 2, subValue: 1 },
  { category: 'spellDemerit', type: 'goldCostMpUp', value: 2, subValue: 1 },
  { category: 'spellDemerit', type: 'mpUp', value: 4 },
]

// === RNG ===

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function pickN<T>(array: T[], count: number, seed: number): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1))
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

// === 候補生成 ===

export function generateWeaponEnhancementOptions(
  seed: number
): [WeaponEnhancementOption, WeaponEnhancementOption] {
  const merits = pickN(WEAPON_MERITS, 2, seed)
  const demerits = pickN(WEAPON_DEMERITS, 2, seed + 1000)
  return [
    { merit: merits[0], demerit: demerits[0] },
    { merit: merits[1], demerit: demerits[1] },
  ]
}

export function generateSpellEnhancementOptions(
  spell: SpellInstance,
  seed: number
): [SpellEnhancementOption, SpellEnhancementOption] {
  const availableMerits = spell.targetType === 'enemyAll'
    ? SPELL_MERITS.filter(m => m.type !== 'becomeAoe')
    : [...SPELL_MERITS]

  const merits = pickN(availableMerits, 2, seed)
  const demerits = pickN(SPELL_DEMERITS, 2, seed + 1000)
  return [
    { merit: merits[0], demerit: demerits[0] },
    { merit: merits[1], demerit: demerits[1] },
  ]
}

// === 強化適用 ===

export function applyWeaponEnhancement(
  weapon: WeaponInstance,
  enhancement: WeaponEnhancement
): WeaponInstance {
  let result: WeaponInstance = {
    ...weapon,
    enhancements: [...weapon.enhancements, enhancement],
  }

  switch (enhancement.merit.type) {
    case 'powerUp':
      result = { ...result, power: result.power + enhancement.merit.value }
      break
    case 'maxUsesUp':
      if (result.maxUses !== null && result.currentUses !== null) {
        result = {
          ...result,
          maxUses: result.maxUses + enhancement.merit.value,
          currentUses: result.currentUses + enhancement.merit.value,
        }
      }
      break
  }

  switch (enhancement.demerit.type) {
    case 'maxUsesUpNoRepair':
      if (result.maxUses !== null && result.currentUses !== null) {
        result = {
          ...result,
          maxUses: result.maxUses + enhancement.demerit.value,
          currentUses: result.currentUses + enhancement.demerit.value,
          noRepair: true,
        }
      }
      break
  }

  return result
}

export function applySpellEnhancement(
  spell: SpellInstance,
  enhancement: SpellEnhancement
): SpellInstance {
  let result: SpellInstance = {
    ...spell,
    enhancements: [...spell.enhancements, enhancement],
  }

  switch (enhancement.merit.type) {
    case 'powerUp':
      result = { ...result, power: result.power + enhancement.merit.value }
      break
    case 'becomeAoe':
      result = {
        ...result,
        power: Math.max(0, result.power - enhancement.merit.value),
        targetType: 'enemyAll',
      }
      break
  }

  // 全デメリットにMP増加を含む
  result = { ...result, mpCost: result.mpCost + enhancement.demerit.value }

  return result
}

// === ヘルパー ===

export function getRemainingEnhancements(enhancements: unknown[]): number {
  return MAX_ENHANCEMENTS_PER_ITEM - enhancements.length
}

export function canEnhance(enhancements: unknown[]): boolean {
  return enhancements.length < MAX_ENHANCEMENTS_PER_ITEM
}

/** 武器が強化可能かどうか（パンチ、コスト0、味方対象は除外） */
export function canEnhanceWeapon(weapon: ExplorerWeapon): boolean {
  if (weapon.id === 'punch') return false
  if (!('enhancements' in weapon)) return false
  const wi = weapon as WeaponInstance
  if (wi.price === 0) return false
  if (wi.targetType === 'allySingle' || wi.targetType === 'allyAll') return false
  return true
}

/** 魔法が強化可能かどうか（コスト0、バフ/回復系は除外） */
export function canEnhanceSpell(spell: SpellInstance): boolean {
  if (spell.price === 0) return false
  if (spell.targetType === 'allySingle' || spell.targetType === 'allyAll') return false
  return true
}

export { ENHANCEMENT_COST, MAX_ENHANCEMENTS_PER_ITEM }

// === 表示用テキスト ===

export function getWeaponMeritText(merit: WeaponMerit): string {
  switch (merit.type) {
    case 'powerUp': return `Power+${merit.value}`
    case 'lifesteal': return `吸血+${merit.value}`
    case 'maxUsesUp': return `耐久値+${merit.value}`
    case 'mpRecovery': return `MP回復+${merit.value}`
  }
}

export function getWeaponDemeritText(demerit: WeaponDemerit): string {
  switch (demerit.type) {
    case 'hpCost': return `使用時HP-${demerit.value}`
    case 'attackDown': return `使用後攻撃力↓${demerit.value}T`
    case 'maxUsesUpNoRepair': return `耐久+${demerit.value}/修復不可`
    case 'goldCost': return `使用時G-${demerit.value}`
    case 'mpCost': return `使用時MP-${demerit.value}`
  }
}

export function getSpellMeritText(merit: SpellMerit): string {
  switch (merit.type) {
    case 'powerUp': return `Power+${merit.value}`
    case 'goldOnUse': return `使用時G+${merit.value}`
    case 'healOnUse': return `使用時HP+${merit.value}`
    case 'killBonusExp': return `トドメ時EXP+${merit.value}`
    case 'becomeAoe': return `全体攻撃化(P-${merit.value})`
  }
}

export function getSpellDemeritText(demerit: SpellDemerit): string {
  switch (demerit.type) {
    case 'hpCostMpUp': return `使用時HP-${demerit.subValue}`
    case 'attackDownMpUp': return '使用後攻撃力↓'
    case 'goldCostMpUp': return `使用時G-${demerit.subValue}`
    case 'mpUp': return ''
  }
}

export function getSpellDemeritTextFull(demerit: SpellDemerit): string {
  switch (demerit.type) {
    case 'hpCostMpUp': return `使用時HP-${demerit.subValue} / 消費MP+${demerit.value}`
    case 'attackDownMpUp': return `使用後攻撃力↓ / 消費MP+${demerit.value}`
    case 'goldCostMpUp': return `使用時G-${demerit.subValue} / 消費MP+${demerit.value}`
    case 'mpUp': return `消費MP+${demerit.value}`
  }
}

/** 武器の強化効果を集約して表示テキスト配列を返す */
export function getWeaponEnhancementSummary(enhancements: WeaponEnhancement[]): { text: string; isMerit: boolean }[] {
  if (enhancements.length === 0) return []

  const meritAgg = new Map<string, number>()
  const demeritAgg = new Map<string, number>()
  let hasNoRepair = false

  for (const enh of enhancements) {
    meritAgg.set(enh.merit.type, (meritAgg.get(enh.merit.type) ?? 0) + enh.merit.value)
    if (enh.demerit.type === 'maxUsesUpNoRepair') {
      demeritAgg.set('maxUsesUpNoRepair', (demeritAgg.get('maxUsesUpNoRepair') ?? 0) + enh.demerit.value)
      hasNoRepair = true
    } else {
      demeritAgg.set(enh.demerit.type, (demeritAgg.get(enh.demerit.type) ?? 0) + enh.demerit.value)
    }
  }

  const result: { text: string; isMerit: boolean }[] = []

  for (const [type, value] of meritAgg) {
    const merit = { category: 'weaponMerit' as const, type: type as WeaponMerit['type'], value }
    result.push({ text: getWeaponMeritText(merit), isMerit: true })
  }

  for (const [type, value] of demeritAgg) {
    if (type === 'maxUsesUpNoRepair') {
      result.push({ text: `耐久+${value}/修復不可`, isMerit: false })
    } else {
      const demerit = { category: 'weaponDemerit' as const, type: type as WeaponDemerit['type'], value }
      result.push({ text: getWeaponDemeritText(demerit), isMerit: false })
    }
  }

  if (hasNoRepair && !demeritAgg.has('maxUsesUpNoRepair')) {
    result.push({ text: '修復不可', isMerit: false })
  }

  return result
}

/** 魔法の強化効果を集約して表示テキスト配列を返す */
export function getSpellEnhancementSummary(enhancements: SpellEnhancement[]): { text: string; isMerit: boolean }[] {
  if (enhancements.length === 0) return []

  const meritAgg = new Map<string, number>()
  const demeritTypeAgg = new Map<string, { value: number; subValue: number }>()
  for (const enh of enhancements) {
    if (enh.merit.type === 'becomeAoe') {
      meritAgg.set('becomeAoe', (meritAgg.get('becomeAoe') ?? 0) + enh.merit.value)
    } else {
      meritAgg.set(enh.merit.type, (meritAgg.get(enh.merit.type) ?? 0) + enh.merit.value)
    }

    const existing = demeritTypeAgg.get(enh.demerit.type) ?? { value: 0, subValue: 0 }
    demeritTypeAgg.set(enh.demerit.type, {
      value: existing.value + enh.demerit.value,
      subValue: existing.subValue + (enh.demerit.subValue ?? 0),
    })
  }

  const result: { text: string; isMerit: boolean }[] = []

  for (const [type, value] of meritAgg) {
    if (type === 'becomeAoe') {
      result.push({ text: `全体攻撃化(P-${value})`, isMerit: true })
    } else {
      const merit = { category: 'spellMerit' as const, type: type as SpellMerit['type'], value }
      result.push({ text: getSpellMeritText(merit), isMerit: true })
    }
  }

  for (const [type, { subValue }] of demeritTypeAgg) {
    switch (type) {
      case 'hpCostMpUp':
        result.push({ text: `使用時HP-${subValue}`, isMerit: false })
        break
      case 'attackDownMpUp':
        result.push({ text: '使用後攻撃力↓', isMerit: false })
        break
      case 'goldCostMpUp':
        result.push({ text: `使用時G-${subValue}`, isMerit: false })
        break
      case 'mpUp':
        break
    }
  }

  return result
}
