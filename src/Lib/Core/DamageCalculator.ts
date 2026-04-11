import { ExplorerState, Buff } from '../Types/Explorer'
import { ExplorerWeapon } from '../Types/Weapon'
import { SpellInstance } from '../Types/Spell'
import { EnemyInstance } from '../Types/Enemy'
import { RelicInstance } from '../Types/Relic'
import { getTuningValue } from '../Tuning/TuningStore'
import {
  getStatBonus,
  getWeaponDamageBonus,
  getLowHpDamageMultiplier,
  getKillStreakMultiplier,
  getLastStrikeMultiplier,
  getLowMpDamageMultiplier,
} from './RelicProcessor'

/** ダメージ寄与者（ポップアップ表示用） */
export interface DamageContributor {
  name: string
  label: string  // "+15", "×1.5", "（確定）" など
}

/**
 * ダメージ計算結果
 */
export interface DamageResult {
  damage: number
  isCritical: boolean  // MVP では false 固定
  contributors: DamageContributor[]
}

/** ダメージ計算のオプション */
interface DamageOptions {
  varianceOffset?: number  // ブレのオフセット値（テスト用に固定値を指定）
  relics?: RelicInstance[]
  killStreakActive?: boolean
}

/**
 * ランダムなブレオフセットを生成する（-variance 〜 +variance の整数、均等分布）
 */
function generateVarianceOffset(variance: number): number {
  if (variance <= 0) return 0
  return Math.floor(Math.random() * (2 * variance + 1)) - variance
}

/**
 * バフ倍率を計算する
 * strバフの合計値を倍率に変換（例: value=2 → 1.0 + 0.2 = 1.2倍）
 */
function calculateBuffMultiplier(buffs: Buff[], stat: 'str' | 'int'): number {
  const statBuffs = buffs.filter(buff => buff.type === stat)
  const totalValue = statBuffs.reduce((sum, buff) => sum + buff.value, 0)
  return 1.0 + (totalValue * getTuningValue('buff_multiplier_per_point', 0.1))
}

/**
 * 武器ダメージを計算する
 *
 * ダメージ計算式:
 *   (Str + statBonus) × (power + weaponDamageBonus) × バフ倍率 × レリック倍率 + ブレ補正
 */
export function calculateWeaponDamage(
  attacker: ExplorerState,
  weapon: ExplorerWeapon,
  _target: EnemyInstance,
  options: DamageOptions = {}
): DamageResult {
  const { varianceOffset, relics = [], killStreakActive = false } = options
  const contributors: DamageContributor[] = []

  // 精密バフ: ブレ幅→0、ダメージは最大ブレ値で固定
  const hasPrecision = attacker.battleBuffs.some(b => b.type === 'precision')
  const offset = varianceOffset ?? (hasPrecision ? weapon.variance : generateVarianceOffset(weapon.variance))
  if (hasPrecision) {
    contributors.push({ name: '精密', label: '（確定）' })
  }

  // scaleStat に基づいてSTR or INT依存を決定（デフォルト: str）
  const scaleStat = ('scaleStat' in weapon && weapon.scaleStat === 'int') ? 'int' : 'str'
  const buffMultiplier = calculateBuffMultiplier(attacker.battleBuffs, scaleStat)

  // レリックによるステータスボーナス
  const statBonus = getStatBonus(relics, scaleStat)
  const effectiveStat = (scaleStat === 'int' ? attacker.int : attacker.str) + statBonus

  // レリックによる武器ダメージボーナス
  const weaponDmgBonus = getWeaponDamageBonus(relics)

  // 寄与者: ステータスボーナスと武器ダメージボーナス
  for (const relic of relics) {
    if (relic.passiveEffect.type === 'statBonus' && relic.passiveEffect.stat === scaleStat) {
      contributors.push({ name: relic.name, label: `+${relic.passiveEffect.value}` })
    }
    if (relic.passiveEffect.type === 'weaponDamageBonus') {
      contributors.push({ name: relic.name, label: `+${relic.passiveEffect.value}` })
    }
  }

  // バフ倍率の寄与者
  if (buffMultiplier > 1.0) {
    const statLabel = scaleStat === 'str' ? 'STR' : 'INT'
    contributors.push({ name: `${statLabel}バフ`, label: `×${buffMultiplier.toFixed(1)}` })
  }

  // 基本ダメージ計算
  let rawDamage = effectiveStat * (weapon.power + weaponDmgBonus) * buffMultiplier

  // レリック倍率: 怒りの炎（lowHpDamageMultiplier）
  const lowHpMult = getLowHpDamageMultiplier(relics, attacker)
  rawDamage *= lowHpMult
  if (lowHpMult > 1.0) {
    const relic = relics.find(r => r.passiveEffect.type === 'lowHpDamageMultiplier')
    if (relic) contributors.push({ name: relic.name, label: `×${lowHpMult}` })
  }

  // レリック倍率: 血染めの手袋（killStreakBonus）
  if (killStreakActive) {
    const mult = getKillStreakMultiplier(relics)
    rawDamage *= mult
    if (mult > 1.0) {
      const relic = relics.find(r => r.passiveEffect.type === 'killStreakBonus')
      if (relic) contributors.push({ name: relic.name, label: `×${mult}` })
    }
  }

  // レリック倍率: 研ぎ師の名刺（lastStrikeDamageMultiplier） - currentUses===1で壊れる直前
  if (weapon.currentUses === 1) {
    const mult = getLastStrikeMultiplier(relics)
    rawDamage *= mult
    if (mult > 1.0) {
      const relic = relics.find(r => r.passiveEffect.type === 'lastStrikeDamageMultiplier')
      if (relic) contributors.push({ name: relic.name, label: `×${mult}` })
    }
  }

  // 弱体デバフによるダメージ低下
  const weaknessDebuff = attacker.battleDebuffs.find(d => d.type === 'weakness')
  if (weaknessDebuff && weaknessDebuff.type === 'weakness') {
    rawDamage *= (1.0 - weaknessDebuff.value)
    contributors.push({ name: '弱体', label: `×${(1.0 - weaknessDebuff.value).toFixed(2)}` })
  }

  // 基本ダメージを切り捨て後にブレを加算
  const damage = Math.floor(rawDamage) + offset

  return {
    damage: Math.max(0, damage),
    isCritical: false,
    contributors,
  }
}

/**
 * 魔法ダメージを計算する
 *
 * ダメージ計算式:
 *   (Int + statBonus) × power × バフ倍率 × レリック倍率 + ブレ補正
 */
export function calculateSpellDamage(
  attacker: ExplorerState,
  spell: SpellInstance,
  _target: EnemyInstance,
  options: DamageOptions = {}
): DamageResult {
  const { varianceOffset, relics = [] } = options
  const contributors: DamageContributor[] = []

  // 精密バフ: ブレ幅→0、ダメージは最大ブレ値で固定
  const hasPrecision = attacker.battleBuffs.some(b => b.type === 'precision')
  const offset = varianceOffset ?? (hasPrecision ? spell.variance : generateVarianceOffset(spell.variance))
  if (hasPrecision) {
    contributors.push({ name: '精密', label: '（確定）' })
  }

  const buffMultiplier = calculateBuffMultiplier(attacker.battleBuffs, 'int')

  // レリックによるINTボーナス
  const effectiveInt = attacker.int + getStatBonus(relics, 'int')

  // 寄与者: ステータスボーナス
  for (const relic of relics) {
    if (relic.passiveEffect.type === 'statBonus' && relic.passiveEffect.stat === 'int') {
      contributors.push({ name: relic.name, label: `+${relic.passiveEffect.value}` })
    }
  }

  // バフ倍率の寄与者
  if (buffMultiplier > 1.0) {
    contributors.push({ name: 'INTバフ', label: `×${buffMultiplier.toFixed(1)}` })
  }

  // 基本ダメージ計算
  let rawDamage = effectiveInt * spell.power * buffMultiplier

  // レリック倍率: 怒りの炎（lowHpDamageMultiplier）
  const lowHpMult = getLowHpDamageMultiplier(relics, attacker)
  rawDamage *= lowHpMult
  if (lowHpMult > 1.0) {
    const relic = relics.find(r => r.passiveEffect.type === 'lowHpDamageMultiplier')
    if (relic) contributors.push({ name: relic.name, label: `×${lowHpMult}` })
  }

  // レリック倍率: 集中の水晶（lowMpDamageBonus）
  const lowMpMult = getLowMpDamageMultiplier(relics, attacker)
  rawDamage *= lowMpMult
  if (lowMpMult > 1.0) {
    const relic = relics.find(r => r.passiveEffect.type === 'lowMpDamageBonus')
    if (relic) contributors.push({ name: relic.name, label: `×${lowMpMult}` })
  }

  // 弱体デバフによるダメージ低下
  const spellWeakness = attacker.battleDebuffs.find(d => d.type === 'weakness')
  if (spellWeakness && spellWeakness.type === 'weakness') {
    rawDamage *= (1.0 - spellWeakness.value)
    contributors.push({ name: '弱体', label: `×${(1.0 - spellWeakness.value).toFixed(2)}` })
  }

  // 基本ダメージを切り捨て後にブレを加算
  const damage = Math.floor(rawDamage) + offset

  return {
    damage: Math.max(0, damage),
    isCritical: false,
    contributors,
  }
}
