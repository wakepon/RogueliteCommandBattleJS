interface SegmentedBarProps {
  /** 現在の点灯セグメント数 */
  current: number
  /** 全セグメント数（必要敵数など） */
  max: number
  color?: 'yellow' | 'green' | 'red' | 'blue'
  size?: 'sm' | 'md' | 'lg'
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

/**
 * 区画分割表示バー（パワプロ風）
 * 全長を max セグメントに区切り、current 個分を点灯。
 * 経験値バーで「あと何体倒せばレベルアップか」を直感的に示す用途。
 */
export function SegmentedBar({ current, max, color = 'yellow', size = 'sm' }: SegmentedBarProps) {
  if (max <= 0) return null
  const filled = Math.max(0, Math.min(max, current))

  return (
    <div className={`flex w-full ${sizeClasses[size]} gap-0.5`}>
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm transition-colors ${i < filled ? colorClasses[color] : 'bg-gray-700'}`}
        />
      ))}
    </div>
  )
}
