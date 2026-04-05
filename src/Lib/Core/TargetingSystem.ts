import { ExplorerState } from '../Types/Explorer'

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
export function calculateTargetRates(party: ExplorerState[]): TargetRate[] {
  const alive = party.filter(m => m.hp > 0)
  if (alive.length === 0) return []

  // 基本ウェイト: 前衛=2, 後衛=1
  const weights = alive.map(m => ({
    explorerId: m.id,
    weight: m.position === 'front' ? 2 : 1,
  }))

  // 祈りバフによる補正
  // 祈りバフ = battleBuffsに type: 'targetRateUp' が存在
  const prayerBonuses = alive.reduce((sum, m) => {
    const prayerBuff = m.battleBuffs.find(b => b.type === 'targetRateUp')
    return sum + (prayerBuff ? prayerBuff.value / 100 : 0)  // value=25 → 0.25
  }, 0)

  // まず基本確率を計算
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
  const baseRates = weights.map(w => ({
    explorerId: w.explorerId,
    rate: w.weight / totalWeight,
  }))

  if (prayerBonuses === 0) return baseRates

  // 祈りバフを適用
  // 対象者: 被弾率を +value% (絶対値加算)
  // 非対象者: 合計 value% を前衛/後衛の重みで按分減少
  const totalBonus = prayerBonuses  // 例: 0.25 (25%)

  // 非対象者の重み合計を計算（減少の傾斜用）
  const unbuffedWeights = weights.filter(w => {
    const member = alive.find(m => m.id === w.explorerId)
    return !member?.battleBuffs.some(b => b.type === 'targetRateUp')
  })
  const unbuffedWeightTotal = unbuffedWeights.reduce((sum, w) => sum + w.weight, 0)

  return baseRates.map(r => {
    const member = alive.find(m => m.id === r.explorerId)
    const prayerBuff = member?.battleBuffs.find(b => b.type === 'targetRateUp')
    if (prayerBuff) {
      // 対象者: +value%
      return { ...r, rate: r.rate + prayerBuff.value / 100 }
    }
    // 非対象者: 重みに応じて減少を按分
    if (unbuffedWeightTotal > 0) {
      const w = weights.find(x => x.explorerId === r.explorerId)!
      const reduction = totalBonus * (w.weight / unbuffedWeightTotal)
      return { ...r, rate: Math.max(0, r.rate - reduction) }
    }
    return r
  })
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
