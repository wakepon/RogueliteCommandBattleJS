import { ExplorerState, createInitialExplorer } from './Explorer'

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
  relics: string[]    // TODO: Slice 6でRelicInstance[]に変更
  potions: string[]   // TODO: Slice 6でPotionInstance[]に変更
  party: ExplorerState[]
  stats: RunStats
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
  }
}
