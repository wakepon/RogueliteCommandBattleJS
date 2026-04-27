import { useEffect, useState } from 'react'

interface SegmentedBarProps {
  /** 現在の点灯セグメント数 */
  current: number
  /** 全セグメント数（必要敵数など） */
  max: number
  color?: 'yellow' | 'green' | 'red' | 'blue'
  size?: 'sm' | 'md' | 'lg'
  /**
   * true: current が増えるとき1セグメントずつ点灯（リザルト画面で経験値が増える演出用）。
   *       縮むときは即時ワープ（レベルアップ時の「最大→0」リセットを違和感なく見せる）。
   * false (既定): current の変化を即座に反映。
   */
  animateExpansion?: boolean
}

const colorClasses: Record<NonNullable<SegmentedBarProps['color']>, string> = {
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
}

const sizeClasses: Record<NonNullable<SegmentedBarProps['size']>, string> = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
}

const STEP_INTERVAL_MS = 200

/**
 * 区画分割表示バー（パワプロ風）
 * 全長を max セグメントに区切り、current 個分を点灯。
 * 経験値バーで「あと何体倒せばレベルアップか」を直感的に示す用途。
 */
export function SegmentedBar({
  current,
  max,
  color = 'yellow',
  size = 'sm',
  animateExpansion = false,
}: SegmentedBarProps) {
  const [displayed, setDisplayed] = useState(current)

  useEffect(() => {
    if (!animateExpansion) {
      setDisplayed(current)
      return
    }
    if (displayed === current) return
    if (displayed > current) {
      // 縮む方向は即ワープ（レベルアップ時の最大→0 リセット）
      setDisplayed(current)
      return
    }
    // 伸びる方向は 1 セグメントずつ
    const t = setTimeout(() => {
      setDisplayed(d => Math.min(d + 1, current))
    }, STEP_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [current, displayed, animateExpansion])

  if (max <= 0) return null
  const filled = Math.max(0, Math.min(max, displayed))

  return (
    <div className={`flex w-full ${sizeClasses[size]} gap-0.5`}>
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm transition-colors duration-150 ${i < filled ? colorClasses[color] : 'bg-gray-700'}`}
        />
      ))}
    </div>
  )
}
