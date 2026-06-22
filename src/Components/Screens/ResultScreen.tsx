import { useEffect, useState } from 'react'
import { Button } from '../Common/Button'
import { useGame } from '../../Hooks/UseGame'
import { ResultMemberPanel } from '../Result'
import { MemberAnimationPhase } from '../../Lib/Types/Game'

/** 各段階の遅延（ms） */
const CARD_TO_MEMBER_DELAY_MS = 500
const MEMBER_ENTER_TO_RESOURCES_MS = 200
const MEMBER_RESOURCE_ANIMATE_MS = 800
const MEMBER_SHAKE_MS = 1500   // levelup-stretch keyframes と同期（2ニョキ完了）
const MEMBER_LEVEL_UPDATE_TO_MAX_MS = 1000
const MEMBER_MAX_TO_DONE_MS = 500

export function ResultScreen() {
  const { state, openPotionShop } = useGame()
  const { resultState } = state

  // 敗北時は BattleScreen のオーバーレイで処理するため、ここには勝利時のみ到達する
  const isVictory = !!resultState && resultState.result === 'victory'

  const memberDiffs = resultState?.memberDiffs ?? []

  // ステップ管理
  const [memberStep, setMemberStep] = useState(0)
  const [memberPhase, setMemberPhase] = useState<MemberAnimationPhase>('pending')

  // 画面表示後、メンバーアニメ開始
  useEffect(() => {
    if (!isVictory) return
    if (memberPhase !== 'pending') return
    if (memberStep >= memberDiffs.length) return
    const t = setTimeout(() => setMemberPhase('enter'), CARD_TO_MEMBER_DELAY_MS)
    return () => clearTimeout(t)
  }, [isVictory, memberPhase, memberStep, memberDiffs.length])

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

      {resultState.goldEarned > 0 && (
        <p className="text-2xl font-bold text-yellow-300 mb-4">
          +{resultState.goldEarned} G
        </p>
      )}

      {/* メンバー別変化量 */}
      {memberDiffs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 w-full max-w-4xl">
          {memberDiffs.map((diff, index) => {
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
        <Button variant="primary" size="lg" onClick={openPotionShop}>
          ポーションショップへ
        </Button>
      </div>
    </div>
  )
}
