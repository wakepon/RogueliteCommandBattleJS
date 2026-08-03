import { useEffect, useRef, useState } from 'react'
import { LevelUpInfo } from '../../Lib/Core/LevelUpCalculator'

/** 表示前の溜め時間（メンバーカードのストレッチ演出と同期、2ニョキ分） */
const DELAY_BEFORE_SHOW_MS = 1500
const POPUP_DURATION_MS = 2250

interface LevelUpPopupEffectProps {
  levelUpInfo: LevelUpInfo
  onComplete: () => void
}

/**
 * レベルアップポップアップ
 * 0.5秒の溜め（メンバーカードのニョキニョキ演出と同期）の後、
 * 対象メンバーのHPバー位置から「Level Up!」+ HP/MP 回復量を上にフェードアウト表示
 */
export function LevelUpPopupEffect({ levelUpInfo, onComplete }: LevelUpPopupEffectProps) {
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    // 0.5秒の溜めを経てから位置取得＆表示開始
    const showTimer = setTimeout(() => {
      const el = document.getElementById(`hp-bar-${levelUpInfo.explorerId}`)
      if (el) {
        const rect = el.getBoundingClientRect()
        setPos({ x: rect.left + rect.width / 2, y: rect.top })
      }
      setVisible(true)
    }, DELAY_BEFORE_SHOW_MS)

    // 表示完了タイマー（溜め + アニメ）
    const closeTimer = setTimeout(() => {
      onCompleteRef.current()
    }, DELAY_BEFORE_SHOW_MS + POPUP_DURATION_MS)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(closeTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible || !pos) return null

  return (
    <div
      className="fixed pointer-events-none animate-damage-popup z-40"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-3xl font-bold text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] whitespace-nowrap">
          Level Up!
        </span>
        {levelUpInfo.hpRecovered > 0 && (
          <span className="text-xl font-bold text-green-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] whitespace-nowrap">
            HP +{levelUpInfo.hpRecovered} 回復
          </span>
        )}
      </div>
    </div>
  )
}
