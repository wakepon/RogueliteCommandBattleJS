import { useEffect, useRef, useState } from 'react'
import { PlayerDamagePopup } from '../../Lib/Types/Battle'

// ポップアップ表示時間
const POPUP_DURATION_MS = 2250

interface PlayerDamagePopupEffectProps {
  popup: PlayerDamagePopup
  onComplete: () => void
}

/**
 * プレイヤー（メンバー）のHPバー付近から上に飛んでフェードアウトするダメージ/回復ポップアップ
 * - ダメージ（damage > 0）: 赤
 * - 回復（damage < 0）: 緑
 */
export function PlayerDamagePopupEffect({ popup, onComplete }: PlayerDamagePopupEffectProps) {
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    // 対象メンバーのHPバー位置を取得
    if (popup.targetExplorerId) {
      const el = document.getElementById(`hp-bar-${popup.targetExplorerId}`)
      if (el) {
        const rect = el.getBoundingClientRect()
        setPos({ x: rect.left + rect.width / 2, y: rect.top })
      }
    }

    const timer = setTimeout(() => {
      onCompleteRef.current()
    }, POPUP_DURATION_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!pos) return null

  const isHealing = popup.damage < 0
  const isLabelOnly = popup.damage === 0
  // damage=0かつlabelなしは想定外（空ポップアップを残さない）
  if (isLabelOnly && !popup.label) return null
  const displayText = isHealing ? `+${Math.abs(popup.damage)}` : `-${popup.damage}`
  const textColorClass = isHealing ? 'text-green-400' : 'text-red-500'

  return (
    <div
      className="fixed pointer-events-none animate-damage-popup z-40"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="flex flex-col items-center">
        {popup.label && (
          <span className={`drop-shadow-md whitespace-nowrap ${isLabelOnly ? 'text-base font-bold text-yellow-300' : 'text-[10px] text-gray-200 mb-0.5'}`}>
            {popup.label}
          </span>
        )}
        {!isLabelOnly && (
          <span className={`text-2xl font-bold drop-shadow-lg ${textColorClass}`}>
            {displayText}
          </span>
        )}
      </div>
    </div>
  )
}
