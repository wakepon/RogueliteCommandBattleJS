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
  const adjustedRates = baseRates.map(r => {
    const member = alive.find(m => m.id === r.explorerId)
    const prayerBuff = member?.battleBuffs.find(b => b.type === 'targetRateUp')
    if (prayerBuff) {
      return { ...r, rate: r.rate + prayerBuff.value / 100 }
    }
    return r
  })

  // 合計が1を超える場合は正規化
  const totalRate = adjustedRates.reduce((sum, r) => sum + r.rate, 0)
  if (totalRate > 1) {
    return adjustedRates.map(r => ({ ...r, rate: r.rate / totalRate }))
  }

  // 合計が1未満の場合、祈りバフなしのキャラで按分調整
  const buffedTotal = adjustedRates
    .filter(r => {
      const member = alive.find(m => m.id === r.explorerId)
      return member?.battleBuffs.some(b => b.type === 'targetRateUp')
    })
    .reduce((sum, r) => sum + r.rate, 0)
  const remainingRate = 1 - buffedTotal
  const unbuffedRates = adjustedRates.filter(r => {
    const member = alive.find(m => m.id === r.explorerId)
    return !member?.battleBuffs.some(b => b.type === 'targetRateUp')
  })
  const unbuffedTotal = unbuffedRates.reduce((sum, r) => sum + r.rate, 0)

  if (unbuffedTotal > 0) {
    return adjustedRates.map(r => {
      const member = alive.find(m => m.id === r.explorerId)
      if (member?.battleBuffs.some(b => b.type === 'targetRateUp')) {
        return r
      }
      return { ...r, rate: (r.rate / unbuffedTotal) * remainingRate }
    })
  }

  return adjustedRates
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
