import { useEffect, useRef, useState } from 'react'
import { getRequiredKillsForNextLevel } from '../../Lib/Core/LevelUpCalculator'

interface ExpGaugeProps {
  exp: number                    // 実際の経験値（レベルアップ後の値）
  level: number                  // 実際のレベル
  levelUpPopupCount: number      // 残りのレベルアップポップアップ数
  onFillComplete?: () => void    // ゲージ満タンアニメーション完了時のコールバック
}

export function ExpGauge({ exp, level, levelUpPopupCount, onFillComplete }: ExpGaugeProps) {
  const [visualExp, setVisualExp] = useState(exp)
  const [visualLevel, setVisualLevel] = useState(level)
  const [transitionEnabled, setTransitionEnabled] = useState(true)

  const prevLevelRef = useRef(level)
  const prevExpRef = useRef(exp)
  const prevPopupCountRef = useRef(levelUpPopupCount)
  const fillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafIdRef = useRef<number | null>(null)

  // exp または level の変化を検知
  useEffect(() => {
    const prevLevel = prevLevelRef.current

    if (level > prevLevel) {
      // 前回のタイマーをクリア（連続レベルアップ対応）
      if (fillTimerRef.current) {
        clearTimeout(fillTimerRef.current)
      }

      // レベルアップ: バーを100%へアニメーション
      const oldRequired = getRequiredKillsForNextLevel(prevLevel)
      setVisualExp(oldRequired)
      // visualLevelは旧レベルのまま（バー表示用）

      // 1秒後にonFillComplete
      fillTimerRef.current = setTimeout(() => {
        fillTimerRef.current = null
        onFillComplete?.()
      }, 1000)

      prevLevelRef.current = level
      prevExpRef.current = exp
      return () => {
        if (fillTimerRef.current) {
          clearTimeout(fillTimerRef.current)
          fillTimerRef.current = null
        }
      }
    } else {
      // 通常のexp増加
      setVisualExp(exp)
    }

    prevLevelRef.current = level
    prevExpRef.current = exp
  }, [exp, level, onFillComplete])

  // レベルアップポップアップが全て閉じた時のリセット処理
  useEffect(() => {
    const prevCount = prevPopupCountRef.current
    prevPopupCountRef.current = levelUpPopupCount

    if (prevCount > 0 && levelUpPopupCount === 0) {
      // 前回のRAFをクリア
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }

      // transition無効化 → 0%にジャンプ
      setTransitionEnabled(false)
      setVisualExp(0)
      setVisualLevel(level)

      // 次フレームでtransition有効化 → 実際のexpへアニメーション
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null
          setTransitionEnabled(true)
          setVisualExp(exp)
        })
      })
    }

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [levelUpPopupCount, level, exp])

  const required = getRequiredKillsForNextLevel(visualLevel)
  const percentage = required > 0 ? Math.max(0, Math.min(100, (visualExp / required) * 100)) : 0
  const shouldBlink = required - visualExp === 1 && levelUpPopupCount === 0

  return (
    <div>
      <div className={`flex justify-between text-xs mb-0.5 ${shouldBlink ? 'text-yellow-400 animate-exp-blink' : 'text-gray-400'}`}>
        <span>EXP</span>
        <span>{visualExp} / {required}</span>
      </div>
      <div className="w-full bg-gray-700 rounded h-2 overflow-hidden">
        <div
          className={`bg-yellow-500 h-2 ${transitionEnabled ? 'transition-[width] duration-1000' : ''} ${shouldBlink ? 'animate-exp-blink' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
