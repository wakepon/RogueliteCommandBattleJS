import { ExplorerState } from '../Types/Explorer'
import { RelicInstance } from '../Types/Relic'
import { getTuningValue } from '../Tuning/TuningStore'
import { getHighHpTargetRateBonus } from './RelicProcessor'

/** 各キャラの被ターゲット率 */
export interface TargetRate {
  explorerId: string
  rate: number  // 0〜1の確率
}

/**
 * 前衛/後衛に基づく基本被ターゲット率を計算
 *
 * ルール:
 * - 前衛は後衛の2倍の確率で狙われる
 * - 戦闘不能キャラは対象外
 * - 祈りバフ: 対象の被ターゲット率+25%、残りを按分減少
 */
export function calculateTargetRates(
  party: ExplorerState[],
  relics: RelicInstance[] = []
): TargetRate[] {
  const alive = party.filter(m => m.hp > 0)
  if (alive.length === 0) return []

  // 基本ウェイト: 前衛/後衛（Tuning対応）
  const frontWeight = getTuningValue('front_position_weight', 2)
  const backWeight = getTuningValue('back_position_weight', 1)
  const weights = alive.map(m => ({
    explorerId: m.id,
    weight: m.position === 'front' ? frontWeight : backWeight,
  }))

  // 祈りバフによる補正
  // 祈りバフ = battleBuffsに type: 'targetRateUp' が存在
  const prayerBonuses = alive.reduce((sum, m) => {
    const prayerBuff = m.battleBuffs.find(b => b.type === 'targetRateUp')
    return sum + (prayerBuff ? prayerBuff.value / 100 : 0)  // value=25 → 0.25
  }, 0)

  // 強い者いじめ: HP最大者を特定し、被弾率ボーナスを加算（同率複数人は全員対象）
  const bullyBonus = getHighHpTargetRateBonus(relics) / 100  // value=15 → 0.15
  const highestHpIds = new Set<string>()
  if (bullyBonus > 0) {
    const maxHp = Math.max(...alive.map(m => m.hp))
    alive.forEach(m => { if (m.hp === maxHp) highestHpIds.add(m.id) })
  }

  // まず基本確率を計算
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
  const baseRates = weights.map(w => ({
    explorerId: w.explorerId,
    rate: w.weight / totalWeight,
  }))

  if (prayerBonuses === 0 && highestHpIds.size === 0) return baseRates

  // バフ/レリックによる補正の合計
  // 対象者: 被弾率を +value% (絶対値加算)
  // 非対象者: 合計 value% を前衛/後衛の重みで按分減少
  const totalBonus = prayerBonuses + bullyBonus * highestHpIds.size

  // ボーナス対象者（祈り or 強い者いじめ）を判定
  const isBonusTarget = (explorerId: string): boolean => {
    const member = alive.find(m => m.id === explorerId)
    if (member?.battleBuffs.some(b => b.type === 'targetRateUp')) return true
    if (highestHpIds.has(explorerId)) return true
    return false
  }

  // 非対象者の重み合計を計算（減少の傾斜用）
  const unbuffedWeights = weights.filter(w => !isBonusTarget(w.explorerId))
  const unbuffedWeightTotal = unbuffedWeights.reduce((sum, w) => sum + w.weight, 0)

  const adjusted = baseRates.map(r => {
    const member = alive.find(m => m.id === r.explorerId)
    const prayerBuff = member?.battleBuffs.find(b => b.type === 'targetRateUp')
    let rate = r.rate
    if (prayerBuff) {
      rate += prayerBuff.value / 100
    }
    if (highestHpIds.has(r.explorerId)) {
      rate += bullyBonus
    }
    if (prayerBuff || highestHpIds.has(r.explorerId)) {
      return { ...r, rate }
    }
    // 非対象者: 重みに応じて減少を按分
    if (unbuffedWeightTotal > 0) {
      const w = weights.find(x => x.explorerId === r.explorerId)!
      const reduction = totalBonus * (w.weight / unbuffedWeightTotal)
      return { ...r, rate: Math.max(0, r.rate - reduction) }
    }
    return r
  })

  // H3対策: レート合計が1を超えた場合の正規化（全員ボーナス持ちなど）
  const total = adjusted.reduce((s, r) => s + r.rate, 0)
  if (total > 0) {
    return adjusted.map(r => ({ ...r, rate: r.rate / total }))
  }
  return adjusted
}

/**
 * ターゲット率に基づいてランダムにターゲットを選択
 */
export function selectTargetByRate(rates: TargetRate[]): string | null {
  if (rates.length === 0) return null

  const roll = Math.random()
  let cumulative = 0
  for (const entry of rates) {
    cumulative += entry.rate
    if (roll < cumulative) {
      return entry.explorerId
    }
  }
  // 浮動小数点の丸め誤差対策
  return rates[rates.length - 1].explorerId
}
