import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { DetailedDamagePreview, CommandDamageSegment } from '../../Lib/Utils/DamagePredictor'

interface KillLineBarProps {
  currentHp: number
  maxHp: number
  damagePreview: DetailedDamagePreview | null
}

/** セグメントの色パレット（武器系 / 魔法系） */
const WEAPON_COLORS = ['bg-orange-500', 'bg-amber-500', 'bg-yellow-600']
const SPELL_COLORS = ['bg-purple-400', 'bg-indigo-400', 'bg-violet-500']

function getSegmentColor(segment: CommandDamageSegment, index: number): string {
  if (segment.commandCategory === 'weapon') {
    return WEAPON_COLORS[index % WEAPON_COLORS.length]
  }
  return SPELL_COLORS[index % SPELL_COLORS.length]
}

const POPUP_WIDTH = 280

/**
 * キルラインバー
 *
 * 通常時: シンプルな3ゾーン表示（残HP/ブレ幅/確定ダメ）
 * ホバー時: Portalベースの拡大ポップアップで積み上げ棒グラフを表示
 */
export function KillLineBar({ currentHp, maxHp, damagePreview }: KillLineBarProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 })
  const [offsetX, setOffsetX] = useState(0)
  const triggerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const showPopup = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPopupPos({
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
    setOffsetX(0)
    setIsHovered(true)
  }, [])

  const hidePopup = useCallback(() => setIsHovered(false), [])

  // 画面端の補正
  useLayoutEffect(() => {
    if (!isHovered || !popupRef.current) return
    const rect = popupRef.current.getBoundingClientRect()
    if (rect.left < 4) {
      setOffsetX(4 - rect.left)
    } else if (rect.right > window.innerWidth - 4) {
      setOffsetX(window.innerWidth - 4 - rect.right)
    }
  }, [isHovered, popupPos])

  if (currentHp <= 0) {
    return (
      <div className="h-3 bg-gray-700 rounded-sm overflow-hidden">
        <div className="h-full bg-gray-600 w-full" />
      </div>
    )
  }

  const hasPreview = damagePreview && (damagePreview.totalMin > 0 || damagePreview.totalMax > 0)

  if (!hasPreview) {
    const hpRatio = currentHp / maxHp
    return (
      <div className="h-3 bg-gray-700 rounded-sm overflow-hidden">
        <div
          className="h-full bg-red-500 transition-all duration-200"
          style={{ width: `${hpRatio * 100}%` }}
        />
      </div>
    )
  }

  const totalMin = damagePreview.totalMin
  const totalMax = damagePreview.totalMax
  const minDamageRatio = Math.min(totalMin / currentHp, 1)
  const maxDamageRatio = Math.min(totalMax / currentHp, 1)
  const varianceRatio = maxDamageRatio - minDamageRatio
  const remainingRatio = 1 - maxDamageRatio

  const isGuaranteedKill = totalMin >= currentHp
  const isPossibleKill = totalMax >= currentHp

  const hasSegments = damagePreview.segments.length > 0
  const multiplierGroups = hasSegments ? collectMultiplierGroups(damagePreview.segments) : []

  return (
    <div
      ref={triggerRef}
      className="relative"
      onMouseEnter={showPopup}
      onMouseLeave={hidePopup}
    >
      {/* 通常時: シンプルバー */}
      <div className="h-3 bg-gray-700 rounded-sm overflow-hidden flex">
        {remainingRatio > 0 && (
          <div
            className="h-full bg-red-500 transition-all duration-200"
            style={{ width: `${remainingRatio * 100}%` }}
          />
        )}
        {varianceRatio > 0 && (
          <div
            className="h-full bg-orange-300/50 transition-all duration-200"
            style={{ width: `${varianceRatio * 100}%` }}
          />
        )}
        {minDamageRatio > 0 && (
          <div
            className={`h-full ${isGuaranteedKill ? 'bg-yellow-400' : 'bg-orange-500'} transition-all duration-200`}
            style={{ width: `${minDamageRatio * 100}%` }}
          />
        )}
      </div>

      {/* 確殺/可能表示 */}
      {isGuaranteedKill && (
        <div className="absolute -top-0.5 right-0 text-[8px] text-yellow-300 font-bold">KILL</div>
      )}
      {!isGuaranteedKill && isPossibleKill && (
        <div className="absolute -top-0.5 right-0 text-[8px] text-orange-300 font-bold">KILL?</div>
      )}

      {/* ホバー時: 拡大ポップアップ */}
      {isHovered && hasSegments && createPortal(
        <div
          ref={popupRef}
          className="fixed z-[100] pointer-events-none"
          style={{
            left: popupPos.x + offsetX,
            top: popupPos.y - 4,
            transform: 'translateX(-50%) translateY(-100%)',
            width: POPUP_WIDTH,
          }}
        >
          <div className="bg-gray-900 border border-gray-600 rounded shadow-lg p-2">
            {/* ラベル行 */}
            <div className="flex text-[10px] text-gray-300 mb-1">
              {/* 残HP + ブレ幅分の空白 */}
              {(remainingRatio + varianceRatio) > 0 && (
                <div style={{ width: `${(remainingRatio + varianceRatio) * 100}%` }} />
              )}
              {/* セグメントラベル */}
              {damagePreview.segments.map((seg, i) => {
                const segRatio = (seg.damageRange.min / Math.max(totalMin, 1)) * minDamageRatio
                return (
                  <span
                    key={i}
                    className="truncate text-center"
                    style={{ width: `${segRatio * 100}%` }}
                  >
                    {seg.explorerName}:{seg.commandName}
                  </span>
                )
              })}
            </div>

            {/* 積み上げバー */}
            <div className="h-4 bg-gray-700 rounded-sm overflow-hidden flex relative">
              {remainingRatio > 0 && (
                <div className="h-full bg-red-500" style={{ width: `${remainingRatio * 100}%` }} />
              )}
              {varianceRatio > 0 && (
                <div className="h-full bg-orange-300/50" style={{ width: `${varianceRatio * 100}%` }} />
              )}
              {damagePreview.segments.map((seg, i) => {
                const segRatio = (seg.damageRange.min / Math.max(totalMin, 1)) * minDamageRatio
                if (segRatio <= 0) return null
                const hasMultiplier = seg.activeMultipliers.length > 0
                return (
                  <div
                    key={i}
                    className={`h-full ${getSegmentColor(seg, i)} ${hasMultiplier ? 'border border-dashed border-yellow-300' : ''}`}
                    style={{ width: `${segRatio * 100}%` }}
                  />
                )
              })}
              {/* KILL表示 */}
              {isGuaranteedKill && (
                <div className="absolute top-0 right-1 text-[10px] text-yellow-300 font-bold leading-4">KILL</div>
              )}
              {!isGuaranteedKill && isPossibleKill && (
                <div className="absolute top-0 right-1 text-[10px] text-orange-300 font-bold leading-4">KILL?</div>
              )}
            </div>

            {/* 倍率テキスト */}
            {multiplierGroups.length > 0 && (
              <div className="flex gap-2 text-[10px] text-yellow-300 mt-1">
                {multiplierGroups.map((mg, i) => (
                  <span key={i}>{mg.relicName} ×{mg.multiplier}</span>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

/** 全セグメントから重複を除いた倍率レリック一覧を収集 */
function collectMultiplierGroups(segments: CommandDamageSegment[]) {
  const seen = new Set<string>()
  const result: { relicName: string; multiplier: number }[] = []
  for (const seg of segments) {
    for (const m of seg.activeMultipliers) {
      const key = `${m.relicName}-${m.multiplier}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push(m)
      }
    }
  }
  return result
}
