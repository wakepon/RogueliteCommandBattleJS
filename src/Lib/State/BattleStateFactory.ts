import { BattleState, ActorId, RelicBattleState, CommandSlot, EnemyIntent } from '../Types/Battle'
import { EnemyInstance, EnemyData } from '../Types/Enemy'
import { ExplorerState, Buff } from '../Types/Explorer'
import { RelicInstance } from '../Types/Relic'
import { getBattleStartHpReduction } from '../Core/RelicProcessor'
import { selectEnemyAction } from '../Core/EnemyAI'
import { getFloor } from '../Core/StageManager'
import { getTuningValue } from '../Tuning/TuningStore'
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

// 階層ごとのHP倍率を取得
function getFloorHpMultiplier(floor: number): number {
  if (floor === 3) return getTuningValue('floor_3_hp_multiplier', 3.0)
  if (floor === 2) return getTuningValue('floor_2_hp_multiplier', 1.5)
  return 1.0
}

// 階層ごとの攻撃力倍率を取得
function getFloorDamageMultiplier(floor: number): number {
  if (floor === 3) return getTuningValue('floor_3_damage_multiplier', 2.5)
  if (floor === 2) return getTuningValue('floor_2_damage_multiplier', 1.8)
  return 1.0
}

// ステージに応じた敵を生成（第二階層以降はHP倍率を適用）
function getEnemiesForStage(stage: number, seed: number): EnemyInstance[] {
  const stageKey = `stage_${stage}`
  const pattern = stagePatternsData[stageKey]

  if (!pattern) {
    return [createEnemyInstance('slime'), createEnemyInstance('slime')]
  }

  if (pattern.patterns.length === 0) {
    return []
  }

  const patternIndex = seed % pattern.patterns.length
  const selectedPattern = pattern.patterns[patternIndex]

  const instances = selectedPattern.enemies.map(enemyId => createEnemyInstance(enemyId))

  const floor = getFloor(stage)
  const mult = getFloorHpMultiplier(floor)
  if (mult !== 1.0) {
    return instances.map(e => ({
      ...e,
      hp: Math.floor(e.hp * mult),
      currentHp: Math.floor(e.currentHp * mult),
    }))
  }
  return instances
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
// Phase 2: 生存メンバー全員を party 配列順で行動させる
export function createActionQueue(
  party: ExplorerState[],
  enemies: EnemyInstance[]
): ActorId[] {
  const explorerActors: ActorId[] = party
    .filter(e => e.hp > 0)
    .map(e => ({
      type: 'explorer' as const,
      id: e.id,
    }))

  const enemyActors: ActorId[] = enemies.map(e => ({
    type: 'enemy' as const,
    instanceId: e.instanceId,
  }))

  return [...explorerActors, ...enemyActors]
}

/** 敵行動予告を生成（damageMultiplierで攻撃力倍率を適用） */
export function generateEnemyIntents(
  enemies: EnemyInstance[],
  party: ExplorerState[],
  damageMultiplier: number = 1.0
): EnemyIntent[] {
  return enemies
    .filter(e => e.currentHp > 0 && !e.justSummoned)
    .map(enemy => {
      const dummyTarget = party.find(m => m.hp > 0) ?? party[0]
      const action = selectEnemyAction(enemy, dummyTarget)
      const scaledDamage = damageMultiplier !== 1.0
        ? Math.floor(action.damage * damageMultiplier)
        : action.damage
      const storedAction = { ...action, damage: scaledDamage }
      return {
        enemyInstanceId: enemy.instanceId,
        actionName: storedAction.actionName,
        damage: storedAction.damage,
        storedAction,
      }
    })
}

/** レリック戦闘状態を初期化 */
function createRelicBattleState(): RelicBattleState {
  return {
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

/** 血の契約: 戦闘開始時にHP削減+STRバフを全パーティーメンバーに適用 */
export function applyBloodPact(party: ExplorerState[], relics: RelicInstance[]): ExplorerState[] {
  const hpReduction = getBattleStartHpReduction(relics)
  if (!hpReduction) return party

  return party.map(member => {
    if (member.hp <= 0) return member
    const reducedHp = Math.ceil(member.hp * hpReduction.rate)
    const strBuff: Buff = {
      type: 'str',
      value: hpReduction.strBonus,
      duration: 'battle',
    }
    return {
      ...member,
      hp: reducedHp,
      battleBuffs: [...member.battleBuffs, strBuff],
    }
  })
}

/** バトル状態を生成 */
export function createBattleState(
  stage: number,
  party: ExplorerState[],
  seed: number,
  relics: RelicInstance[] = []
): BattleState {
  // 血の契約: 戦闘開始時HP削減+STRバフ
  const adjustedParty = applyBloodPact(party, relics)
  const enemies = getEnemiesForStage(stage, seed)
  const actionQueue = createActionQueue(adjustedParty, enemies)
  const turnLimit = getTurnLimitForStage(stage)
  const commandSlots = createCommandSlots(adjustedParty)
  const floor = getFloor(stage)
  const hpMult = getFloorHpMultiplier(floor)
  const damageMult = getFloorDamageMultiplier(floor)
  const enemyIntents = generateEnemyIntents(enemies, adjustedParty, damageMult)

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
    relicState: createRelicBattleState(),
    bonusGains: [],

    // UI
    selectedCommand: null,
    selectedTargetId: null,
    damagePopups: [],
    playerDamagePopups: [],
    levelUpPopups: [],
    expPopups: [],
    battleMessage: null,
    battleMessageId: 0,

    // 後方互換
    actionQueue,
    currentActorIndex: 0,

    // 階層倍率
    enemyHpMultiplier: hpMult,
    enemyDamageMultiplier: damageMult,

    // 成長方向選択キュー
    pendingGrowthChoices: [],
  }
}
