import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: React.ReactNode
  /** 指定すると、メインのポップアップの隣にもう1つ別枠のポップアップを表示する（バフ一覧など） */
  secondaryContent?: React.ReactNode
  children: React.ReactNode
  position?: 'top' | 'bottom'
  disabled?: boolean
}

/**
 * ツールチップ（fixed位置 + Portal）
 * overflow:hidden の親コンテナでもクリッ���されない。
 * disabled=true でツールチップを無効化（ドラッグ中など）。
 */
export function Tooltip({ content, secondaryContent, children, position = 'top', disabled = false }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const [offsetX, setOffsetX] = useState(0)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const show = useCallback(() => {
    if (disabled) return
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setCoords({
      x: rect.left + rect.width / 2,
      y: position === 'top' ? rect.top : rect.bottom,
    })
    setOffsetX(0)
    setVisible(true)
  }, [position, disabled])

  const hide = useCallback(() => setVisible(false), [])

  // ツールチップが画面外にはみ出る場合の補正
  useLayoutEffect(() => {
    if (!visible || !tooltipRef.current) return
    const rect = tooltipRef.current.getBoundingClientRect()
    if (rect.left < 4) {
      setOffsetX(4 - rect.left)
    } else if (rect.right > window.innerWidth - 4) {
      setOffsetX(window.innerWidth - 4 - rect.right)
    }
  }, [visible, coords])

  if (!content) return <>{children}</>

  const isTop = position === 'top'

  return (
    <div
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      className="relative"
    >
      {children}
      {visible && !disabled && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[100] pointer-events-none"
          style={{
            left: coords.x + offsetX,
            top: isTop ? coords.y - 4 : coords.y + 4,
            transform: `translateX(-50%) ${isTop ? 'translateY(-100%)' : ''}`,
          }}
        >
          <div className="flex items-start gap-1.5">
            <div className="bg-gray-900 border border-gray-600 text-white text-[11px] px-2.5 py-1.5 rounded shadow-lg">
              {content}
            </div>
            {secondaryContent && (
              <div className="bg-gray-900 border border-gray-600 text-white text-[11px] px-2.5 py-1.5 rounded shadow-lg">
                {secondaryContent}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
