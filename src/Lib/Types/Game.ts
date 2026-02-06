import { RunState } from './Run'

// ゲームフェーズ
export type GamePhase = 'title' | 'battle' | 'store' | 'event' | 'result'

/**
 * バトル状態（プレースホルダー）
 * TODO: Slice 2以降で設計書に従い以下のプロパティを追加
 * - turnLimit: number
 * - enemies: EnemyInstance[]
 * - actionQueue: ActorId[]
 * - currentActorIndex: number
 * - stolenGold: number
 */
export interface BattleState {
  turn: number
}

/**
 * ストア状態（プレースホルダー）
 * TODO: Slice 6で設計書に従い以下のプロパティを追加
 * - weaponSlots: (WeaponData | SpellData)[]
 * - relicSlots: (RelicData | PotionData)[]
 * - rerollCost: number
 */
export interface StoreState {
  items: string[]
}

// ゲーム全体の状態
export interface GameState {
  phase: GamePhase
  run: RunState | null
  battleState: BattleState | null
  storeState: StoreState | null
}

// 初期GameState
export function createInitialGameState(): GameState {
  return {
    phase: 'title',
    run: null,
    battleState: null,
    storeState: null,
  }
}
