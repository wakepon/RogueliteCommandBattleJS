import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponData } from '../Types/Weapon'
import { SpellInstance, SpellData } from '../Types/Spell'
import { RelicInstance } from '../Types/Relic'
import { BattleCommand, CommandSlot } from '../Types/Battle'
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

/** 乗算レリック効果の情報 */
export interface MultiplierEffect {
  relicName: string
  multiplier: number
}

/** 個別コマンドのダメージセグメント（キルラインバー用） */
export interface CommandDamageSegment {
  explorerName: string
  commandName: string
  commandCategory: 'weapon' | 'spell'
  damageRange: DamageRange
  /** このセグメントに適用されている乗算レリック効果 */
  activeMultipliers: MultiplierEffect[]
}

/** 個別コマンド分解付きの累計ダメージプレビュー */
export interface DetailedDamagePreview {
  totalMin: number
  totalMax: number
  isBoosted: boolean
  segments: CommandDamageSegment[]
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
  hasPrecision?: boolean  // 精密バフでブレ幅→0
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
  const { relics = [], killStreakActive = false, includeConditionalRelics = false, hasPrecision = false } = options

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
  // 精密バフまたはExplorerの既存precisionバフでブレ幅→0
  const explorerHasPrecision = explorer.battleBuffs.some(b => b.type === 'precision')
  const effectiveVariance = (hasPrecision || explorerHasPrecision) ? 0 : weapon.variance
  const min = Math.max(0, base - effectiveVariance)
  const max = Math.max(0, base + effectiveVariance)

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
  const { relics = [], includeConditionalRelics = false, hasPrecision = false } = options

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
  const explorerHasPrecision = explorer.battleBuffs.some(b => b.type === 'precision')
  const effectiveVariance = (hasPrecision || explorerHasPrecision) ? 0 : spell.variance
  const min = Math.max(0, base - effectiveVariance)
  const max = Math.max(0, base + effectiveVariance)

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

/**
 * 行動順を考慮して、特定キャラが精密バフを受けるかどうかを判定
 * （そのキャラより先に行動するスロットに、そのキャラ宛ての精密がセットされているか）
 */
function willReceivePrecision(
  commandSlots: CommandSlot[],
  targetExplorerId: string,
  slotIndex: number
): boolean {
  for (let i = 0; i < slotIndex; i++) {
    const prevSlot = commandSlots[i]
    if (!prevSlot.command) continue
    if (!isSpell(prevSlot.command)) continue
    if (prevSlot.command.effect?.type !== 'buff') continue
    if (prevSlot.command.effect.stat !== 'precision') continue
    if (prevSlot.targetId === targetExplorerId) return true
  }
  return false
}

/** 仮想コマンド情報（ドラッグ中のプレビュー用） */
export interface TentativeCommand {
  command: BattleCommand
  explorerId: string
  targetEnemyId: string  // ホバー中の敵ID
}

/** コマンドに適用中の乗算レリック効果を検出 */
function detectActiveMultipliers(
  relics: RelicInstance[],
  explorer: ExplorerState,
  command: BattleCommand,
  killStreakActive: boolean,
  includeConditionalRelics: boolean
): MultiplierEffect[] {
  if (!includeConditionalRelics) return []

  const multipliers: MultiplierEffect[] = []

  for (const relic of relics) {
    const effect = relic.passiveEffect
    if (effect.type === 'lowHpDamageMultiplier') {
      const threshold = explorer.maxHp * effect.hpThreshold
      if (explorer.hp <= threshold) {
        multipliers.push({ relicName: relic.name, multiplier: effect.multiplier })
      }
    }
    if (effect.type === 'killStreakBonus' && killStreakActive && isWeapon(command)) {
      multipliers.push({ relicName: relic.name, multiplier: effect.multiplier })
    }
    if (effect.type === 'lastStrikeDamageMultiplier' && isWeapon(command)) {
      if ('currentUses' in command && command.currentUses === 1) {
        multipliers.push({ relicName: relic.name, multiplier: effect.multiplier })
      }
    }
    if (effect.type === 'lowMpDamageBonus' && isSpell(command)) {
      const threshold = explorer.maxMp * effect.mpThreshold
      if (explorer.mp <= threshold) {
        multipliers.push({ relicName: relic.name, multiplier: effect.multiplier })
      }
    }
  }

  return multipliers
}

/** 特定の敵への詳細ダメージプレビュー（個別コマンド分解付き） */
export function calculateDetailedDamagePreview(
  commandSlots: CommandSlot[],
  targetEnemyId: string,
  party: ExplorerState[],
  options: DamagePredictOptions = {},
  tentative?: TentativeCommand | null
): DetailedDamagePreview {
  let totalMin = 0
  let totalMax = 0
  let anyBoosted = false
  const segments: CommandDamageSegment[] = []

  const allSlots: CommandSlot[] = [...commandSlots]
  if (tentative) {
    const existingIdx = allSlots.findIndex(s => s.explorerId === tentative.explorerId)
    if (existingIdx >= 0) {
      allSlots[existingIdx] = {
        explorerId: tentative.explorerId,
        command: tentative.command,
        targetId: tentative.targetEnemyId,
      }
    }
  }

  for (let i = 0; i < allSlots.length; i++) {
    const slot = allSlots[i]
    if (!slot.command) continue

    const explorer = party.find(e => e.id === slot.explorerId)
    if (!explorer) continue

    const precisionFromOrder = willReceivePrecision(allSlots, slot.explorerId, i)
    const slotOptions = { ...options, hasPrecision: precisionFromOrder }

    const targetsThisEnemy = slot.targetId === targetEnemyId
    const isEnemyAllWeapon = isWeapon(slot.command) && slot.command.targetType === 'enemyAll'
    const isEnemyAllSpell = isSpell(slot.command) && slot.command.targetType === 'enemyAll'
    const isEnemyAll = isEnemyAllWeapon || isEnemyAllSpell

    if (!targetsThisEnemy && !isEnemyAll) continue

    let range: DamageRange | null = null

    if (isWeapon(slot.command)) {
      if (slot.command.targetType === 'allySingle') continue
      range = predictWeaponDamage(explorer, slot.command, slotOptions)
    } else if (isSpell(slot.command)) {
      if (slot.command.targetType === 'allySingle') continue
      range = predictSpellDamage(explorer, slot.command, slotOptions)
    }

    if (range) {
      totalMin += range.min
      totalMax += range.max
      if (range.isBoosted) anyBoosted = true

      const activeMultipliers = detectActiveMultipliers(
        options.relics || [],
        explorer,
        slot.command,
        options.killStreakActive || false,
        options.includeConditionalRelics || false
      )

      segments.push({
        explorerName: explorer.name,
        commandName: slot.command.name,
        commandCategory: isWeapon(slot.command) ? 'weapon' : 'spell',
        damageRange: range,
        activeMultipliers,
      })
    }
  }

  return { totalMin, totalMax, isBoosted: anyBoosted, segments }
}

/** 特定の敵への累計ダメージプレビュー（全コマンドスロット + 仮想コマンドから） */
export function calculateCumulativeDamagePreview(
  commandSlots: CommandSlot[],
  targetEnemyId: string,
  party: ExplorerState[],
  options: DamagePredictOptions = {},
  tentative?: TentativeCommand | null
): DamageRange {
  const detailed = calculateDetailedDamagePreview(commandSlots, targetEnemyId, party, options, tentative)
  return { min: detailed.totalMin, max: detailed.totalMax, isBoosted: detailed.isBoosted }
}
