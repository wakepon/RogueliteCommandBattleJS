import { useEffect, useRef, useState } from 'react'
import { DamageContributor } from '../../Lib/Types/Battle'

const POPUP_DURATION_MS = 2250
const MULTI_HIT_Y_OFFSET = 12

interface DamagePopupProps {
  damage: number
  targetIndex: number
  totalTargets: number
  onComplete: () => void
  contributors?: DamageContributor[]
  delayMs?: number
  fadeAfterMs?: number
  fadeDurationMs?: number
  hitIndex?: number
}

function calculatePosition(targetIndex: number, totalTargets: number): { x: number; y: number } {
  const cols = Math.min(totalTargets, 2)
  const row = Math.floor(targetIndex / cols)
  const col = targetIndex % cols
  const cellWidth = 100 / cols
  const x = cellWidth * col + cellWidth / 2
  const y = 30 + row * 40
  return { x, y }
}

export function DamagePopup({ damage, targetIndex, totalTargets, onComplete, contributors, delayMs, fadeAfterMs, fadeDurationMs, hitIndex }: DamagePopupProps) {
  const { x, y } = calculatePosition(targetIndex, totalTargets)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const isMultiHit = delayMs !== undefined && fadeAfterMs !== undefined && fadeDurationMs !== undefined
  const [visible, setVisible] = useState(!isMultiHit || delayMs === 0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    if (isMultiHit) {
      if (delayMs > 0) {
        timers.push(setTimeout(() => setVisible(true), delayMs))
      }
      timers.push(setTimeout(() => setFading(true), fadeAfterMs))
      timers.push(setTimeout(() => onCompleteRef.current(), fadeAfterMs + fadeDurationMs))
    } else {
      timers.push(setTimeout(() => onCompleteRef.current(), POPUP_DURATION_MS))
    }

    return () => timers.forEach(clearTimeout)
  }, [])

  const isHealing = damage < 0
  const displayText = isHealing ? `+${Math.abs(damage)}` : `-${damage}`
  const textColorClass = isHealing ? 'text-green-400' : 'text-red-500'
  const hasContributors = contributors && contributors.length > 0

  if (isMultiHit) {
    const yOffset = (hitIndex ?? 0) * MULTI_HIT_Y_OFFSET
    return (
      <div
        className="absolute pointer-events-none z-10"
        style={{
          left: `${x}%`,
          top: `calc(${y}% + ${yOffset}px)`,
          opacity: visible ? (fading ? 0 : 1) : 0,
          transition: fading
            ? `opacity ${fadeDurationMs}ms ease-out, transform ${fadeDurationMs}ms ease-out`
            : 'opacity 0.05s',
          transform: `translate(-50%, -50%) translateY(${fading ? '-30px' : '0px'})`,
        }}
      >
        <div className="flex flex-col items-center">
          <span className={`text-2xl font-bold drop-shadow-lg ${textColorClass}`}>
            {displayText}
          </span>
          {hasContributors && (
            <div className="flex flex-col items-center mt-0.5">
              {contributors.map((c, i) => (
                <span key={i} className="text-[9px] text-gray-300 drop-shadow-md whitespace-nowrap leading-tight">
                  {c.name} {c.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="absolute pointer-events-none animate-damage-popup z-10"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="flex flex-col items-center">
        <span className={`text-2xl font-bold drop-shadow-lg ${textColorClass}`}>
          {displayText}
        </span>
        {hasContributors && (
          <div className="flex flex-col items-center mt-0.5">
            {contributors.map((c, i) => (
              <span key={i} className="text-[9px] text-gray-300 drop-shadow-md whitespace-nowrap leading-tight">
                {c.name} {c.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
