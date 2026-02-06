import { RunState } from './Run'
import { BattleState } from './Battle'
import { LevelUpInfo } from '../Core/LevelUpCalculator'
import { WeaponData } from './Weapon'
import { SpellData } from './Spell'
import { RelicData } from './Relic'
import { PotionData } from './Potion'

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
