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
  randomFactor?: number
  relics?: RelicInstance[]
  killStreakActive?: boolean
}

/**
 * ブレ補正の最小値
 */
const VARIANCE_MIN = 0.90

/**
 * ブレ補正の最大値
 */
const VARIANCE_MAX = 1.10

/**
 * ランダムファクターを生成する（0.90〜1.10）
 */
function generateRandomFactor(): number {
  return VARIANCE_MIN + Math.random() * (VARIANCE_MAX - VARIANCE_MIN)
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
 *   (Str + statBonus) × (power + weaponDamageBonus) × バフ倍率 × レリック倍率 × ブレ補正
 */
export function calculateWeaponDamage(
  attacker: ExplorerState,
  weapon: ExplorerWeapon,
  _target: EnemyInstance,
  options: DamageOptions = {}
): DamageResult {
  const { randomFactor, relics = [], killStreakActive = false } = options
  const factor = randomFactor ?? generateRandomFactor()

  const buffMultiplier = calculateBuffMultiplier(attacker.battleBuffs, 'str')

  // レリックによるSTRボーナス
  const effectiveStr = attacker.str + getStatBonus(relics, 'str')

  // レリックによる武器ダメージボーナス
  const weaponDmgBonus = getWeaponDamageBonus(relics)

  // 基本ダメージ計算
  let rawDamage = effectiveStr * (weapon.power + weaponDmgBonus) * buffMultiplier * factor

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

  const damage = Math.floor(rawDamage)

  return {
    damage: Math.max(0, damage),
    isCritical: false,
  }
}

/**
 * 魔法ダメージを計算する
 *
 * ダメージ計算式:
 *   (Int + statBonus) × power × バフ倍率 × レリック倍率 × ブレ補正
 */
export function calculateSpellDamage(
  attacker: ExplorerState,
  spell: SpellInstance,
  _target: EnemyInstance,
  options: DamageOptions = {}
): DamageResult {
  const { randomFactor, relics = [] } = options
  const factor = randomFactor ?? generateRandomFactor()

  const buffMultiplier = calculateBuffMultiplier(attacker.battleBuffs, 'int')

  // レリックによるINTボーナス
  const effectiveInt = attacker.int + getStatBonus(relics, 'int')

  // 基本ダメージ計算
  let rawDamage = effectiveInt * spell.power * buffMultiplier * factor

  // レリック倍率: 怒りの炎（lowHpDamageMultiplier）
  rawDamage *= getLowHpDamageMultiplier(relics, attacker)

  // レリック倍率: 集中の水晶（lowMpDamageBonus）
  rawDamage *= getLowMpDamageMultiplier(relics, attacker)

  const damage = Math.floor(rawDamage)

  return {
    damage: Math.max(0, damage),
    isCritical: false,
  }
}
