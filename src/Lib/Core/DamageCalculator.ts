import { ExplorerState, Buff } from '../Types/Explorer'
import { ExplorerWeapon } from '../Types/Weapon'
import { SpellInstance } from '../Types/Spell'
import { EnemyInstance } from '../Types/Enemy'
import { RelicInstance } from '../Types/Relic'
import {
  getStatBonus,
  getWeaponDamageBonus,
  getLowHpDamageMultiplier,
  getKillStreakMultiplier,
  getLastStrikeMultiplier,
  getLowMpDamageMultiplier,
} from './RelicProcessor'

/**
 * ダメージ計算結果
 */
export interface DamageResult {
  damage: number
  isCritical: boolean  // MVP では false 固定
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
  return 1.0 + (totalValue * 0.1)
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
  const offset = varianceOffset ?? generateVarianceOffset(weapon.variance)

  const buffMultiplier = calculateBuffMultiplier(attacker.battleBuffs, 'str')

  // レリックによるSTRボーナス
  const effectiveStr = attacker.str + getStatBonus(relics, 'str')

  // レリックによる武器ダメージボーナス
  const weaponDmgBonus = getWeaponDamageBonus(relics)

  // 基本ダメージ計算
  let rawDamage = effectiveStr * (weapon.power + weaponDmgBonus) * buffMultiplier

  // レリック倍率: 怒りの炎（lowHpDamageMultiplier）
  rawDamage *= getLowHpDamageMultiplier(relics, attacker)

  // レリック倍率: 血染めの手袋（killStreakBonus）
  if (killStreakActive) {
    rawDamage *= getKillStreakMultiplier(relics)
  }

  // レリック倍率: 研ぎ師の名刺（lastStrikeDamageMultiplier） - currentUses===1で壊れる直前
  if (weapon.currentUses === 1) {
    rawDamage *= getLastStrikeMultiplier(relics)
  }

  // 基本ダメージを切り捨て後にブレを加算
  const damage = Math.floor(rawDamage) + offset

  return {
    damage: Math.max(0, damage),
    isCritical: false,
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
  const offset = varianceOffset ?? generateVarianceOffset(spell.variance)

  const buffMultiplier = calculateBuffMultiplier(attacker.battleBuffs, 'int')

  // レリックによるINTボーナス
  const effectiveInt = attacker.int + getStatBonus(relics, 'int')

  // 基本ダメージ計算
  let rawDamage = effectiveInt * spell.power * buffMultiplier

  // レリック倍率: 怒りの炎（lowHpDamageMultiplier）
  rawDamage *= getLowHpDamageMultiplier(relics, attacker)

  // レリック倍率: 集中の水晶（lowMpDamageBonus）
  rawDamage *= getLowMpDamageMultiplier(relics, attacker)

  // 基本ダメージを切り捨て後にブレを加算
  const damage = Math.floor(rawDamage) + offset

  return {
    damage: Math.max(0, damage),
    isCritical: false,
  }
}
