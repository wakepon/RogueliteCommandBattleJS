import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponData } from '../Types/Weapon'
import { SpellInstance, SpellData } from '../Types/Spell'
import { RelicInstance } from '../Types/Relic'
import { BattleCommand, CommandSlot } from '../Types/Battle'
import { isWeapon, isSpell } from '../Core/CommandValidator'
import {
  getStatBonus,
  getWeaponDamageBonus,
  isWeaponDamageBonusApplicable,
  getLowHpDamageMultiplier,
  getKillStreakMultiplier,
  getLastStrikeMultiplier,
  getLowMpDamageMultiplier,
  getLowestLevelDamageMultiplier,
} from '../Core/RelicProcessor'

/** ダメージ予測範囲 */
export interface DamageRange {
  min: number
  max: number
  isBoosted: boolean
  isWeakened?: boolean
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
  weaponBreakMultiplier?: number  // 努力の証: 武器破壊蓄積倍率
  party?: ExplorerState[]  // 番狂わせの一撃: パーティ全体のレベル比較
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
  // 変換武器: HP系ステータスから直接ダメージを算出（通常の計算をバイパス）
  if ('effect' in weapon && weapon.effect?.type === 'hpPercentDamage') {
    const dmg = Math.floor(explorer.maxHp * weapon.effect.rate)
    return { min: dmg, max: dmg, isBoosted: false }
  }
  if ('effect' in weapon && weapon.effect?.type === 'currentHpDamage') {
    const dmg = Math.max(0, explorer.hp - 1)
    return { min: dmg, max: dmg, isBoosted: false }
  }

  const { relics = [], killStreakActive = false, includeConditionalRelics = false, hasPrecision = false, weaponBreakMultiplier = 0, party } = options

  // scaleStat対応（魔力弾はINT依存）
  const scaleStat = ('scaleStat' in weapon && weapon.scaleStat === 'int') ? 'int' : 'str'
  const statBonus = getStatBonus(relics, scaleStat)
  const weaponDmgBonus = isWeaponDamageBonusApplicable(weapon) ? getWeaponDamageBonus(relics) : 0
  const effectiveStat = (scaleStat === 'int' ? explorer.int : explorer.str) + statBonus
  const buffMultiplier = calculateBuffMultiplier(explorer, scaleStat)

  // conditionalPower: HP条件でPower増加（猛撃の斧）
  let conditionalPowerBonus = 0
  if (includeConditionalRelics && 'effect' in weapon && weapon.effect?.type === 'conditionalPower') {
    const hpRatio = explorer.hp / explorer.maxHp
    if (hpRatio <= weapon.effect.hpThreshold) {
      conditionalPowerBonus = weapon.effect.bonusPower
    }
  }

  // weaponPowerBonus バフ: 武器強化による一時的なPower加算
  const weaponPowerBonusValue = explorer.battleBuffs
    .filter(b => b.type === 'weaponPowerBonus')
    .reduce((sum, b) => sum + b.value, 0)

  const effectivePower = weapon.power + weaponDmgBonus + conditionalPowerBonus + weaponPowerBonusValue
  let baseDamage = effectiveStat * effectivePower * buffMultiplier

  // 努力の証: 武器破壊蓄積倍率
  if (weaponBreakMultiplier > 0) {
    baseDamage *= (1 + weaponBreakMultiplier)
  }

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
    // 番狂わせの一撃: パーティ最低レベル時のダメージ倍率
    if (party && party.length > 0) {
      relicMultiplier *= getLowestLevelDamageMultiplier(relics, explorer, party)
    }
  }

  baseDamage *= relicMultiplier

  // 闘気の腕輪バフ: 次攻撃ダメージ倍率
  const levelUpBoostBuff = explorer.battleBuffs.find(b => b.type === 'levelUpDamageBoost')
  if (levelUpBoostBuff) {
    baseDamage *= levelUpBoostBuff.value
  }

  // 弱体デバフによるダメージ低下
  const weaknessDebuff = explorer.battleDebuffs.find(d => d.type === 'weakness')
  if (weaknessDebuff && weaknessDebuff.type === 'weakness') {
    baseDamage *= (1.0 - weaknessDebuff.value)
  }

  // シールドバッシュ: シールド値をダメージに加算
  let shieldBashBonus = 0
  if ('effect' in weapon && weapon.effect?.type === 'shieldBash') {
    const shieldBuff = explorer.battleBuffs.find(b => b.type === 'shield')
    if (shieldBuff) {
      shieldBashBonus = shieldBuff.value
    }
  }

  const base = Math.floor(baseDamage)
  // 精密バフ: ブレ幅→0、最大ブレ値で固定
  const explorerHasPrecision = explorer.battleBuffs.some(b => b.type === 'precision')
  const isPrecise = hasPrecision || explorerHasPrecision
  const min = isPrecise ? Math.max(0, base + weapon.variance + shieldBashBonus) : Math.max(0, base - weapon.variance + shieldBashBonus)
  const max = Math.max(0, base + weapon.variance + shieldBashBonus)

  const isBoosted = statBonus > 0
    || weaponDmgBonus > 0
    || buffMultiplier > 1.0
    || relicMultiplier > 1.0
    || conditionalPowerBonus > 0
    || weaponPowerBonusValue > 0
    || weaponBreakMultiplier > 0
    || shieldBashBonus > 0
    || (levelUpBoostBuff !== undefined && levelUpBoostBuff.value > 1.0)

  const isWeakened = weaknessDebuff !== undefined

  return { min, max, isBoosted, isWeakened }
}

/** 魔法ダメージ予測 */
export function predictSpellDamage(
  explorer: ExplorerState,
  spell: SpellInstance | SpellData,
  options: DamagePredictOptions = {}
): DamageRange {
  // 魔力放出: 現在MP全量がダメージ（変動値）
  if (spell.effect?.type === 'mpAllDamage') {
    return { min: explorer.mp, max: explorer.mp, isBoosted: false }
  }

  const { relics = [], includeConditionalRelics = false, hasPrecision = false, party } = options

  const intBonus = getStatBonus(relics, 'int')
  const effectiveInt = explorer.int + intBonus
  const buffMultiplier = calculateBuffMultiplier(explorer, 'int')

  let baseDamage = effectiveInt * spell.power * buffMultiplier

  // 条件付きレリック倍率（バトル中のみ）
  let relicMultiplier = 1.0
  if (includeConditionalRelics) {
    relicMultiplier *= getLowHpDamageMultiplier(relics, explorer)
    relicMultiplier *= getLowMpDamageMultiplier(relics, explorer)
    if (party && party.length > 0) {
      relicMultiplier *= getLowestLevelDamageMultiplier(relics, explorer, party)
    }
  }

  baseDamage *= relicMultiplier

  // 闘気の腕輪バフ: 次攻撃ダメージ倍率
  const levelUpBoostBuff = explorer.battleBuffs.find(b => b.type === 'levelUpDamageBoost')
  if (levelUpBoostBuff) {
    baseDamage *= levelUpBoostBuff.value
  }

  // 弱体デバフによるダメージ低下
  const spellWeakness = explorer.battleDebuffs.find(d => d.type === 'weakness')
  if (spellWeakness && spellWeakness.type === 'weakness') {
    baseDamage *= (1.0 - spellWeakness.value)
  }

  const base = Math.floor(baseDamage)
  const explorerHasPrecision = explorer.battleBuffs.some(b => b.type === 'precision')
  const isPrecise = hasPrecision || explorerHasPrecision
  const min = isPrecise ? Math.max(0, base + spell.variance) : Math.max(0, base - spell.variance)
  const max = Math.max(0, base + spell.variance)

  const isBoosted = intBonus > 0
    || buffMultiplier > 1.0
    || relicMultiplier > 1.0
    || (levelUpBoostBuff !== undefined && levelUpBoostBuff.value > 1.0)

  const isWeakened = spellWeakness !== undefined

  return { min, max, isBoosted, isWeakened }
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
  includeConditionalRelics: boolean,
  weaponBreakMultiplier: number = 0
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
    // 努力の証: 武器破壊蓄積倍率
    if (effect.type === 'weaponBreakDamageMultiplier' && weaponBreakMultiplier > 0 && isWeapon(command)) {
      multipliers.push({ relicName: relic.name, multiplier: 1 + weaponBreakMultiplier })
    }
    // 血の契約: 戦闘開始時STRバフ（バフ自体はbattleBuffsに含まれるが、表示用に検出）
    if (effect.type === 'battleStartHpReduction') {
      const hasStrBuff = explorer.battleBuffs.some(b => b.type === 'str' && b.duration === 'battle')
      if (hasStrBuff) {
        multipliers.push({ relicName: relic.name, multiplier: 1.0 + effect.strBonus * 0.1 })
      }
    }
  }

  // 武器強化バフ（鍛冶師の金槌等）
  if (isWeapon(command)) {
    const wpBonus = explorer.battleBuffs.filter(b => b.type === 'weaponPowerBonus').reduce((s, b) => s + b.value, 0)
    if (wpBonus > 0) {
      multipliers.push({ relicName: '武器強化', multiplier: 0 }) // 加算なのでmultiplierは目安表示用
    }
  }

  // conditionalPower（猛撃の斧）
  if (isWeapon(command) && 'effect' in command && command.effect?.type === 'conditionalPower') {
    const hpRatio = explorer.hp / explorer.maxHp
    if (hpRatio <= command.effect.hpThreshold) {
      multipliers.push({ relicName: command.name, multiplier: 0 }) // 加算表示用
    }
  }

  // 弱体デバフ
  const weaknessDebuff = explorer.battleDebuffs.find(d => d.type === 'weakness')
  if (weaknessDebuff && weaknessDebuff.type === 'weakness') {
    multipliers.push({ relicName: '攻撃ダウン', multiplier: 1.0 - weaknessDebuff.value })
  }

  return multipliers
}

/** 特定の敵への詳細ダメージプレビュー（個別コマンド分解付き） */
export function calculateDetailedDamagePreview(
  commandSlots: CommandSlot[],
  targetEnemyId: string,
  party: ExplorerState[],
  options: DamagePredictOptions = {},
  tentative?: TentativeCommand | null,
  aliveEnemyCount?: number
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
    const slotOptions = { ...options, hasPrecision: precisionFromOrder, party }

    const targetsThisEnemy = slot.targetId === targetEnemyId
    const isEnemyAllWeapon = isWeapon(slot.command) && slot.command.targetType === 'enemyAll'
    const isEnemyAllSpell = isSpell(slot.command) && slot.command.targetType === 'enemyAll'
    const isEnemyAll = isEnemyAllWeapon || isEnemyAllSpell
    const isEnemyRandom = isWeapon(slot.command) && slot.command.targetType === 'enemyRandom'

    if (!targetsThisEnemy && !isEnemyAll && !isEnemyRandom) continue

    let range: DamageRange | null = null

    if (isWeapon(slot.command)) {
      if (slot.command.targetType === 'allySingle' || slot.command.targetType === 'allyAll') continue
      range = predictWeaponDamage(explorer, slot.command, slotOptions)
    } else if (isSpell(slot.command)) {
      if (slot.command.targetType === 'allySingle' || slot.command.targetType === 'allyAll') continue
      range = predictSpellDamage(explorer, slot.command, slotOptions)
    }

    if (range && isEnemyRandom && isWeapon(slot.command)) {
      const hits = ('hits' in slot.command && slot.command.hits) ? slot.command.hits : 3
      const multipleEnemies = (aliveEnemyCount ?? 1) > 1
      range = multipleEnemies
        ? { min: 0, max: range.max * hits, isBoosted: range.isBoosted, isWeakened: range.isWeakened }
        : { min: range.min * hits, max: range.max * hits, isBoosted: range.isBoosted, isWeakened: range.isWeakened }
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
        options.includeConditionalRelics || false,
        options.weaponBreakMultiplier || 0
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

