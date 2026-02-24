import { ExplorerState } from '../Types/Explorer'

/** レベルアップ時の情報 */
export interface LevelUpInfo {
  previousLevel: number
  newLevel: number
  hpRecovered: number
  mpRecovered: number
  statsGained: {
    maxHp: number    // +5
    maxMp: number    // +2
    str: number      // +1
    int: number      // +1
    agi: number      // +1
  }
}

/**
 * 次のレベルに必要な討伐数を計算
 * 必要討伐数 = floor(3 × log2(現在のレベル + 1))
 *
 * レベル別の必要討伐数:
 * - Lv1→2: 3体
 * - Lv2→3: 5体
 * - Lv3→4: 6体
 * - Lv4→5: 7体
 */
export function getRequiredKillsForNextLevel(currentLevel: number): number {
  return Math.floor(3 * Math.log2(currentLevel + 1))
}

/**
 * レベルアップ可能か判定
 * 経験値が必要討伐数以上ならtrue
 */
export function canLevelUp(explorer: ExplorerState): boolean {
  const required = getRequiredKillsForNextLevel(explorer.level)
  return explorer.exp >= required
}

/**
 * レベルアップを1回適用
 * - level +1
 * - exp から必要分を消費
 * - maxHP +5, maxMP +2
 * - HP/MP: 新しい最大値の50%を回復（端数切り捨て、上限キャップ）
 * - str +1, int +1, agi +1
 */
export function applyLevelUp(explorer: ExplorerState): {
  updatedExplorer: ExplorerState
  levelUpInfo: LevelUpInfo
} {
  const requiredExp = getRequiredKillsForNextLevel(explorer.level)
  const previousLevel = explorer.level
  const newLevel = previousLevel + 1

  // ステータス増加量
  const maxHpGain = 5
  const maxMpGain = 2
  const statGain = 1

  // 新しい最大値を計算
  const newMaxHp = explorer.maxHp + maxHpGain
  const newMaxMp = explorer.maxMp + maxMpGain

  // HP/MP回復量: 新しい最大値の50%（端数切り捨て）
  const hpRecovery = Math.floor(newMaxHp * 0.5)
  const mpRecovery = Math.floor(newMaxMp * 0.5)

  // 回復後のHP/MP（上限キャップ）
  const newHp = Math.min(explorer.hp + hpRecovery, newMaxHp)
  const newMp = Math.min(explorer.mp + mpRecovery, newMaxMp)

  const updatedExplorer: ExplorerState = {
    ...explorer,
    level: newLevel,
    exp: explorer.exp - requiredExp,
    maxHp: newMaxHp,
    maxMp: newMaxMp,
    hp: newHp,
    mp: newMp,
    str: explorer.str + statGain,
    int: explorer.int + statGain,
    agi: explorer.agi + statGain,
  }

  const levelUpInfo: LevelUpInfo = {
    previousLevel,
    newLevel,
    hpRecovered: newHp - explorer.hp,  // 実際に回復した量
    mpRecovered: newMp - explorer.mp,
    statsGained: {
      maxHp: maxHpGain,
      maxMp: maxMpGain,
      str: statGain,
      int: statGain,
      agi: statGain,
    },
  }

  return { updatedExplorer, levelUpInfo }
}

/**
 * 経験値を加算し、レベルアップを処理（複数回レベルアップ対応）
 * 1体倒すごとに経験値+1が加算される
 */
export function addExpAndProcessLevelUp(
  explorer: ExplorerState,
  expGained: number
): {
  updatedExplorer: ExplorerState
  levelUps: LevelUpInfo[]
} {
  let currentExplorer = {
    ...explorer,
    exp: explorer.exp + expGained,
  }
  const levelUps: LevelUpInfo[] = []

  // レベルアップ可能な限り繰り返す
  while (canLevelUp(currentExplorer)) {
    const { updatedExplorer, levelUpInfo } = applyLevelUp(currentExplorer)
    currentExplorer = updatedExplorer
    levelUps.push(levelUpInfo)
  }

  return {
    updatedExplorer: currentExplorer,
    levelUps,
  }
}
