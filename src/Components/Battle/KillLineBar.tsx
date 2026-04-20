import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { DetailedDamagePreview } from '../../Lib/Utils/DamagePredictor'

interface KillLineBarProps {
  currentHp: number
  maxHp: number
  damagePreview: DetailedDamagePreview | null
}

const POPUP_WIDTH = 280

/**
 * 統合HPバー + キルラインバー
 *
 * maxHPを100%とした割合表示
 * 緑=残HP、赤=予測ダメージ（確定分）、オレンジ=ブレ幅
 * ホバー時: Portalベースの拡大ポップアップ（メンバー区切り線付き）
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

  // 死亡時
  if (currentHp <= 0) {
    return (
      <div className="relative">
        <div className="h-3 bg-gray-700 rounded-sm overflow-hidden">
          <div className="h-full bg-gray-600 w-full" />
        </div>
        <div className="text-[9px] text-gray-300 text-center mt-0.5">
          0 / {maxHp}
        </div>
      </div>
    )
  }

  // maxHPを100%とした割合計算
  const hpRatio = maxHp > 0 ? currentHp / maxHp : 0

  const hasPreview = damagePreview && (damagePreview.totalMin > 0 || damagePreview.totalMax > 0)
  const totalMin = hasPreview ? damagePreview.totalMin : 0
  const totalMax = hasPreview ? damagePreview.totalMax : 0

  // maxHPを100%とした各ゾーンの割合（プレビューなし時は全て0）
  const minDamageRatio = Math.min(totalMin / maxHp, hpRatio)
  const maxDamageRatio = Math.min(totalMax / maxHp, hpRatio)
  const varianceRatio = maxDamageRatio - minDamageRatio
  const remainingHpRatio = hpRatio - maxDamageRatio

  const isGuaranteedKill = hasPreview && totalMin >= currentHp
  const isPossibleKill = hasPreview && totalMax >= currentHp

  const hasSegments = hasPreview && damagePreview.segments.length > 0

  // セグメントの割合を計算（maxHP基準）
  const segmentRatios = hasSegments
    ? damagePreview.segments.map(seg => {
        const ratio = (seg.damageRange.min / Math.max(totalMin, 1)) * minDamageRatio
        return Math.max(ratio, 0)
      })
    : []

  return (
    <div
      ref={triggerRef}
      className="relative"
      onMouseEnter={showPopup}
      onMouseLeave={hidePopup}
    >
      {/* 統合バー: 緑HPの上にダメージ予測を右端から左へ重ねる */}
      <div className="relative h-3 bg-gray-700 rounded-sm overflow-hidden">
        {/* 残HP（緑） - 現在HPの全幅をベースとして表示 */}
        <div
          className="absolute left-0 top-0 h-full bg-green-500"
          style={{ width: `${hpRatio * 100}%` }}
        />
        {/* 確定ダメージ（赤） - HP右端から左に向かって伸びる */}
        <div
          className="absolute top-0 h-full bg-red-500 transition-all duration-200"
          style={{
            right: `${(1 - hpRatio) * 100}%`,
            width: `${minDamageRatio * 100}%`,
          }}
        />
        {/* ブレ幅（オレンジ） - 確定ダメの左側に伸びる */}
        <div
          className="absolute top-0 h-full bg-orange-400 transition-all duration-200"
          style={{
            right: `${(1 - hpRatio + minDamageRatio) * 100}%`,
            width: `${varianceRatio * 100}%`,
          }}
        />
      </div>

      {/* HP数値 */}
      <div className="text-[9px] text-gray-300 text-center mt-0.5">
        {currentHp} / {maxHp}
      </div>

      {/* 確殺/可能表示 */}
      {isGuaranteedKill && (
        <div className="absolute top-0 right-0.5 text-[8px] text-yellow-300 font-bold leading-3">KILL</div>
      )}
      {!isGuaranteedKill && isPossibleKill && (
        <div className="absolute top-0 right-0.5 text-[8px] text-orange-300 font-bold leading-3">KILL?</div>
      )}

      {/* ホバー時: 拡大ポップアップ（全体 maxHP基準で統一） */}
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
              {(remainingHpRatio + varianceRatio) > 0 && (
                <div style={{ width: `${(remainingHpRatio + varianceRatio) * 100}%` }} />
              )}
              {/* セグメントラベル */}
              {damagePreview.segments.map((seg, i) => (
                <span
                  key={i}
                  className="truncate text-center"
                  style={{ width: `${segmentRatios[i] * 100}%` }}
                >
                  {seg.explorerName}:{seg.commandName}
                </span>
              ))}
            </div>

            {/* 積み上げバー */}
            <div className="h-4 bg-gray-700 rounded-sm overflow-hidden flex relative">
              {/* 残HP（緑） */}
              {remainingHpRatio > 0 && (
                <div className="h-full bg-green-500" style={{ width: `${remainingHpRatio * 100}%` }} />
              )}
              {/* ブレ幅（オレンジ） */}
              {varianceRatio > 0 && (
                <div className="h-full bg-orange-400" style={{ width: `${varianceRatio * 100}%` }} />
              )}
              {/* 確定ダメージ: セグメントごとに区切り線 */}
              {damagePreview.segments.map((seg, i) => {
                const segWidth = segmentRatios[i] * 100
                if (segWidth <= 0) return null
                const hasMultiplier = seg.activeMultipliers.length > 0
                return (
                  <div
                    key={i}
                    className={`h-full bg-red-500 ${hasMultiplier ? 'border-y border-dashed border-yellow-300' : ''}`}
                    style={{
                      width: `${segWidth}%`,
                      borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.5)' : undefined,
                    }}
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

            {/* 倍率テキスト（各セグメントの真下に配置） */}
            {damagePreview.segments.some(s => s.activeMultipliers.length > 0) && (
              <div className="flex text-[10px] text-yellow-300 mt-0.5">
                {/* 残HP + ブレ幅分の空白 */}
                {(remainingHpRatio + varianceRatio) > 0 && (
                  <div style={{ width: `${(remainingHpRatio + varianceRatio) * 100}%` }} />
                )}
                {/* 各セグメントの倍率ラベル */}
                {damagePreview.segments.map((seg, i) => {
                  const label = seg.activeMultipliers.map(m => `${m.relicName} ×${m.multiplier}`).join(' ')
                  return (
                    <span
                      key={i}
                      className="truncate text-center"
                      style={{ width: `${segmentRatios[i] * 100}%` }}
                    >
                      {label}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
