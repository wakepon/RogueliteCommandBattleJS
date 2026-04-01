import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponData } from '../Types/Weapon'
import { SpellInstance, SpellData } from '../Types/Spell'
import { RelicInstance } from '../Types/Relic'
import { CommandSlot } from '../Types/Battle'
import { isWeapon, isSpell } from '../Core/CommandValidator'
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

  // scaleStat対応（魔力弾はINT依存）
  const scaleStat = ('scaleStat' in weapon && weapon.scaleStat === 'int') ? 'int' : 'str'
  const statBonus = getStatBonus(relics, scaleStat)
  const weaponDmgBonus = getWeaponDamageBonus(relics)
  const effectiveStat = (scaleStat === 'int' ? explorer.int : explorer.str) + statBonus
  const buffMultiplier = calculateBuffMultiplier(explorer, scaleStat)

  let baseDamage = effectiveStat * (weapon.power + weaponDmgBonus) * buffMultiplier

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

  const base = Math.floor(baseDamage)
  const min = Math.max(0, base - weapon.variance)
  const max = Math.max(0, base + weapon.variance)

  const isBoosted = statBonus > 0
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

  const base = Math.floor(baseDamage)
  const min = Math.max(0, base - spell.variance)
  const max = Math.max(0, base + spell.variance)

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

/** 特定の敵への累計ダメージプレビュー（全コマンドスロットから） */
export function calculateCumulativeDamagePreview(
  commandSlots: CommandSlot[],
  targetEnemyId: string,
  party: ExplorerState[],
  options: DamagePredictOptions = {}
): DamageRange {
  let totalMin = 0
  let totalMax = 0
  let anyBoosted = false

  for (const slot of commandSlots) {
    if (!slot.command || slot.targetId !== targetEnemyId) continue

    const explorer = party.find(e => e.id === slot.explorerId)
    if (!explorer) continue

    let range: DamageRange | null = null

    if (isWeapon(slot.command)) {
      // 味方対象武器（祈り等）はダメージなし
      if (slot.command.targetType === 'allySingle') continue
      range = predictWeaponDamage(explorer, slot.command, options)
    } else if (isSpell(slot.command)) {
      // 味方対象スペルはダメージなし
      if (slot.command.targetType === 'allySingle') continue
      range = predictSpellDamage(explorer, slot.command, options)
    }

    if (range) {
      totalMin += range.min
      totalMax += range.max
      if (range.isBoosted) anyBoosted = true
    }
  }

  // enemyAll（全体攻撃）も含める: targetIdが特定敵でなくても全敵に当たるコマンド
  for (const slot of commandSlots) {
    if (!slot.command || slot.targetId === targetEnemyId) continue  // 既に処理済み
    if (!slot.command) continue

    const explorer = party.find(e => e.id === slot.explorerId)
    if (!explorer) continue

    if (isWeapon(slot.command) && slot.command.targetType === 'enemyAll') {
      const range = predictWeaponDamage(explorer, slot.command, options)
      totalMin += range.min
      totalMax += range.max
      if (range.isBoosted) anyBoosted = true
    } else if (isSpell(slot.command) && slot.command.targetType === 'enemyAll') {
      const range = predictSpellDamage(explorer, slot.command, options)
      totalMin += range.min
      totalMax += range.max
      if (range.isBoosted) anyBoosted = true
    }
  }

  return { min: totalMin, max: totalMax, isBoosted: anyBoosted }
}
