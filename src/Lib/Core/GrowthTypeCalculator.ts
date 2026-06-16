import { CharacterClass, ExplorerState } from '../Types/Explorer'
import { GrowthTypeOption, GrowthTypeName } from '../Types/GrowthType'
import { getTuningValue } from '../Tuning/TuningStore'

/** 簡易的な疑似乱数生成器（シード付き） */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

/** クラス別・成長タイプ別のステータス上昇値定義 */
const GROWTH_DEFINITIONS: Record<
  CharacterClass,
  Record<GrowthTypeName, { label: string; str: number; int: number; maxHp: number; maxMp: number }>
> = {
  warrior: {
    attack:   { label: '攻撃',     str: 4, int: 0, maxHp: 0,  maxMp: 0 },
    hp:       { label: '生命力',   str: 0, int: 0, maxHp: 27, maxMp: 0 },
    mp:       { label: '鍛錬',     str: 1, int: 0, maxHp: 7,  maxMp: 0 },
    balance:  { label: 'バランス', str: 2, int: 0, maxHp: 14, maxMp: 1 },
    allBonus: { label: '覚醒',     str: 3, int: 0, maxHp: 20, maxMp: 1 },
  },
  mage: {
    attack:   { label: '攻撃',     str: 0, int: 4, maxHp: 0,  maxMp: 0 },
    hp:       { label: '生命力',   str: 0, int: 0, maxHp: 12, maxMp: 0 },
    mp:       { label: '魔力',     str: 0, int: 0, maxHp: 0,  maxMp: 9 },
    balance:  { label: 'バランス', str: 0, int: 2, maxHp: 6,  maxMp: 4 },
    allBonus: { label: '覚醒',     str: 0, int: 3, maxHp: 8,  maxMp: 5 },
  },
  cleric: {
    attack:   { label: '攻撃',     str: 1, int: 3, maxHp: 0,  maxMp: 0 },
    hp:       { label: '生命力',   str: 0, int: 0, maxHp: 20, maxMp: 0 },
    mp:       { label: '魔力',     str: 0, int: 0, maxHp: 0,  maxMp: 8 },
    balance:  { label: 'バランス', str: 1, int: 1, maxHp: 10, maxMp: 3 },
    allBonus: { label: '覚醒',     str: 1, int: 2, maxHp: 14, maxMp: 4 },
  },
}

/** 成長タイプごとの抽選重み */
const GROWTH_WEIGHTS: Record<GrowthTypeName, number> = {
  attack: 2,
  hp: 2,
  mp: 2,
  balance: 2,
  allBonus: 1,
}

/**
 * クラスに応じた全5種の成長タイプ選択肢を返す
 */
export function getGrowthTypesForClass(characterClass: CharacterClass): GrowthTypeOption[] {
  const definitions = GROWTH_DEFINITIONS[characterClass]
  const types: GrowthTypeName[] = ['attack', 'hp', 'mp', 'balance', 'allBonus']

  return types.map(type => ({
    type,
    label: definitions[type].label,
    stats: {
      str: definitions[type].str,
      int: definitions[type].int,
      maxHp: definitions[type].maxHp,
      maxMp: definitions[type].maxMp,
    },
    weight: GROWTH_WEIGHTS[type],
  }))
}

/**
 * 重み付き抽選で選択肢を1つ選ぶ
 */
function weightedSelectOne(options: GrowthTypeOption[], randomValue: number): GrowthTypeOption {
  const totalWeight = options.reduce((sum, o) => sum + o.weight, 0)
  const threshold = randomValue * totalWeight
  let cumulative = 0

  for (const option of options) {
    cumulative += option.weight
    if (threshold < cumulative) {
      return option
    }
  }

  // フォールバック（浮動小数点誤差対策）
  return options[options.length - 1]
}

/**
 * 重み付き抽選で2つの成長タイプを選出する
 *
 * - 2枠とも重み付き抽選（重複なし）
 * - seed により決定的な結果を返す
 *
 * relics パラメータは後方互換のために残していますが、現在は使用されません。
 */
export function selectGrowthOptions(
  characterClass: CharacterClass,
  _relics: unknown,
  seed: number,
): [GrowthTypeOption, GrowthTypeOption] {
  const allOptions = getGrowthTypesForClass(characterClass)

  // 通常: 2枠とも重み付き抽選
  const first = weightedSelectOne(allOptions, seededRandom(seed))
  const remaining = allOptions.filter(o => o.type !== first.type)
  const second = weightedSelectOne(remaining, seededRandom(seed + 1))

  return [first, second]
}

/**
 * 選択された成長タイプのステータスを explorer に加算する
 * 新しいオブジェクトを返す（immutability）
 * HP/MP の回復はここでは行わない
 */
export function applyGrowthType(
  explorer: ExplorerState,
  growthType: GrowthTypeOption,
): ExplorerState {
  return {
    ...explorer,
    str: explorer.str + growthType.stats.str,
    int: explorer.int + growthType.stats.int,
    maxHp: explorer.maxHp + growthType.stats.maxHp,
    maxMp: explorer.maxMp + growthType.stats.maxMp,
  }
}

/**
 * レベルアップ時のHP/MP回復を適用する
 * maxHp/maxMp 増加後に呼ぶ
 * hp += maxHp * levelup_hp_recovery_rate
 * mp += maxMp * levelup_mp_recovery_rate
 * 上限は maxHp / maxMp
 */
export function applyLevelUpRecovery(explorer: ExplorerState): ExplorerState {
  const hpRecoveryRate = getTuningValue('levelup_hp_recovery_rate', 0.25)
  const mpRecoveryRate = getTuningValue('levelup_mp_recovery_rate', 0.25)

  const hpRecovery = Math.ceil(explorer.maxHp * hpRecoveryRate)
  const mpRecovery = Math.ceil(explorer.maxMp * mpRecoveryRate)

  return {
    ...explorer,
    hp: Math.min(explorer.hp + hpRecovery, explorer.maxHp),
    mp: Math.min(explorer.mp + mpRecovery, explorer.maxMp),
  }
}
