import { ExplorerState } from '../../Lib/Types/Explorer'
import { getItemTooltip } from '../../Lib/Utils/ItemDescription'

interface StoreCommandPanelProps {
  explorer: ExplorerState
}

/** コマンドカテゴリに応じたアイコンの背景色とラベル */
function getCommandIcon(category: string): { bgColor: string; label: string } {
  switch (category) {
    case 'weapon':
      return { bgColor: 'bg-orange-600', label: '剣' }
    case 'spell':
      return { bgColor: 'bg-purple-600', label: '魔' }
    default:
      return { bgColor: 'bg-gray-600', label: '?' }
  }
}

export function StoreCommandPanel({ explorer }: StoreCommandPanelProps) {
  const commands = [
    ...explorer.weapons.map(w => ({
      id: w.id,
      name: w.name,
      category: 'weapon' as const,
      detail: w.currentUses !== null ? `[${w.currentUses}/${w.maxUses}]` : '',
      targetType: w.targetType,
      tooltip: getItemTooltip(w),
    })),
    ...explorer.spells.map(s => ({
      id: s.id,
      name: s.name,
      category: 'spell' as const,
      detail: `${s.mpCost}MP`,
      targetType: s.targetType,
      tooltip: getItemTooltip(s),
    })),
  ]

  return (
    <div className="opacity-40">
      <div className="text-xs text-gray-400 mb-1">command</div>
      <div className="max-h-32 overflow-y-auto">
        {commands.map((command, index) => {
          const icon = getCommandIcon(command.category)
          return (
            <div
              key={`${command.id}-${index}`}
              className="flex items-center gap-2 px-2 py-1 rounded text-sm text-gray-300 cursor-not-allowed"
              title={command.tooltip}
            >
              {/* カーソルインジケーター（非表示） */}
              <span className="w-4 text-transparent">▶</span>

              {/* コマンドカテゴリアイコン */}
              <span className={`w-4 h-4 rounded text-xs flex items-center justify-center ${icon.bgColor}`}>
                {icon.label}
              </span>

              {/* コマンド名 */}
              <span className="flex-1">
                {command.name}
                {command.targetType === 'enemyAll' && (
                  <span className="text-[10px] bg-red-700 text-white px-1 rounded ml-1">全体</span>
                )}
              </span>

              {/* 使用回数/MP */}
              {command.detail && (
                <span className="text-xs opacity-70">{command.detail}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
