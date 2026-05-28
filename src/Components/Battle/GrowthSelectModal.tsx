import { useState } from 'react'
import { GrowthChoice, GrowthTypeOption, GrowthTypeName } from '../../Lib/Types/GrowthType'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { CLASS_ICONS } from './PartyAvatars'

interface GrowthSelectModalProps {
  choice: GrowthChoice
  explorer: ExplorerState
  onSelect: (growthType: GrowthTypeName) => void
}

/** レーダーチャートの軸定義（4軸: STR, INT, HP, MP） */
const RADAR_AXES = [
  { key: 'str', label: 'STR', angle: -Math.PI / 2 },
  { key: 'int', label: 'INT', angle: 0 },
  { key: 'maxHp', label: 'HP', angle: Math.PI / 2 },
  { key: 'maxMp', label: 'MP', angle: Math.PI },
] as const

/** レーダーチャートの最大値（表示用正規化） */
const RADAR_MAX: Record<string, number> = {
  str: 40,
  int: 40,
  maxHp: 300,
  maxMp: 100,
}

function RadarChart({
  explorer,
  previewStats,
}: {
  explorer: ExplorerState
  previewStats: { str: number; int: number; maxHp: number; maxMp: number }
}) {
  const size = 120
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 20

  function getPoint(axis: typeof RADAR_AXES[number], value: number, maxVal: number) {
    const ratio = Math.min(value / maxVal, 1)
    const x = cx + Math.cos(axis.angle) * radius * ratio
    const y = cy + Math.sin(axis.angle) * radius * ratio
    return { x, y }
  }

  // 現在値ポリゴン
  const currentPoints = RADAR_AXES.map(axis => {
    const val = explorer[axis.key as keyof ExplorerState] as number
    return getPoint(axis, val, RADAR_MAX[axis.key])
  })

  // プレビュー値ポリゴン
  const previewPoints = RADAR_AXES.map(axis => {
    const val = previewStats[axis.key as keyof typeof previewStats]
    return getPoint(axis, val, RADAR_MAX[axis.key])
  })

  const currentPath = currentPoints.map(p => `${p.x},${p.y}`).join(' ')
  const previewPath = previewPoints.map(p => `${p.x},${p.y}`).join(' ')

  // グリッド線（25%, 50%, 75%, 100%）
  const gridLevels = [0.25, 0.5, 0.75, 1.0]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* グリッド */}
      {gridLevels.map(level => (
        <polygon
          key={level}
          points={RADAR_AXES.map(axis => {
            const x = cx + Math.cos(axis.angle) * radius * level
            const y = cy + Math.sin(axis.angle) * radius * level
            return `${x},${y}`
          }).join(' ')}
          fill="none"
          stroke="#4a5568"
          strokeWidth="0.5"
        />
      ))}

      {/* 軸線 */}
      {RADAR_AXES.map(axis => (
        <line
          key={axis.key}
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(axis.angle) * radius}
          y2={cy + Math.sin(axis.angle) * radius}
          stroke="#4a5568"
          strokeWidth="0.5"
        />
      ))}

      {/* 現在値 */}
      <polygon
        points={currentPath}
        fill="rgba(59, 130, 246, 0.3)"
        stroke="#3b82f6"
        strokeWidth="1.5"
      />

      {/* プレビュー値 */}
      <polygon
        points={previewPath}
        fill="rgba(250, 204, 21, 0.2)"
        stroke="#facc15"
        strokeWidth="2"
        strokeDasharray="4,2"
      />

      {/* ラベル */}
      {RADAR_AXES.map(axis => {
        const labelOffset = 14
        const x = cx + Math.cos(axis.angle) * (radius + labelOffset)
        const y = cy + Math.sin(axis.angle) * (radius + labelOffset)
        return (
          <text
            key={axis.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#9ca3af"
            fontSize="9"
            fontWeight="bold"
          >
            {axis.label}
          </text>
        )
      })}
    </svg>
  )
}

/** 成長タイプカードの色テーマ */
const GROWTH_TYPE_COLORS: Record<GrowthTypeName, { border: string; bg: string; text: string; glow: string }> = {
  attack:   { border: 'border-red-500',    bg: 'bg-red-950/50',    text: 'text-red-400',    glow: 'shadow-red-500/30' },
  hp:       { border: 'border-green-500',  bg: 'bg-green-950/50',  text: 'text-green-400',  glow: 'shadow-green-500/30' },
  mp:       { border: 'border-blue-500',   bg: 'bg-blue-950/50',   text: 'text-blue-400',   glow: 'shadow-blue-500/30' },
  balance:  { border: 'border-purple-500', bg: 'bg-purple-950/50', text: 'text-purple-400', glow: 'shadow-purple-500/30' },
  allBonus: { border: 'border-yellow-500', bg: 'bg-yellow-950/50', text: 'text-yellow-400', glow: 'shadow-yellow-500/30' },
}

/** 成長タイプアイコン */
const GROWTH_TYPE_ICONS: Record<GrowthTypeName, string> = {
  attack:   '⚔️',
  hp:       '❤️',
  mp:       '💎',
  balance:  '⚖️',
  allBonus: '✨',
}

function GrowthOptionCard({
  option,
  explorer,
  selected,
  onSelect,
}: {
  option: GrowthTypeOption
  explorer: ExplorerState
  selected: boolean
  onSelect: () => void
}) {
  const colors = GROWTH_TYPE_COLORS[option.type]
  const icon = GROWTH_TYPE_ICONS[option.type]

  const previewStats = {
    str: explorer.str + option.stats.str,
    int: explorer.int + option.stats.int,
    maxHp: explorer.maxHp + option.stats.maxHp,
    maxMp: explorer.maxMp + option.stats.maxMp,
  }

  return (
    <button
      onClick={onSelect}
      className={`
        flex-1 p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer
        ${colors.border} ${colors.bg}
        ${selected ? `ring-2 ring-offset-2 ring-offset-gray-900 ring-yellow-400 shadow-lg ${colors.glow} scale-105` : 'hover:scale-102 hover:shadow-md'}
      `}
    >
      {/* タイプ名 */}
      <div className="text-center mb-2">
        <span className="text-2xl">{icon}</span>
        <div className={`text-lg font-bold ${colors.text}`}>{option.label}</div>
      </div>

      {/* レーダーチャート */}
      <div className="flex justify-center mb-2">
        <RadarChart explorer={explorer} previewStats={previewStats} />
      </div>

      {/* ステータス変化リスト */}
      <div className="space-y-0.5 text-sm">
        {option.stats.str > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-400">STR</span>
            <span className="text-red-400 font-bold">+{option.stats.str}</span>
          </div>
        )}
        {option.stats.int > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-400">INT</span>
            <span className="text-blue-400 font-bold">+{option.stats.int}</span>
          </div>
        )}
        {option.stats.maxHp > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-400">HP</span>
            <span className="text-green-400 font-bold">+{option.stats.maxHp}</span>
          </div>
        )}
        {option.stats.maxMp > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-400">MP</span>
            <span className="text-cyan-400 font-bold">+{option.stats.maxMp}</span>
          </div>
        )}
      </div>
    </button>
  )
}

export function GrowthSelectModal({ choice, explorer, onSelect }: GrowthSelectModalProps) {
  const [selectedType, setSelectedType] = useState<GrowthTypeName | null>(null)
  const [confirming, setConfirming] = useState(false)

  const handleSelect = (type: GrowthTypeName) => {
    if (confirming) return
    setSelectedType(type)
  }

  const handleConfirm = () => {
    if (!selectedType || confirming) return
    setConfirming(true)
    // 短い演出後に確定
    setTimeout(() => {
      onSelect(selectedType)
    }, 300)
  }

  const classIcon = CLASS_ICONS[choice.characterClass]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-600 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        {/* ヘッダー */}
        <div className="text-center mb-4">
          <div className="text-yellow-400 text-sm font-bold mb-1">LEVEL UP!</div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl">{classIcon}</span>
            <span className="text-white text-2xl font-bold">{choice.explorerName}</span>
          </div>
        </div>

        {/* 2択カード */}
        <div className="flex gap-3 mb-4">
          <GrowthOptionCard
            option={choice.options[0]}
            explorer={explorer}
            selected={selectedType === choice.options[0].type}
            onSelect={() => handleSelect(choice.options[0].type)}
          />
          <GrowthOptionCard
            option={choice.options[1]}
            explorer={explorer}
            selected={selectedType === choice.options[1].type}
            onSelect={() => handleSelect(choice.options[1].type)}
          />
        </div>

        {/* 決定ボタン */}
        <button
          onClick={handleConfirm}
          disabled={!selectedType || confirming}
          className={`
            w-full py-3 rounded-lg font-bold text-lg transition-all duration-200
            ${selectedType && !confirming
              ? 'bg-yellow-500 hover:bg-yellow-400 text-gray-900 cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {confirming ? '...' : selectedType ? '決定' : 'カードを選んでください'}
        </button>
      </div>
    </div>
  )
}
