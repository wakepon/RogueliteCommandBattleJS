import { ExplorerState, createInitialParty } from './Explorer'
import { LevelUpInfo } from '../Core/LevelUpCalculator'
import { RelicInstance } from './Relic'
import { PotionInstance } from './Potion'

// セーブデータバージョン（パーティー制導入で互換性破壊）
export const SAVE_VERSION = 5

// 統計情報
export interface RunStats {
  totalKillCount: number
  maxStageReached: number
}

// 戦闘開始時スナップショット（バトル中のみ有効、END_BATTLEでnullに戻す）
export interface BattleStartSnapshot {
  party: ExplorerState[]
}

// ランの状態
export interface RunState {
  saveVersion: number
  seed: number
  startedAt: number
  currentStage: number
  relics: RelicInstance[]
  potions: PotionInstance[]
  party: ExplorerState[]
  stats: RunStats
  battleLevelUps: LevelUpInfo[]  // 戦闘中のレベルアップ情報（一時保存）
  weaponBreakMultiplier: number  // 努力の証: 武器破壊時の蓄積倍率
  battleStartSnapshot: BattleStartSnapshot | null  // リザルト画面の変化量表示用
}

// 初期Run生成
export function createInitialRun(): RunState {
  return {
    saveVersion: SAVE_VERSION,
    seed: Date.now(),
    startedAt: Date.now(),
    currentStage: 1,
    relics: [],
    potions: [],
    party: createInitialParty(),
    stats: {
      totalKillCount: 0,
      maxStageReached: 1,
    },
    battleLevelUps: [],
    weaponBreakMultiplier: 0,
    battleStartSnapshot: null,
  }
}
