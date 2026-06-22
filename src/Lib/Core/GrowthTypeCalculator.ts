import { CharacterClass, ExplorerState } from '../Types/Explorer'
import { GrowthTypeOption } from '../Types/GrowthType'
import { getTuningValue } from '../Tuning/TuningStore'

/** クラス別のバランス型成長値 */
const BALANCED_GROWTH: Record<CharacterClass, { str: number; int: number; maxHp: number; maxMp: number }> = {
  warrior: { str: 2, int: 0, maxHp: 14, maxMp: 1 },
  mage:    { str: 0, int: 2, maxHp: 6,  maxMp: 4 },
  cleric:  { str: 1, int: 1, maxHp: 10, maxMp: 3 },
}

/** クラスに応じたバランス型の成長値を返す */
export function getBalancedGrowth(characterClass: CharacterClass): GrowthTypeOption {
  const g = BALANCED_GROWTH[characterClass]
  return {
    type: 'balance',
    label: 'バランス',
    stats: { str: g.str, int: g.int, maxHp: g.maxHp, maxMp: g.maxMp },
    weight: 1,
  }
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
