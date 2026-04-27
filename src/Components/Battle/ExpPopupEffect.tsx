import { useEffect, useRef, useState } from 'react'
import { ExpPopup } from '../../Lib/Types/Battle'

interface ExpPopupEffectProps {
  popup: ExpPopup
  onComplete: () => void
}

/** 出現後、敵の近くで静止する時間（ms） */
const STATIC_HOLD_MS = 500
/** メンバーの経験値バーまで飛行する時間（ms） */
const FLIGHT_DURATION_MS = 600

/**
 * 敵の位置からメンバーの経験値バーへ「+1」や「とどめボーナス +1」を飛ばすエフェクト
 * シーケンス: pending（delayMs 待機）→ static（敵位置で 500ms 静止）→ flying（メンバーへ移動）→ done
 */
export function ExpPopupEffect({ popup, onComplete }: ExpPopupEffectProps) {
  const [phase, setPhase] = useState<'pending' | 'static' | 'flying' | 'done'>('pending')
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const [endPos, setEndPos] = useState<{ x: number; y: number } | null>(null)

  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // マウント時のみ実行: delayMs 経過 → 静止 → 飛行 → 完了
  useEffect(() => {
    let staticTimer: ReturnType<typeof setTimeout> | null = null
    let doneTimer: ReturnType<typeof setTimeout> | null = null

    const delayTimer = setTimeout(() => {
      const enemyEl = document.getElementById(`enemy-dom-${popup.enemyInstanceId}`)
      const expEl = document.getElementById(`exp-gauge-${popup.targetExplorerId}`)
      if (!enemyEl || !expEl) {
        onCompleteRef.current()
        return
      }
      const eRect = enemyEl.getBoundingClientRect()
      const xRect = expEl.getBoundingClientRect()
      setStartPos({ x: eRect.left + eRect.width / 2, y: eRect.top + eRect.height / 2 })
      setEndPos({ x: xRect.left + xRect.width / 2, y: xRect.top + xRect.height / 2 })
      // 出現後はまず敵の近くで静止
      setPhase('static')

      staticTimer = setTimeout(() => {
        setPhase('flying')
        doneTimer = setTimeout(() => {
          setPhase('done')
          onCompleteRef.current()
        }, FLIGHT_DURATION_MS)
      }, STATIC_HOLD_MS)
    }, popup.delayMs)
    return () => {
      clearTimeout(delayTimer)
      if (staticTimer) clearTimeout(staticTimer)
      if (doneTimer) clearTimeout(doneTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (phase === 'pending' || phase === 'done' || !startPos || !endPos) return null

  const dx = endPos.x - startPos.x
  const dy = endPos.y - startPos.y

  // 静止中は startPos に固定表示。flying 中は startPos 起点に dx/dy へ transition で移動。
  const isFlying = phase === 'flying'

  return (
    <div
      className="fixed pointer-events-none z-40 font-bold text-yellow-300 whitespace-nowrap"
      style={{
        left: `${startPos.x}px`,
        top: `${startPos.y}px`,
        transform: `translate(-50%, -50%) translate(var(--exp-dx), var(--exp-dy))`,
        opacity: 'var(--exp-op)',
        transition: isFlying
          ? `transform ${FLIGHT_DURATION_MS}ms ease-out, opacity ${FLIGHT_DURATION_MS}ms ease-out`
          : 'none',
        fontSize: popup.bonusLabel ? '0.875rem' : '1rem',
        textShadow: '0 0 4px rgba(0,0,0,0.8)',
        ['--exp-dx' as string]: '0px',
        ['--exp-dy' as string]: '0px',
        ['--exp-op' as string]: '1',
      }}
      ref={el => {
        if (!el) return
        if (isFlying) {
          // 静止 → 飛行に切り替わったタイミングで終点へ transition 発火
          el.style.setProperty('--exp-dx', '0px')
          el.style.setProperty('--exp-dy', '0px')
          el.style.setProperty('--exp-op', '1')
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.setProperty('--exp-dx', `${dx}px`)
              el.style.setProperty('--exp-dy', `${dy}px`)
              el.style.setProperty('--exp-op', '0')
            })
          })
        } else {
          // 静止中は敵の位置に固定
          el.style.setProperty('--exp-dx', '0px')
          el.style.setProperty('--exp-dy', '0px')
          el.style.setProperty('--exp-op', '1')
        }
      }}
    >
      {popup.bonusLabel ? `${popup.bonusLabel} +${popup.amount}` : `+${popup.amount}`}
    </div>
  )
}
