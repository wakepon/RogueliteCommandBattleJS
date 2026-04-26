interface ResourceBarProps {
  current: number
  max: number
  color: 'red' | 'blue' | 'green' | 'yellow'
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  /** width transition duration (ms). 既定 300ms */
  transitionMs?: number
}

const colorClasses: Record<ResourceBarProps['color'], string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
}

const sizeClasses: Record<NonNullable<ResourceBarProps['size']>, string> = {
  sm: 'h-2',
  md: 'h-4',
  lg: 'h-6',
}

export function ResourceBar({
  current,
  max,
  color,
  showText = true,
  size = 'md',
  transitionMs = 300,
}: ResourceBarProps) {
  const percentage = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0

  return (
    <div className="w-full">
      <div className={`w-full bg-gray-700 rounded ${sizeClasses[size]} overflow-hidden`}>
        <div
          className={`${colorClasses[color]} ${sizeClasses[size]} transition-all`}
          style={{ width: `${percentage}%`, transitionDuration: `${transitionMs}ms` }}
        />
      </div>
      {showText && (
        <div className="text-xs text-gray-300 text-center mt-1">
          {current} / {max}
        </div>
      )}
    </div>
  )
}
