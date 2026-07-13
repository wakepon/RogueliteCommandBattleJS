import { getTuningValue } from '../Tuning/TuningStore'

/** MP消費の計算に必要な最小限のフィールド（魔法コマンド由来） */
interface MpCostSource {
  mpCost: number
  mpCostRate?: number
}

/**
 * 全MP消費型（mpCostRate >= 1.0）かどうかを判定する。
 * このタイプは全体倍率の対象外で、常に現在MPを全消費する。
 */
export function isFullMpCost(command: MpCostSource): boolean {
  return command.mpCostRate !== undefined && command.mpCostRate >= 1.0
}

/**
 * 全体倍率を適用した実効MP消費量を返す。
 *
 * - 割合消費型（0 < mpCostRate < 1.0）: floor(maxMp × rate × 割合倍率)
 * - 固定消費型（mpCostRate なし）: round(mpCost × 固定倍率)
 *
 * 全MP消費型（mpCostRate >= 1.0）はこの関数では扱わない。
 * 呼び出し側で {@link isFullMpCost} により分岐し、現在MPを全消費すること。
 */
export function getEffectiveMpCost(command: MpCostSource, maxMp: number): number {
  if (command.mpCostRate !== undefined && command.mpCostRate > 0) {
    const rateMult = getTuningValue('global_mp_cost_rate_multiplier', 1.0)
    return Math.floor(maxMp * command.mpCostRate * rateMult)
  }
  return getDisplayMpCost(command.mpCost)
}

/**
 * 固定MP消費の表示値（全体倍率適用、四捨五入）。
 * maxMpに依存しないため、探索者が定まらないショップ等の表示でも使える。
 * 固定消費型の実消費（{@link getEffectiveMpCost}）と一致する。
 */
export function getDisplayMpCost(mpCost: number): number {
  const flatMult = getTuningValue('global_mp_cost_multiplier', 1.0)
  return Math.round(mpCost * flatMult)
}

/**
 * 割合MP消費の実効割合（0〜1）。全体倍率を適用し、表示用に1.0へクランプする。
 * 例: rate 0.2 × 割合倍率 2.0 → 0.4（「最大40%」と表示）。
 * ※実消費（{@link getEffectiveMpCost}）はクランプせず、超過分は現在MPを全消費する。
 */
export function getDisplayMpCostRate(rate: number): number {
  const rateMult = getTuningValue('global_mp_cost_rate_multiplier', 1.0)
  return Math.min(1.0, rate * rateMult)
}
