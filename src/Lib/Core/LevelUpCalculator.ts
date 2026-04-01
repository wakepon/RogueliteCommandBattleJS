import { ExplorerState, CharacterClass } from '../Types/Explorer'

/** レベルアップ時の情報 */
export interface LevelUpInfo {
  previousLevel: number
  newLevel: number
  hpRecovered: number
  mpRecovered: number
  characterName: string
  statsGained: {
    maxHp: number
    maxMp: number
    str: number
    int: number
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

// クラス別レベルアップ成長値
const CLASS_GROWTH: Record<CharacterClass, { maxHp: number; maxMp: number; str: number; int: number }> = {
  warrior: { maxHp: 7, maxMp: 1, str: 2, int: 0 },
  mage:    { maxHp: 3, maxMp: 4, str: 0, int: 2 },
  cleric:  { maxHp: 5, maxMp: 3, str: 1, int: 1 },
}

/**
 * レベルアップを1回適用
 * - level +1
 * - exp から必要分を消費
 * - クラス別の成長値でステータス増加
 * - HP/MP: 全回復
 */
export function applyLevelUp(explorer: ExplorerState): {
  updatedExplorer: ExplorerState
  levelUpInfo: LevelUpInfo
} {
  const requiredExp = getRequiredKillsForNextLevel(explorer.level)
  const previousLevel = explorer.level
  const newLevel = previousLevel + 1

  // クラス別成長値を取得
  const growth = CLASS_GROWTH[explorer.characterClass]

  // 新しい最大値を計算
  const newMaxHp = explorer.maxHp + growth.maxHp
  const newMaxMp = explorer.maxMp + growth.maxMp

  const updatedExplorer: ExplorerState = {
    ...explorer,
    level: newLevel,
    exp: explorer.exp - requiredExp,
    maxHp: newMaxHp,
    maxMp: newMaxMp,
    hp: newMaxHp,   // 全回復
    mp: newMaxMp,   // 全回復
    str: explorer.str + growth.str,
    int: explorer.int + growth.int,
  }

  const levelUpInfo: LevelUpInfo = {
    previousLevel,
    newLevel,
    characterName: explorer.name,
    hpRecovered: newMaxHp - explorer.hp,
    mpRecovered: newMaxMp - explorer.mp,
    statsGained: {
      maxHp: growth.maxHp,
      maxMp: growth.maxMp,
      str: growth.str,
      int: growth.int,
    },
  }

  return { updatedExplorer, levelUpInfo }
}

/**
 * 経験値を加算し、レベルアップを処理（複数回レベルアップ対応）
 * killCount が必要討伐数以上ならレベルアップ
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

/**
 * パーティー全体にEXPを配分し、レベルアップを処理
 *
 * ルール:
 * - 敵を倒すと全員のkillCount+1（EXP+1）
 * - 止めを刺したキャラはさらに+1（合計+2）
 * - 戦闘不能キャラにもEXPは入る（次バトルで復活するため）
 */
export function distributeExpToParty(
  party: ExplorerState[],
  killerExplorerId: string,
  defeatedCount: number
): {
  updatedParty: ExplorerState[]
  allLevelUps: LevelUpInfo[]
} {
  if (defeatedCount <= 0) {
    return { updatedParty: party, allLevelUps: [] }
  }

  const allLevelUps: LevelUpInfo[] = []

  const updatedParty = party.map(member => {
    // 全員にdefeatedCount分のEXP
    const baseExp = defeatedCount
    // 止めを刺したキャラにはさらに+defeatedCount
    const bonusExp = member.id === killerExplorerId ? defeatedCount : 0
    const totalExp = baseExp + bonusExp

    const { updatedExplorer, levelUps } = addExpAndProcessLevelUp(member, totalExp)
    allLevelUps.push(...levelUps)

    return {
      ...updatedExplorer,
      killCount: updatedExplorer.killCount + totalExp,
    }
  })

  return { updatedParty, allLevelUps }
}
