interface DiffLabelProps {
  value: number
  hideZero?: boolean
  prefix?: string
  suffix?: string
}

/**
 * 差分を色付きで表示するラベル
 * - 負: 赤（text-red-400）
 * - 正: 緑（text-green-400）
 * - ゼロ: hideZero=true なら非表示、false なら灰色
 */
export function DiffLabel({
  value,
  hideZero = true,
  prefix = '(',
  suffix = ')',
}: DiffLabelProps) {
  if (value === 0 && hideZero) return null

  const sign = value > 0 ? '+' : ''
  const colorClass =
    value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400'

  return (
    <span className={`${colorClass} text-xs font-semibold`}>
      {prefix}
      {sign}
      {value}
      {suffix}
    </span>
  )
}
