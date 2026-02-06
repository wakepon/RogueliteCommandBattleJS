import { RunState } from './Run'
import { BattleState } from './Battle'

// ゲームフェーズ
export type GamePhase = 'title' | 'battle' | 'store' | 'event' | 'result'

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
  resultState: ResultState | null
}

// 初期GameState
export function createInitialGameState(): GameState {
  return {
    phase: 'title',
    run: null,
    battleState: null,
    storeState: null,
    resultState: null,
  }
}
