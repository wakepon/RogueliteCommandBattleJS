import { useMemo } from 'react'
import { EnemyData, EnemyType } from '../../Lib/Types/Enemy'
import { isEventStage, TOTAL_STAGES } from '../../Lib/Core/StageManager'
import { ResourceBar } from '../Common'
import StagePatternsData from '../../Lib/Data/StagePatterns.json'
import EnemiesData from '../../Lib/Data/Enemies.json'

interface StagePattern {
  turnLimit: number
  patterns: { enemies: string[] }[]
}

interface NextEnemyInfo {
  name: string
  hp: number
  attack: number
  type: EnemyType
}

interface NextStagePreviewProps {
  seed: number
  currentStage: number
  /** 何ステージ先を表示するか（デフォルト: 1） */
  offset?: number
  /** ラベル表示テキスト（デフォルト: "Next"） */
  label?: string
}

const stagePatternsData = StagePatternsData as Record<string, StagePattern>
const enemiesData = EnemiesData as Record<string, EnemyData>

/** 敵タイプに応じたテキスト色 */
function getEnemyTypeTextColor(type: EnemyType): string {
  switch (type) {
    case 'normal':
      return 'text-green-400'
    case 'elite':
      return 'text-purple-400'
    case 'boss':
      return 'text-red-400'
    default:
      return 'text-gray-400'
  }
}

/** 次ステージの敵情報を取得 */
function getNextStageEnemies(stage: number, seed: number): NextEnemyInfo[] {
  const stageKey = `stage_${stage}`
  const pattern = stagePatternsData[stageKey]

  if (!pattern || pattern.patterns.length === 0) {
    return []
  }

  const patternIndex = seed % pattern.patterns.length
  const selectedPattern = pattern.patterns[patternIndex]

  const enemyIds = selectedPattern.enemies ?? []
  return enemyIds.map(enemyId => {
    const data = enemiesData[enemyId]
    return {
      name: data?.name ?? enemyId,
      hp: data?.hp ?? 0,
      attack: data?.attack ?? 0,
      type: (data?.type as EnemyType) ?? 'normal',
    }
  })
}

export function NextStagePreview({ seed, currentStage, offset = 1, label = 'Next' }: NextStagePreviewProps) {
  const targetStage = currentStage + offset
  const isOutOfRange = targetStage > TOTAL_STAGES
  const isNextEvent = isEventStage(targetStage)
  const nextEnemies = useMemo(() => {
    if (isOutOfRange || isNextEvent) return []
    return getNextStageEnemies(targetStage, seed)
  }, [targetStage, seed, isNextEvent, isOutOfRange])

  // 範囲外なら表示しない
  if (isOutOfRange) {
    return null
  }

  return (
    <div className="bg-gray-800/90 border border-gray-500 rounded-lg p-1.5">
      {/* ヘッダー */}
      <div className="text-[10px] text-gray-400 mb-1 font-bold">
        {label}
      </div>

      {isNextEvent ? (
        // イベントステージの場合: 3つの選択肢を表示（横並び）
        <div className="flex gap-2 justify-around">
          <div className="text-[10px] text-green-400 flex items-center gap-0.5">
            <span>♥</span>
            <span>休憩</span>
          </div>
          <div className="text-[10px] text-yellow-400 flex items-center gap-0.5">
            <span>★</span>
            <span>宝箱</span>
          </div>
          <div className="text-[10px] text-blue-400 flex items-center gap-0.5">
            <span>⚒</span>
            <span>修理</span>
          </div>
        </div>
      ) : (
        // バトルステージ: 敵情報を横並びで表示
        <div className="flex gap-1">
          {nextEnemies.map((enemy, index) => (
            <div key={index} className="flex-1 min-w-0 space-y-0.5">
              <div className={`text-[10px] font-bold truncate ${getEnemyTypeTextColor(enemy.type)}`}>
                {enemy.name}
              </div>
              <ResourceBar
                current={enemy.hp}
                max={enemy.hp}
                color="red"
                showText={false}
                size="sm"
              />
              <div className="text-[9px] text-gray-400 truncate">
                HP:{enemy.hp}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
