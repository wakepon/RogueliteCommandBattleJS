interface ResourceBarProps {
  current: number
  max: number
  color: 'red' | 'blue' | 'green' | 'yellow'
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  /** width transition duration (ms). 既定 300ms */
  transitionMs?: number
  /**
   * プレビュー加算分（回復予測など）。現在値の右隣に、点滅する明るい色のセグメントとして表示する。
   * current + preview が max を超える分はクランプされる。
   */
  preview?: number
}

const colorClasses: Record<ResourceBarProps['color'], string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
}

// プレビューセグメント用の明るめの色（点滅させて「予測中」を示す）
const previewColorClasses: Record<ResourceBarProps['color'], string> = {
  red: 'bg-red-300',
  blue: 'bg-blue-300',
  green: 'bg-green-300',
  yellow: 'bg-yellow-300',
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
  preview = 0,
}: ResourceBarProps) {
  const percentage = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  // 現在値の右隣に伸ばすプレビュー幅（max を超えないようにクランプ）
  const previewAmount = Math.max(0, preview)
  const previewPct = max > 0 ? Math.max(0, Math.min(100 - percentage, (previewAmount / max) * 100)) : 0

  return (
    <div className="w-full">
      <div className={`relative w-full bg-gray-700 rounded ${sizeClasses[size]} overflow-hidden`}>
        <div
          className={`${colorClasses[color]} ${sizeClasses[size]} transition-all`}
          style={{ width: `${percentage}%`, transitionDuration: `${transitionMs}ms` }}
        />
        {previewPct > 0 && (
          <div
            className={`absolute inset-y-0 ${previewColorClasses[color]} animate-exp-blink`}
            style={{ left: `${percentage}%`, width: `${previewPct}%` }}
          />
        )}
      </div>
      {showText && (
        <div className="text-xs text-gray-300 text-center mt-1">
          {current} / {max}
        </div>
      )}
    </div>
  )
}
