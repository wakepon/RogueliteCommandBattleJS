import { MapNode, EnemyPreview } from '../Types/Game'
import { EnemyData } from '../Types/Enemy'
import { isEventStage, isBossStage, TOTAL_STAGES } from './StageManager'
import EnemiesData from '../Data/Enemies.json'
import StagePatternsData from '../Data/StagePatterns.json'

interface StagePattern {
  turnLimit: number
  patterns: { enemies: string[] }[]
}

const enemiesData = EnemiesData as Record<string, EnemyData>
const stagePatternsData = StagePatternsData as Record<string, StagePattern>

/** 全ステージのマップノード情報を生成する純粋関数 */
export function generateMapNodes(seed: number): MapNode[] {
  const nodes: MapNode[] = []

  for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
    if (isEventStage(stage)) {
      nodes.push({ stage, nodeType: 'event', enemies: [] })
      continue
    }

    if (isBossStage(stage)) {
      nodes.push({ stage, nodeType: 'boss', enemies: getEnemyPreviews(stage, seed) })
      continue
    }

    nodes.push({ stage, nodeType: 'battle', enemies: getEnemyPreviews(stage, seed) })
  }

  return nodes
}

/** ステージの敵プレビュー情報を取得 */
function getEnemyPreviews(stage: number, seed: number): EnemyPreview[] {
  const stageKey = `stage_${stage}`
  const pattern = stagePatternsData[stageKey]

  if (!pattern || pattern.patterns.length === 0) {
    return []
  }

  // BattleStateFactory.tsと同じパターン選択ロジック
  const patternIndex = seed % pattern.patterns.length
  const selectedPattern = pattern.patterns[patternIndex]

  return selectedPattern.enemies.map(enemyId => {
    const data = enemiesData[enemyId]
    return {
      enemyId,
      type: data?.type ?? 'normal',
    }
  })
}
