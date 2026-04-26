import { useEffect, useMemo, useState } from 'react'
import { Button } from '../Common/Button'
import { useGame } from '../../Hooks/UseGame'
import { ResultMemberPanel } from '../Result'
import { MemberAnimationPhase, ResultBonusEntry } from '../../Lib/Types/Game'

/** 報酬カードの小項目 */
interface RewardEntry {
  key: string
  label: string
  value: number
  /** 符号付き表示（+6/-2）。bonusEntries のみ true */
  signed?: boolean
  emphasize?: boolean
}

/** 各段階の遅延（ms） */
const REWARD_ITEM_INTERVAL_MS = 1000
const CARD_TO_MEMBER_DELAY_MS = 500
const MEMBER_ENTER_TO_RESOURCES_MS = 200
const MEMBER_RESOURCE_ANIMATE_MS = 800
const MEMBER_SHAKE_MS = 500
const MEMBER_LEVEL_UPDATE_TO_MAX_MS = 1000
const MEMBER_MAX_TO_DONE_MS = 500

export function ResultScreen() {
  const { state, openStore } = useGame()
  const { resultState } = state

  // 敗北時は BattleScreen のオーバーレイで処理するため、ここには勝利時のみ到達する
  const isVictory = !!resultState && resultState.result === 'victory'

  // 報酬小項目リスト（0G の interest/stolen/bonus は除外、合計は常に表示）
  const rewardEntries = useMemo<RewardEntry[]>(() => {
    if (!isVictory || !resultState) return []
    const entries: RewardEntry[] = []
    entries.push({ key: 'baseGold', label: '報酬', value: resultState.baseGold })
    if (resultState.interestGold > 0) {
      entries.push({ key: 'interest', label: '利子', value: resultState.interestGold })
    }
    if (resultState.stolenGold > 0) {
      entries.push({ key: 'stolen', label: '盗取', value: resultState.stolenGold })
    }
    resultState.bonusEntries.forEach((b: ResultBonusEntry, i: number) => {
      if (b.value === 0) return
      entries.push({ key: `bonus-${i}`, label: b.source, value: b.value, signed: true })
    })
    entries.push({
      key: 'total',
      label: '獲得計',
      value: resultState.goldEarned,
      emphasize: true,
    })
    return entries
  }, [isVictory, resultState])

  const memberDiffs = resultState?.memberDiffs ?? []

  // ステップ管理
  // cardStep: 0 = 大カードのみ表示, 1..rewardEntries.length = N件表示済み
  const [cardStep, setCardStep] = useState(0)
  const [memberStep, setMemberStep] = useState(0)
  const [memberPhase, setMemberPhase] = useState<MemberAnimationPhase>('pending')

  const cardComplete = cardStep >= rewardEntries.length

  // 報酬カードの小項目を1秒ずつ追加
  useEffect(() => {
    if (!isVictory) return
    if (cardComplete) return
    const t = setTimeout(() => setCardStep(s => s + 1), REWARD_ITEM_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [isVictory, cardComplete, cardStep])

  // 報酬カード完了後、メンバーアニメ開始
  useEffect(() => {
    if (!isVictory) return
    if (!cardComplete) return
    if (memberPhase !== 'pending') return
    if (memberStep >= memberDiffs.length) return
    const t = setTimeout(() => setMemberPhase('enter'), CARD_TO_MEMBER_DELAY_MS)
    return () => clearTimeout(t)
  }, [isVictory, cardComplete, memberPhase, memberStep, memberDiffs.length])

  // メンバー内フェーズ進行
  useEffect(() => {
    if (memberPhase === 'pending' || memberPhase === 'done') return
    if (memberStep >= memberDiffs.length) return

    const currentDiff = memberDiffs[memberStep]
    const leveledUp = currentDiff.levelDiff > 0

    let nextPhase: MemberAnimationPhase
    let delay: number

    switch (memberPhase) {
      case 'enter':
        nextPhase = 'resourcesAnimate'
        delay = MEMBER_ENTER_TO_RESOURCES_MS
        break
      case 'resourcesAnimate':
        nextPhase = leveledUp ? 'shaking' : 'done'
        delay = MEMBER_RESOURCE_ANIMATE_MS
        break
      case 'shaking':
        nextPhase = 'levelUpdated'
        delay = MEMBER_SHAKE_MS
        break
      case 'levelUpdated':
        nextPhase = 'maxStatsRevealed'
        delay = MEMBER_LEVEL_UPDATE_TO_MAX_MS
        break
      case 'maxStatsRevealed':
        nextPhase = 'done'
        delay = MEMBER_MAX_TO_DONE_MS
        break
      default:
        return
    }

    const t = setTimeout(() => setMemberPhase(nextPhase), delay)
    return () => clearTimeout(t)
  }, [memberPhase, memberStep, memberDiffs])

  // done になったら次のメンバーへ
  useEffect(() => {
    if (memberPhase !== 'done') return
    if (memberStep >= memberDiffs.length) return
    // 次のメンバーへリセット
    setMemberStep(s => s + 1)
    setMemberPhase('pending')
  }, [memberPhase, memberStep, memberDiffs.length])

  if (!isVictory || !resultState) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-green-900">
      <h1 className="text-5xl font-bold text-white mb-6">VICTORY</h1>

      {/* 報酬情報 */}
      <div className="bg-black/30 rounded-lg p-6 mb-6 min-w-64 animate-card-fade">
        <h2 className="text-xl text-white mb-4 font-semibold">獲得報酬</h2>
        <div className="space-y-2 text-white">
          {rewardEntries.slice(0, cardStep).map(entry => {
            const isTotal = entry.key === 'total'
            const valueColor =
              entry.value < 0 ? 'text-red-400' : 'text-yellow-400'
            const sign = entry.signed && entry.value > 0 ? '+' : ''
            return (
              <div
                key={entry.key}
                className={`flex justify-between animate-item-fade ${
                  isTotal ? 'border-t border-gray-600 pt-2 mt-2 font-semibold' : ''
                }`}
              >
                <span className={isTotal ? 'text-white' : 'text-gray-300'}>
                  {entry.label}:
                </span>
                <span className={`${valueColor} ${isTotal ? 'font-semibold' : ''}`}>
                  {sign}
                  {entry.value} G
                </span>
              </div>
            )
          })}
          {/* 純増行（goldEarned と goldDiff が一致しないときのみ、合計表示後に出現） */}
          {cardComplete && resultState.goldDiff !== resultState.goldEarned && (
            <div className="flex justify-between items-center animate-item-fade">
              <span className="text-gray-300">純増:</span>
              <span className="flex items-center gap-1">
                <span className={resultState.goldDiff >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {resultState.goldDiff >= 0 ? '+' : ''}
                  {resultState.goldDiff} G
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* メンバー別変化量 */}
      {memberDiffs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 w-full max-w-4xl">
          {memberDiffs.map((diff, index) => {
            // 各メンバーの phase を決定:
            // - index < memberStep: 既に完了 ('done')
            // - index === memberStep: 現在のフェーズ
            // - index > memberStep: 'pending'（未表示）
            // ただし memberStep が memberDiffs.length に達した後はすべて 'done'
            let phase: MemberAnimationPhase
            if (index < memberStep) {
              phase = 'done'
            } else if (index === memberStep) {
              phase = memberPhase
            } else {
              phase = 'pending'
            }
            return (
              <ResultMemberPanel key={diff.explorerId} diff={diff} phase={phase} />
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Button variant="primary" size="lg" onClick={openStore}>
          ストアへ
        </Button>
      </div>
    </div>
  )
}
