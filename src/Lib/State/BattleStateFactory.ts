import { BattleState, ActorId } from '../Types/Battle'
import { EnemyInstance, EnemyData } from '../Types/Enemy'
import { ExplorerState } from '../Types/Explorer'
import EnemiesData from '../Data/Enemies.json'
import StagePatternsData from '../Data/StagePatterns.json'

// ステージパターンの型
interface StagePattern {
  turnLimit: number
  patterns: { enemies: string[] }[]
}

// マスターデータを型付け
const enemiesData = EnemiesData as Record<string, EnemyData>
const stagePatternsData = StagePatternsData as Record<string, StagePattern>

// ユニークIDを生成
function generateInstanceId(): string {
  return `enemy-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

// 敵インスタンスを生成
function createEnemyInstance(enemyId: string): EnemyInstance {
  const data = enemiesData[enemyId]
  if (!data) {
    throw new Error(`Unknown enemy id: ${enemyId}`)
  }
  return {
    ...data,
    instanceId: generateInstanceId(),
    currentHp: data.hp,
    battleBuffs: [],
    battleDebuffs: [],
  }
}

// ステージに応じた敵を生成
function getEnemiesForStage(stage: number, seed: number): EnemyInstance[] {
  const stageKey = `stage_${stage}`
  const pattern = stagePatternsData[stageKey]

  if (!pattern) {
    // パターンがない場合はスライムを1体
    console.warn(`Stage pattern not found for stage ${stage}, using fallback`)
    return [createEnemyInstance('slime')]
  }

  // シードを使ってパターンを選択（簡易的な疑似乱数）
  const patternIndex = seed % pattern.patterns.length
  const selectedPattern = pattern.patterns[patternIndex]

  return selectedPattern.enemies.map(enemyId => createEnemyInstance(enemyId))
}

// デフォルトのターン制限
const DEFAULT_TURN_LIMIT = 5

// ステージのターン制限を取得
function getTurnLimitForStage(stage: number): number {
  const stageKey = `stage_${stage}`
  const pattern = stagePatternsData[stageKey]
  return pattern?.turnLimit ?? DEFAULT_TURN_LIMIT
}

// アクターをAgi順でソート
function sortActorsByAgi(
  party: ExplorerState[],
  enemies: EnemyInstance[]
): ActorId[] {
  // Explorerのアクター
  const explorerActors: { actorId: ActorId; agi: number }[] = party.map(e => ({
    actorId: { type: 'explorer' as const, id: e.id },
    agi: e.agi,
  }))

  // Enemyのアクター
  const enemyActors: { actorId: ActorId; agi: number }[] = enemies.map(e => ({
    actorId: { type: 'enemy' as const, instanceId: e.instanceId },
    agi: e.agi,
  }))

  // Agi順でソート（降順 = 速い順）
  const allActors = [...explorerActors, ...enemyActors]
  allActors.sort((a, b) => b.agi - a.agi)

  return allActors.map(actor => actor.actorId)
}

/** バトル状態を生成 */
export function createBattleState(
  stage: number,
  party: ExplorerState[],
  seed: number
): BattleState {
  const enemies = getEnemiesForStage(stage, seed)
  const actionQueue = sortActorsByAgi(party, enemies)
  const turnLimit = getTurnLimitForStage(stage)

  return {
    turn: 1,
    turnLimit,
    enemies,
    actionQueue,
    currentActorIndex: 0,
    stolenGold: 0,
    selectedCommand: null,
    selectedTargetId: null,
    damagePopups: [],
    playerDamagePopups: [],
  }
}
