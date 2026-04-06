import { BattleState, ActorId, RelicBattleState, CommandSlot, EnemyIntent } from '../Types/Battle'
import { EnemyInstance, EnemyData } from '../Types/Enemy'
import { ExplorerState } from '../Types/Explorer'
import { RelicInstance } from '../Types/Relic'
import { hasRelicEffect } from '../Core/RelicProcessor'
import { selectEnemyAction } from '../Core/EnemyAI'
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

// 敵インスタンスを生成（仲間呼びでも使用するため export）
export function createEnemyInstance(enemyId: string): EnemyInstance {
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
    return [createEnemyInstance('slime')]
  }

  if (pattern.patterns.length === 0) {
    return []
  }

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

// パーティー→敵の固定順でアクションキューを生成（AGI不要）
// Phase 1: party[0]のみ操作可能。Phase 2で全パーティーメンバーに拡張予定
function createActionQueue(
  party: ExplorerState[],
  enemies: EnemyInstance[]
): ActorId[] {
  // Phase 1: 先頭メンバーのみ
  const explorerActors: ActorId[] = party.slice(0, 1).map(e => ({
    type: 'explorer' as const,
    id: e.id,
  }))

  const enemyActors: ActorId[] = enemies.map(e => ({
    type: 'enemy' as const,
    instanceId: e.instanceId,
  }))

  return [...explorerActors, ...enemyActors]
}

/** 敵行動予告を生成 */
export function generateEnemyIntents(
  enemies: EnemyInstance[],
  party: ExplorerState[]
): EnemyIntent[] {
  return enemies
    .filter(e => e.currentHp > 0)
    .map(enemy => {
      const dummyTarget = party.find(m => m.hp > 0) ?? party[0]
      const action = selectEnemyAction(enemy, dummyTarget)
      return {
        enemyInstanceId: enemy.instanceId,
        actionName: action.actionName,
        damage: action.damage,
      }
    })
}

/** レリック戦闘状態を初期化 */
function createRelicBattleState(relics: RelicInstance[]): RelicBattleState {
  return {
    shieldActive: hasRelicEffect(relics, 'firstHitShield'),
    killStreakActive: false,
  }
}

/** 生存中のパーティーメンバーからコマンドスロットを生成 */
function createCommandSlots(party: ExplorerState[]): CommandSlot[] {
  return party
    .filter(member => member.hp > 0)
    .map(member => ({
      explorerId: member.id,
      command: null,
      targetId: null,
    }))
}

/** バトル状態を生成 */
export function createBattleState(
  stage: number,
  party: ExplorerState[],
  seed: number,
  relics: RelicInstance[] = []
): BattleState {
  const enemies = getEnemiesForStage(stage, seed)
  const actionQueue = createActionQueue(party, enemies)
  const turnLimit = getTurnLimitForStage(stage)
  const commandSlots = createCommandSlots(party)
  const enemyIntents = generateEnemyIntents(enemies, party)

  return {
    turn: 1,
    turnLimit,
    phase: 'command',
    enemies,

    // コマンド選択
    commandSlots,
    activeExplorerIndex: 0,

    // パーティー行動
    currentCommandIndex: 0,

    // 敵行動
    currentEnemyIndex: 0,
    enemyIntents,

    // 共有
    stolenGold: 0,
    relicState: createRelicBattleState(relics),

    // UI
    selectedCommand: null,
    selectedTargetId: null,
    damagePopups: [],
    playerDamagePopups: [],
    levelUpPopups: [],
    battleMessage: null,
    battleMessageId: 0,

    // 後方互換
    actionQueue,
    currentActorIndex: 0,
  }
}
