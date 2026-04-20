import { useEffect, useRef, useState } from 'react'
import { ExpPopup } from '../../Lib/Types/Battle'

interface ExpPopupEffectProps {
  popup: ExpPopup
  onComplete: () => void
}

const FLIGHT_DURATION_MS = 600

/**
 * 敵の位置からメンバーの経験値バーへ「+1」や「とどめボーナス +1」を飛ばすエフェクト
 * DOMのbounding rectをマウント時に取得し、fixed配置でtransition移動+フェードアウト
 */
export function ExpPopupEffect({ popup, onComplete }: ExpPopupEffectProps) {
  const [phase, setPhase] = useState<'pending' | 'flying' | 'done'>('pending')
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const [endPos, setEndPos] = useState<{ x: number; y: number } | null>(null)

  // onComplete は毎レンダーで新しい関数参照になるため ref 経由で呼ぶ
  // （useEffect の deps に入れるとタイマーが再レンダーのたびにリセットされてしまう）
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // マウント時のみ実行: popup.delayMs 経過 → 発射 → FLIGHT_DURATION_MS 経過 → 完了
  useEffect(() => {
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
      setPhase('flying')

      doneTimer = setTimeout(() => {
        setPhase('done')
        onCompleteRef.current()
      }, FLIGHT_DURATION_MS)
    }, popup.delayMs)
    return () => {
      clearTimeout(delayTimer)
      if (doneTimer) clearTimeout(doneTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (phase === 'pending' || phase === 'done' || !startPos || !endPos) return null

  // 発射位置を起点に、translate で終点まで移動させる（CSS transition）
  const dx = endPos.x - startPos.x
  const dy = endPos.y - startPos.y

  return (
    <div
      className="fixed pointer-events-none z-40 font-bold text-yellow-300 whitespace-nowrap"
      style={{
        left: `${startPos.x}px`,
        top: `${startPos.y}px`,
        transform: `translate(-50%, -50%) translate(var(--exp-dx), var(--exp-dy))`,
        opacity: 'var(--exp-op)',
        transition: `transform ${FLIGHT_DURATION_MS}ms ease-out, opacity ${FLIGHT_DURATION_MS}ms ease-out`,
        fontSize: popup.bonusLabel ? '0.875rem' : '1rem',
        textShadow: '0 0 4px rgba(0,0,0,0.8)',
        ['--exp-dx' as string]: `${dx}px`,
        ['--exp-dy' as string]: `${dy}px`,
        ['--exp-op' as string]: '0',
      }}
      ref={el => {
        // マウント直後は 0 の値を初期値として適用（CSS変数が初期値でレンダリングされるよう2段階）
        if (el) {
          // 初回 paint では dx=0/dy=0/op=1
          el.style.setProperty('--exp-dx', '0px')
          el.style.setProperty('--exp-dy', '0px')
          el.style.setProperty('--exp-op', '1')
          // 次フレームで最終位置/opacity に書き換え → transition が発火
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.setProperty('--exp-dx', `${dx}px`)
              el.style.setProperty('--exp-dy', `${dy}px`)
              el.style.setProperty('--exp-op', '0')
            })
          })
        }
      }}
    >
      {popup.bonusLabel ? `${popup.bonusLabel} +${popup.amount}` : `+${popup.amount}`}
    </div>
  )
}
