import { RunState } from './Run'
import { BattleState } from './Battle'

// ゲームフェーズ
export type GamePhase = 'title' | 'battle' | 'store' | 'event' | 'result'

// BattleStateをBattle.tsから再エクスポート
export type { BattleState } from './Battle'

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
