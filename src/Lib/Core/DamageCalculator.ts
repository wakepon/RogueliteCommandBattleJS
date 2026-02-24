import { ExplorerState, Buff } from '../Types/Explorer'
import { ExplorerWeapon } from '../Types/Weapon'
import { SpellInstance } from '../Types/Spell'
import { EnemyInstance } from '../Types/Enemy'

/**
 * ダメージ計算結果
 */
export interface DamageResult {
  damage: number
  isCritical: boolean  // MVP では false 固定
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
  // バフ値を10%単位の倍率として計算
  return 1.0 + (totalValue * 0.1)
}

/**
 * 武器ダメージを計算する
 *
 * ダメージ計算式:
 *   Str × (power + 固定加算) × バフ倍率 × ブレ補正
 *
 * @param attacker - 攻撃者の状態
 * @param weapon - 使用する武器
 * @param _target - ターゲット（現在は未使用、将来の防御計算用）
 * @param randomFactor - ブレ補正（0.90〜1.10）、省略時はランダム生成
 * @returns ダメージ計算結果
 */
export function calculateWeaponDamage(
  attacker: ExplorerState,
  weapon: ExplorerWeapon,
  _target: EnemyInstance,
  randomFactor?: number
): DamageResult {
  const factor = randomFactor ?? generateRandomFactor()

  // バフ倍率を計算
  const buffMultiplier = calculateBuffMultiplier(attacker.battleBuffs, 'str')

  // 固定加算（WeaponInstanceの場合のみeffectを持つ可能性がある）
  // 現状のWeaponEffectには固定加算が含まれていないため、将来の拡張用
  const fixedBonus = 0

  // ダメージ計算: Str × (power + 固定加算) × バフ倍率 × ブレ補正
  const rawDamage = attacker.str * (weapon.power + fixedBonus) * buffMultiplier * factor

  // 最終値は floor
  const damage = Math.floor(rawDamage)

  return {
    damage: Math.max(0, damage),  // 負のダメージは0として扱う
    isCritical: false  // MVP では false 固定
  }
}

/**
 * 魔法ダメージを計算する
 *
 * ダメージ計算式:
 *   Int × power × バフ倍率 × ブレ補正
 *
 * @param attacker - 攻撃者の状態
 * @param spell - 使用する魔法
 * @param _target - ターゲット（現在は未使用、将来の防御計算用）
 * @param randomFactor - ブレ補正（0.90〜1.10）、省略時はランダム生成
 * @returns ダメージ計算結果
 */
export function calculateSpellDamage(
  attacker: ExplorerState,
  spell: SpellInstance,
  _target: EnemyInstance,
  randomFactor?: number
): DamageResult {
  const factor = randomFactor ?? generateRandomFactor()

  // バフ倍率を計算（魔法はintバフを使用）
  const buffMultiplier = calculateBuffMultiplier(attacker.battleBuffs, 'int')

  // ダメージ計算: Int × power × バフ倍率 × ブレ補正
  const rawDamage = attacker.int * spell.power * buffMultiplier * factor

  // 最終値は floor
  const damage = Math.floor(rawDamage)

  return {
    damage: Math.max(0, damage),  // 負のダメージは0として扱う
    isCritical: false  // MVP では false 固定
  }
}
