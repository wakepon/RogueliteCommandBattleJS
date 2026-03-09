import { RunState } from './Run'
import { BattleState } from './Battle'
import { LevelUpInfo } from '../Core/LevelUpCalculator'
import { WeaponData } from './Weapon'
import { SpellData } from './Spell'
import { RelicData } from './Relic'
import { PotionData } from './Potion'
import { EnemyType } from './Enemy'

// ゲームフェーズ
export type GamePhase = 'title' | 'battle' | 'store' | 'event' | 'result' | 'map'

/** マップノードのタイプ */
export type MapNodeType = 'battle' | 'event' | 'boss'

/** マップ上の敵プレビュー情報 */
export interface EnemyPreview {
  enemyId: string
  type: EnemyType
}

/** マップノード */
export interface MapNode {
  stage: number
  nodeType: MapNodeType
  enemies: EnemyPreview[]
}

/** マップ状態 */
export interface MapState {
  nodes: MapNode[]
  currentStage: number
}

/** イベント画面のサブフェーズ */
export type EventSubPhase =
  | 'selecting'           // 3つの選択肢から選ぶ
  | 'repairSelection'     // 武器修理: 武器を選択中
  | 'treasureReveal'      // 宝箱: 新レリック表示
  | 'treasureReplace'     // 宝箱: 入れ替え選択中

/** イベント状態 */
export interface EventState {
  subPhase: EventSubPhase
  revealedRelic: RelicData | null
  selectedWeaponIds: string[]
}

// BattleStateをBattle.tsから再エクスポート
export type { BattleState } from './Battle'

/** 戦闘結果の状態 */
export interface ResultState {
  result: 'victory' | 'defeat'
  goldEarned: number      // total
  baseGold: number        // 敵種別報酬
  interestGold: number    // 利子
  stolenGold: number      // 盗んだゴールド
  killCount: number       // 討伐数
  levelUps: LevelUpInfo[] // 戦闘中に発生したレベルアップ情報
}

/** ストア状態 */
export interface StoreState {
  weaponSlots: (WeaponData | SpellData | null)[]  // 3枠
  relicSlots: (RelicData | PotionData | null)[]   // 3枠
  rerollCost: number
}

// ゲーム全体の状態
export interface GameState {
  phase: GamePhase
  run: RunState | null
  battleState: BattleState | null
  storeState: StoreState | null
  resultState: ResultState | null
  eventState: EventState | null
  mapState: MapState | null
}

// 初期GameState
export function createInitialGameState(): GameState {
  return {
    phase: 'title',
    run: null,
    battleState: null,
    storeState: null,
    resultState: null,
    eventState: null,
    mapState: null,
  }
}
