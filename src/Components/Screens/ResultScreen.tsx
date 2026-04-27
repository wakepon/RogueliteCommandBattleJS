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
const MEMBER_SHAKE_MS = 1500   // levelup-stretch keyframes と同期（2ニョキ完了）
const MEMBER_LEVEL_UPDATE_TO_MAX_MS = 1000
const MEMBER_MAX_TO_DONE_MS = 500

export function ResultScreen() {
  const { state, openStore } = useGame()
  const { resultState } = state

  // 敗北時は BattleScreen のオーバーレイで処理するため、ここには勝利時のみ到達する
  const isVictory = !!resultState && resultState.result === 'victory'

  // 報酬小項目リスト
  // 順序: 報酬 → ボーナスエントリ（金のまじない等） → 利子 → 盗取 → 獲得計
  const rewardEntries = useMemo<RewardEntry[]>(() => {
    if (!isVictory || !resultState) return []
    const entries: RewardEntry[] = []
    entries.push({ key: 'baseGold', label: '報酬', value: resultState.baseGold })
    // 魔法/レリック効果によるボーナス（金のまじない等）を「報酬」と「利子」の間に挿入
    resultState.bonusEntries.forEach((b: ResultBonusEntry, i: number) => {
      if (b.value === 0) return
      entries.push({ key: `bonus-${i}`, label: b.source, value: b.value, signed: true })
    })
    if (resultState.interestGold > 0) {
      entries.push({ key: 'interest', label: '利子', value: resultState.interestGold })
    }
    if (resultState.stolenGold > 0) {
      entries.push({ key: 'stolen', label: '盗取', value: resultState.stolenGold })
    }
    entries.push({
      key: 'total',
      label: '獲得計',
      value: resultState.goldEarned,
      signed: true,
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

  // cardStep の取りうる値:
  //  0..rewardEntries.length-1 : 小項目を順に追加中
  //  rewardEntries.length      : 全小項目（獲得計まで）表示済み、所持金は未表示
  //  rewardEntries.length + 1  : 所持金まで表示完了
  const goldRevealed = cardStep > rewardEntries.length

  // 報酬カードの小項目＆所持金を1秒間隔で追加
  useEffect(() => {
    if (!isVictory) return
    if (goldRevealed) return
    const t = setTimeout(() => setCardStep(s => s + 1), REWARD_ITEM_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [isVictory, goldRevealed, cardStep])

  // 所持金表示後、メンバーアニメ開始
  useEffect(() => {
    if (!isVictory) return
    if (!goldRevealed) return
    if (memberPhase !== 'pending') return
    if (memberStep >= memberDiffs.length) return
    const t = setTimeout(() => setMemberPhase('enter'), CARD_TO_MEMBER_DELAY_MS)
    return () => clearTimeout(t)
  }, [isVictory, goldRevealed, memberPhase, memberStep, memberDiffs.length])

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

  const currentGold = state.run?.gold ?? 0

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-green-900">
      <h1 className="text-5xl font-bold text-white mb-6">VICTORY</h1>

      {/* 所持金カード */}
      <div className="bg-black/30 rounded-lg p-6 mb-6 min-w-64 animate-card-fade">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl text-white font-semibold">所持金</h2>
          {/* 獲得計表示の1秒後に現在の所持金（balatro風） */}
          {goldRevealed && (
            <span className="text-2xl text-yellow-400 font-bold animate-item-fade">
              {currentGold} G
            </span>
          )}
        </div>
        <div className="space-y-2 text-white">
          {rewardEntries.slice(0, Math.min(cardStep, rewardEntries.length)).map(entry => {
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
