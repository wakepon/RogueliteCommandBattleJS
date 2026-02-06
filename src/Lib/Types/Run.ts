import { ExplorerState, createInitialExplorer } from './Explorer'
import { LevelUpInfo } from '../Core/LevelUpCalculator'
import { RelicInstance } from './Relic'
import { PotionInstance } from './Potion'

// 統計情報
export interface RunStats {
  totalKillCount: number
  totalGoldEarned: number
  maxStageReached: number
}

// ランの状態
export interface RunState {
  seed: number
  startedAt: number
  currentStage: number
  gold: number
  relics: RelicInstance[]
  potions: PotionInstance[]
  party: ExplorerState[]
  stats: RunStats
  battleLevelUps: LevelUpInfo[]  // 戦闘中のレベルアップ情報（一時保存）
}

// 初期Run生成
export function createInitialRun(): RunState {
  return {
    seed: Date.now(),
    startedAt: Date.now(),
    currentStage: 1,
    gold: 5,
    relics: [],
    potions: [],
    party: [createInitialExplorer()],
    stats: {
      totalKillCount: 0,
      totalGoldEarned: 0,
      maxStageReached: 1,
    },
    battleLevelUps: [],
  }
}
