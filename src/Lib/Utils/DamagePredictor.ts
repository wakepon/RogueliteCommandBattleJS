import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponData } from '../Types/Weapon'
import { SpellInstance, SpellData } from '../Types/Spell'
import { RelicInstance } from '../Types/Relic'
import { BattleCommand, CommandSlot } from '../Types/Battle'
import { isWeapon, isSpell } from '../Core/CommandValidator'
import {
  getVulnerabilityPowerBoost,
  getBrokenWeaponStrBonus,
  getPositionStatBonus,
  getComboAttackBonus,
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
  includeConditionalRelics?: boolean
  hasPrecision?: boolean  // 精密バフでブレ幅→0
  brokenWeaponCount?: number  // 努力の証: 壊れた武器の累計本数
  party?: ExplorerState[]
  explorerIndex?: number  // パーティ内の位置（ポジションボーナス用）
  commandSlots?: CommandSlot[]  // 行動順スロット（followUp計算用）
  currentCommandIndex?: number  // 現在のスロットインデックス（followUp計算用）
  targetCurrentHp?: number  // 対象敵の現在HP（targetHpConditional用）
  targetMaxHp?: number  // 対象敵の最大HP（targetHpConditional用）
  comboBonus?: number  // 連携の紋章: コマンドフェーズで算出したPowerボーナス
}

/** バフ倍率を計算する（DamageCalculator.tsと同じロジック） */
function calculateBuffMultiplier(explorer: ExplorerState, stat: 'str' | 'int'): number {
  const statBuffs = explorer.battleBuffs.filter(buff => buff.type === stat)
  const totalValue = statBuffs.reduce((sum, buff) => sum + buff.value, 0)
  return 1.0 + (totalValue * 0.1)
}

/** 同ターンの先行スロットで味方が攻撃した回数をカウント */
function countAllyAttacksThisTurn(commandSlots?: CommandSlot[], currentCommandIndex?: number): number {
  if (!commandSlots || currentCommandIndex === undefined || currentCommandIndex <= 0) return 0
  let count = 0
  for (let i = 0; i < currentCommandIndex; i++) {
    const slot = commandSlots[i]
    if (!slot.command || !slot.targetId) continue
    const cmd = slot.command
    if ((isWeapon(cmd) || isSpell(cmd))
      && cmd.targetType !== 'allySingle'
      && cmd.targetType !== 'allyAll') {
      count++
    }
  }
  return count
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

  const { relics = [], includeConditionalRelics = false, hasPrecision = false, brokenWeaponCount = 0 } = options

  // scaleStat対応（魔力弾はINT依存）
  const scaleStat = ('scaleStat' in weapon && weapon.scaleStat === 'int') ? 'int' : 'str'
  const baseStat = scaleStat === 'int' ? explorer.int : explorer.str
  const buffMultiplier = calculateBuffMultiplier(explorer, scaleStat)

  // 努力の証: 壊れた武器STRボーナス
  let brokenBonus = 0
  if (brokenWeaponCount > 0 && scaleStat === 'str') {
    const strPerWeapon = getBrokenWeaponStrBonus(relics)
    brokenBonus = Math.floor(brokenWeaponCount * strPerWeapon)
  }

  // ポジションボーナス
  let positionBonus = 0
  if (options.explorerIndex !== undefined && options.party) {
    const posBonus = getPositionStatBonus(relics, options.explorerIndex, options.party.length)
    positionBonus = scaleStat === 'str' ? posBonus.strBonus : posBonus.intBonus
  }

  const effectiveStat = baseStat + brokenBonus + positionBonus

  // 条件付きPowerボーナス（スケーリング型）
  let conditionalPowerBonus = 0
  if (includeConditionalRelics && 'effect' in weapon) {
    if (weapon.effect?.type === 'selfHpConditional') {
      const lostHpRatio = 1 - explorer.hp / explorer.maxHp
      conditionalPowerBonus += Math.floor(lostHpRatio * weapon.effect.coefficient)
    }
    if (weapon.effect?.type === 'targetHpConditional') {
      if (options.targetCurrentHp !== undefined && options.targetMaxHp) {
        const lostHpRatio = 1 - options.targetCurrentHp / options.targetMaxHp
        conditionalPowerBonus += Math.floor(lostHpRatio * weapon.effect.coefficient)
      }
    }
    if (weapon.effect?.type === 'levelScale') {
      conditionalPowerBonus += explorer.level
    }
    if (weapon.effect?.type === 'followUp') {
      const allyAttacks = countAllyAttacksThisTurn(options.commandSlots, options.currentCommandIndex)
      conditionalPowerBonus += allyAttacks * weapon.effect.coefficient
    }
    if (weapon.effect?.type === 'revengeDamage') {
      conditionalPowerBonus += Math.floor(explorer.damageTakenLastTurn * weapon.effect.coefficient)
    }
  }

  // weaponPowerBonus バフ: 武器強化による一時的なPower加算
  const weaponPowerBonusValue = explorer.battleBuffs
    .filter(b => b.type === 'weaponPowerBonus')
    .reduce((sum, b) => sum + b.value, 0)

  // 連携の紋章: コマンドフェーズの予測値 or 既存バフ
  const comboBuff = explorer.battleBuffs.find(b => b.type === 'comboPowerBonus')
  const comboPowerBonus = options.comboBonus ?? (comboBuff ? comboBuff.value : 0)

  const effectivePower = weapon.power + conditionalPowerBonus + weaponPowerBonusValue
  let baseDamage = effectiveStat * effectivePower * buffMultiplier

  if (comboPowerBonus > 0) {
    baseDamage += effectiveStat * comboPowerBonus * buffMultiplier
  }

  // 逆境の鎧
  const hasVulnerability = explorer.battleDebuffs.some(d => d.type === 'vulnerability')
  if (hasVulnerability && includeConditionalRelics) {
    const vulnBonus = getVulnerabilityPowerBoost(relics)
    if (vulnBonus > 0) {
      baseDamage += effectiveStat * vulnBonus * buffMultiplier
    }
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
  const explorerHasPrecision = explorer.battleBuffs.some(b => b.type === 'precision')
  const isPrecise = hasPrecision || explorerHasPrecision
  const min = isPrecise ? Math.max(0, base + weapon.variance + shieldBashBonus) : Math.max(0, base - weapon.variance + shieldBashBonus)
  const max = Math.max(0, base + weapon.variance + shieldBashBonus)

  const isBoosted = brokenBonus > 0
    || positionBonus > 0
    || buffMultiplier > 1.0
    || conditionalPowerBonus > 0
    || weaponPowerBonusValue > 0
    || comboPowerBonus > 0
    || shieldBashBonus > 0

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

  const { relics = [], includeConditionalRelics = false, hasPrecision = false } = options

  // ポジションボーナス
  let positionBonus = 0
  if (options.explorerIndex !== undefined && options.party) {
    const posBonus = getPositionStatBonus(relics, options.explorerIndex, options.party.length)
    positionBonus = posBonus.intBonus
  }

  const effectiveInt = explorer.int + positionBonus
  const buffMultiplier = calculateBuffMultiplier(explorer, 'int')

  // 条件付きPowerボーナス（スケーリング型）
  let conditionalPowerBonus = 0
  if (includeConditionalRelics && spell.effect) {
    if (spell.effect.type === 'targetHpConditional') {
      if (options.targetCurrentHp !== undefined && options.targetMaxHp) {
        const lostHpRatio = 1 - options.targetCurrentHp / options.targetMaxHp
        conditionalPowerBonus += Math.floor(lostHpRatio * spell.effect.coefficient)
      }
    }
    if (spell.effect.type === 'lowMpConditional') {
      const mpAfterCast = Math.max(0, explorer.mp - ('mpCost' in spell ? spell.mpCost : 0))
      const usedMpRatio = 1 - mpAfterCast / explorer.maxMp
      conditionalPowerBonus += Math.floor(usedMpRatio * spell.effect.coefficient)
    }
    if (spell.effect.type === 'followUp') {
      const allyAttacks = countAllyAttacksThisTurn(options.commandSlots, options.currentCommandIndex)
      conditionalPowerBonus += allyAttacks * spell.effect.coefficient
    }
    if (spell.effect.type === 'revengeDamage') {
      conditionalPowerBonus += Math.floor(explorer.damageTakenLastTurn * spell.effect.coefficient)
    }
  }

  const effectivePower = spell.power + conditionalPowerBonus
  let baseDamage = effectiveInt * effectivePower * buffMultiplier

  // 連携の紋章: コマンドフェーズの予測値 or 既存バフ
  const comboBuff = explorer.battleBuffs.find(b => b.type === 'comboPowerBonus')
  const comboPowerBonus = options.comboBonus ?? (comboBuff ? comboBuff.value : 0)
  if (comboPowerBonus > 0) {
    baseDamage += effectiveInt * comboPowerBonus * buffMultiplier
  }

  // 逆境の鎧
  const hasVulnerability = explorer.battleDebuffs.some(d => d.type === 'vulnerability')
  if (hasVulnerability && includeConditionalRelics) {
    const vulnBonus = getVulnerabilityPowerBoost(relics)
    if (vulnBonus > 0) {
      baseDamage += effectiveInt * vulnBonus * buffMultiplier
    }
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

  const isBoosted = positionBonus > 0
    || buffMultiplier > 1.0
    || comboPowerBonus > 0
    || conditionalPowerBonus > 0

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

/** コマンドスロットから連携の紋章の条件を判定し、ボーナス値を返す */
export function getComboConditionBonus(
  commandSlots: CommandSlot[],
  relics: RelicInstance[],
  tentative?: TentativeCommand | null
): number {
  const combo = getComboAttackBonus(relics)
  if (!combo) return 0

  const slots = tentative
    ? commandSlots.map(s =>
        s.explorerId === tentative.explorerId
          ? { ...s, command: tentative.command, targetId: tentative.targetEnemyId }
          : s
      )
    : commandSlots

  const attackerIds = new Set<string>()
  for (const slot of slots) {
    if (!slot.command || !slot.targetId) continue
    const cmd = slot.command
    if ((isWeapon(cmd) || isSpell(cmd))
      && cmd.targetType !== 'allySingle'
      && cmd.targetType !== 'allyAll') {
      attackerIds.add(slot.explorerId)
    }
  }

  return attackerIds.size >= combo.requiredCount ? combo.powerBonus : 0
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
  includeConditionalRelics: boolean,
  comboBonus?: number
): MultiplierEffect[] {
  if (!includeConditionalRelics) return []

  const multipliers: MultiplierEffect[] = []

  for (const relic of relics) {
    const effect = relic.passiveEffect
    // 血の契約: 戦闘開始時STRバフ（バフ自体はbattleBuffsに含まれるが、表示用に検出）
    if (effect.type === 'battleStartHpReduction') {
      const hasStrBuff = explorer.battleBuffs.some(b => b.type === 'str' && b.duration === 'battle')
      if (hasStrBuff) {
        multipliers.push({ relicName: relic.name, multiplier: 1.0 + effect.strBonus * 0.1 })
      }
    }
    // 逆境の鎧
    if (effect.type === 'vulnerabilityPowerBoost') {
      const hasVuln = explorer.battleDebuffs.some(d => d.type === 'vulnerability')
      if (hasVuln) {
        multipliers.push({ relicName: relic.name, multiplier: 0 })
      }
    }
    // 努力の証: 壊れた武器STRボーナス
    if (effect.type === 'brokenWeaponStatBonus' && isWeapon(command)) {
      const combatStrBuff = explorer.battleBuffs.find(b => b.type === 'combatStrGain')
      if (combatStrBuff) {
        multipliers.push({ relicName: relic.name, multiplier: 0 })
      }
    }
  }

  // 武器強化バフ
  if (isWeapon(command)) {
    const wpBonus = explorer.battleBuffs.filter(b => b.type === 'weaponPowerBonus').reduce((s, b) => s + b.value, 0)
    if (wpBonus > 0) {
      multipliers.push({ relicName: '武器強化', multiplier: 0 })
    }
  }

  // 連携の紋章: コマンドフェーズの予測値 or 既存バフ
  const comboPowerBuff = explorer.battleBuffs.find(b => b.type === 'comboPowerBonus')
  if ((comboBonus && comboBonus > 0) || comboPowerBuff) {
    multipliers.push({ relicName: '連携の紋章', multiplier: 0 })
  }

  // 条件付きPower（武器）
  if (isWeapon(command) && 'effect' in command) {
    if (command.effect?.type === 'selfHpConditional') {
      const lostHpRatio = 1 - explorer.hp / explorer.maxHp
      const bonusPower = Math.floor(lostHpRatio * command.effect.coefficient)
      if (bonusPower > 0) {
        multipliers.push({ relicName: command.name, multiplier: 0 })
      }
    }
    if (command.effect?.type === 'targetHpConditional') {
      multipliers.push({ relicName: command.name, multiplier: 0 })
    }
    if (command.effect?.type === 'levelScale') {
      multipliers.push({ relicName: command.name, multiplier: 0 })
    }
    if (command.effect?.type === 'followUp') {
      multipliers.push({ relicName: command.name, multiplier: 0 })
    }
    if (command.effect?.type === 'revengeDamage' && explorer.damageTakenLastTurn > 0) {
      multipliers.push({ relicName: command.name, multiplier: 0 })
    }
  }

  // 条件付きPower（魔法）
  if (isSpell(command) && command.effect) {
    if (command.effect.type === 'targetHpConditional') {
      multipliers.push({ relicName: command.name, multiplier: 0 })
    }
    if (command.effect.type === 'lowMpConditional') {
      const usedMpRatio = 1 - explorer.mp / explorer.maxMp
      const bonusPower = Math.floor(usedMpRatio * command.effect.coefficient)
      if (bonusPower > 0) {
        multipliers.push({ relicName: command.name, multiplier: 0 })
      }
    }
    if (command.effect.type === 'followUp') {
      multipliers.push({ relicName: command.name, multiplier: 0 })
    }
    if (command.effect.type === 'revengeDamage' && explorer.damageTakenLastTurn > 0) {
      multipliers.push({ relicName: command.name, multiplier: 0 })
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
  aliveEnemyCount?: number,
  targetHasShield?: boolean,
  targetCurrentHp?: number,
  targetMaxHp?: number
): DetailedDamagePreview {
  let totalMin = 0
  let totalMax = 0
  let anyBoosted = false
  const segments: CommandDamageSegment[] = []
  let shieldConsumed = false

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

  // 連携の紋章: コマンドフェーズで条件判定
  const comboBonus = getComboConditionBonus(allSlots, options.relics || [], tentative)

  for (let i = 0; i < allSlots.length; i++) {
    const slot = allSlots[i]
    if (!slot.command) continue

    const explorer = party.find(e => e.id === slot.explorerId)
    if (!explorer) continue

    const precisionFromOrder = willReceivePrecision(allSlots, slot.explorerId, i)
    const rawIdx = party.findIndex(e => e.id === slot.explorerId)
    const explorerIndex = rawIdx >= 0 ? rawIdx : undefined
    const slotOptions = { ...options, hasPrecision: precisionFromOrder, party, explorerIndex, commandSlots: allSlots, currentCommandIndex: i, targetCurrentHp, targetMaxHp, comboBonus }

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
      // シールドはランダムヒットの最初の1発のみ軽減
      if (targetHasShield && !shieldConsumed && !multipleEnemies) {
        const shieldedMin = Math.floor(range.min * 0.5)
        const shieldedMax = Math.floor(range.max * 0.5)
        range = { min: shieldedMin + range.min * (hits - 1), max: shieldedMax + range.max * (hits - 1), isBoosted: range.isBoosted, isWeakened: range.isWeakened }
        shieldConsumed = true
      } else {
        range = multipleEnemies
          ? { min: 0, max: range.max * hits, isBoosted: range.isBoosted, isWeakened: range.isWeakened }
          : { min: range.min * hits, max: range.max * hits, isBoosted: range.isBoosted, isWeakened: range.isWeakened }
      }
    }

    if (range) {
      // 敵シールド: 最初のセグメントのダメージを50%軽減（非ランダムヒット）
      if (targetHasShield && !shieldConsumed) {
        range = { ...range, min: Math.floor(range.min * 0.5), max: Math.floor(range.max * 0.5) }
        shieldConsumed = true
      }

      totalMin += range.min
      totalMax += range.max
      if (range.isBoosted) anyBoosted = true

      const activeMultipliers = detectActiveMultipliers(
        options.relics || [],
        explorer,
        slot.command,
        options.includeConditionalRelics || false,
        comboBonus
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

